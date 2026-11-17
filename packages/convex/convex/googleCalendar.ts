"use node";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import axios from "axios";
import { ConvexError, v } from "convex/values";

import { calendarAccess } from "@gc/db";

import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { ActionCtx, internalAction } from "./_generated/server";
import { authedAction } from "./utils/authedFunctions";
import { calendarEvent, GoogleEvent } from "./utils/calendarImport";

const google = axios.create({ timeout: 20_000, maxRedirects: 0 });
const base = "https://www.googleapis.com/calendar/v3";
const scopeBase = "https://www.googleapis.com/auth/";

function configuration() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const secret = process.env.CALENDAR_ENCRYPTION_KEY;
  const site = process.env.CONVEX_SITE_URL;
  const appUrl = process.env.GOOGLE_CALENDAR_APP_URL;
  if (
    !clientId ||
    !clientSecret ||
    !secret ||
    !site ||
    !appUrl ||
    Buffer.from(secret, "base64").length !== 32
  )
    throw new ConvexError({
      message: "Google Calendar is not configured on the server",
    });
  return {
    clientId,
    clientSecret,
    key: Buffer.from(secret, "base64"),
    redirectUri: `${site}/calendar/google/callback`,
  };
}

function encrypt(refreshToken: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", configuration().key, iv);
  const encrypted = Buffer.concat([
    cipher.update(refreshToken, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function decrypt(value: string) {
  const bytes = Buffer.from(value, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    configuration().key,
    bytes.subarray(0, 12)
  );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}

export const connect = authedAction({
  args: { access: calendarAccess },
  handler: async (ctx, { access }): Promise<string> => {
    const config = configuration();
    const state = randomBytes(32).toString("hex");
    await ctx.runMutation(internal.calendars.authorize, {
      userId: ctx.userId,
      state,
      access,
    });
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "false",
      state,
      scope: `openid email ${scopeBase}calendar.calendarlist.readonly ${scopeBase}${access === "busy" ? "calendar.events.freebusy" : "calendar.events.readonly"}`,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },
});

export const completeAuthorization = authedAction({
  args: { state: v.string(), code: v.optional(v.string()) },
  handler: async (ctx, { state, code }) => {
    const auth = await ctx.runMutation(
      internal.calendars.consumeAuthorization,
      { state, userId: ctx.userId }
    );
    if (!code) throw new Error("Google Calendar access was not granted");
    const config = configuration();
    const { data: tokens } = await google
      .post<{
        access_token: string;
        refresh_token?: string;
        id_token: string;
        scope: string;
      }>(
        "https://oauth2.googleapis.com/token",
        new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: "authorization_code",
        })
      )
      .catch(() => {
        throw new Error("Google Calendar authorization failed");
      });
    const claims = JSON.parse(
      Buffer.from(tokens.id_token.split(".")[1]!, "base64url").toString("utf8")
    ) as {
      hd?: string;
      email?: string;
      email_verified?: boolean;
      aud: string;
      iss: string;
      exp: number;
    };
    const granted = new Set(tokens.scope.split(" "));
    if (
      claims.aud !== config.clientId ||
      !["accounts.google.com", "https://accounts.google.com"].includes(
        claims.iss
      ) ||
      claims.exp * 1000 <= Date.now() ||
      !claims.email ||
      !claims.email_verified ||
      claims.hd
    )
      throw new Error("Only personal Google accounts can be connected");
    if (
      !tokens.refresh_token ||
      !granted.has(`${scopeBase}calendar.calendarlist.readonly`) ||
      !granted.has(
        `${scopeBase}${auth.access === "busy" ? "calendar.events.freebusy" : "calendar.events.readonly"}`
      )
    )
      throw new Error("Required read-only Calendar access was not granted");
    const calendars: { id: string; title: string; timezone: string }[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await google
        .get<{
          kind?: string;
          items?: {
            id: string;
            summary: string;
            timeZone: string;
            accessRole: string;
          }[];
          nextPageToken?: string;
        }>(`${base}/users/me/calendarList`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          params: { pageToken, maxResults: 250 },
        })
        .catch(() => {
          throw new Error("Google Calendar list retrieval failed");
        });
      if (
        data.items === undefined
          ? data.kind !== "calendar#calendarList"
          : !Array.isArray(data.items)
      )
        throw new Error("Incomplete calendar list");
      for (const item of data.items ?? [])
        if (
          auth.access === "busy" ||
          ["owner", "writer", "reader"].includes(item.accessRole)
        )
          calendars.push({
            id: item.id,
            title: item.summary,
            timezone: item.timeZone,
          });
      pageToken = data.nextPageToken;
    } while (pageToken);
    await ctx.runMutation(internal.calendars.finishAuthorization, {
      authorizationId: auth._id,
      userId: auth.userId,
      access: auth.access,
      email: claims.email,
      credentials: encrypt(tokens.refresh_token),
      calendars,
    });
  },
});

async function assertActive(
  ctx: ActionCtx,
  sourceId: Id<"calendarSources">,
  generation: number
) {
  if (
    !(await ctx.runQuery(internal.calendars.active, { sourceId, generation }))
  )
    throw new Error("Source disconnected or refresh superseded");
}

export const refresh = internalAction({
  args: { sourceId: v.id("calendarSources") },
  handler: async (ctx, { sourceId }) => {
    const source = await ctx.runMutation(internal.calendars.claimRefresh, {
      sourceId,
    });
    if (!source) return;
    const { generation } = source;
    try {
      const config = configuration();
      await assertActive(ctx, sourceId, generation);
      const { data: tokens } = await google.post<{ access_token: string }>(
        "https://oauth2.googleapis.com/token",
        new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: decrypt(source.credentials),
          grant_type: "refresh_token",
        })
      );
      const headers = { Authorization: `Bearer ${tokens.access_token}` };
      const scopeStart = Date.now() - 30 * 86400_000;
      const scopeEnd = Date.now() + 365 * 86400_000;
      const timeMin = new Date(scopeStart).toISOString();
      const timeMax = new Date(scopeEnd).toISOString();
      let events: ReturnType<typeof calendarEvent>[] = [];
      let cancelledIds: string[] = [];
      if (source.access === "busy") {
        await assertActive(ctx, sourceId, generation);
        const { data } = await google.post<{
          calendars?: Record<
            string,
            { errors?: unknown[]; busy?: { start: string; end: string }[] }
          >;
        }>(
          `${base}/freeBusy`,
          {
            timeMin,
            timeMax,
            timeZone: source.timezone,
            items: [{ id: source.calendarId }],
          },
          { headers }
        );
        const calendar = data.calendars?.[source.calendarId];
        if (
          !calendar ||
          calendar.errors?.length ||
          !Array.isArray(calendar.busy)
        )
          throw new Error("Free/busy retrieval failed");
        events = calendar.busy.map(({ start, end }) =>
          calendarEvent(
            {
              id: `busy:${Date.parse(start)}:${Date.parse(end)}`,
              summary: "Busy",
              start: { dateTime: start },
              end: { dateTime: end },
            },
            source.timezone
          )
        );
      } else {
        const retrieve = async (singleEvents: boolean) => {
          const items: GoogleEvent[] = [];
          let pageToken: string | undefined;
          do {
            await assertActive(ctx, sourceId, generation);
            const { data } = await google.get<{
              kind?: string;
              items?: GoogleEvent[];
              nextPageToken?: string;
            }>(
              `${base}/calendars/${encodeURIComponent(source.calendarId)}/events`,
              {
                headers,
                params: {
                  singleEvents,
                  showDeleted: true,
                  timeMin,
                  timeMax,
                  maxResults: 2500,
                  pageToken,
                },
              }
            );
            if (
              data.items === undefined
                ? data.kind !== "calendar#events"
                : !Array.isArray(data.items)
            )
              throw new Error("Incomplete calendar response");
            items.push(...(data.items ?? []));
            pageToken = data.nextPageToken;
          } while (pageToken);
          return items;
        };
        const series = await retrieve(false);
        const instances = await retrieve(true);
        const recurrence = new Map(
          series.filter((e) => e.recurrence).map((e) => [e.id, e.recurrence])
        );
        cancelledIds = [...series, ...instances]
          .filter((e) => e.status === "cancelled")
          .map((e) => e.id);
        for (const master of series.filter((e) => e.status === "cancelled"))
          for (const event of instances)
            if (event.recurringEventId === master.id)
              cancelledIds.push(event.id);
        events = instances
          .filter(
            (e) => e.status !== "cancelled" && !cancelledIds.includes(e.id)
          )
          .map((e) =>
            calendarEvent(
              e,
              source.timezone,
              recurrence.get(e.recurringEventId ?? "")
            )
          );
      }
      await ctx.runMutation(internal.calendars.applyRefresh, {
        sourceId,
        generation,
        scopeStart,
        scopeEnd,
        events,
        cancelledIds,
      });
    } catch {
      await ctx.runMutation(internal.calendars.failRefresh, {
        sourceId,
        generation,
      });
    }
  },
});
