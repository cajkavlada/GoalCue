import axios from "axios";

import { Doc } from "@gc/convex/types";

import { env } from "@/env";

const scope = "https://www.googleapis.com/auth/gmail.readonly";
type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (options: {
        client_id: string;
        scope: string;
        include_granted_scopes: boolean;
        callback: (result: {
          access_token?: string;
          expires_in: number;
          scope: string;
        }) => void;
        error_callback: () => void;
      }) => { requestAccessToken: (options: { prompt: string }) => void };
      revoke: (token: string, callback: () => void) => void;
    };
  };
};
declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export function loadGoogleIdentity() {
  if (window.google) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in is unavailable"));
    document.head.append(script);
  });
}

export function authorizeMail() {
  return new Promise<{ token: string; expiresAt: number }>(
    (resolve, reject) => {
      if (!env.VITE_GOOGLE_CLIENT_ID || !window.google)
        return reject(new Error("Gmail connection is not configured"));
      window.google.accounts.oauth2
        .initTokenClient({
          client_id: env.VITE_GOOGLE_CLIENT_ID,
          scope,
          include_granted_scopes: false,
          callback: (result) =>
            result.access_token && result.scope.split(" ").includes(scope)
              ? resolve({
                  token: result.access_token,
                  expiresAt: Date.now() + result.expires_in * 1000,
                })
              : reject(new Error("Read-only Gmail consent is required")),
          error_callback: () =>
            reject(new Error("Google sign-in was cancelled")),
        })
        .requestAccessToken({ prompt: "select_account" });
    }
  );
}

export type MailSession = {
  token: string;
  expiresAt: number;
  account: string;
  labels: { id: string; name: string }[];
  signal?: AbortSignal;
};
export type Message = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  text: string;
  attachments: string[];
};
type Part = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: Part[];
};
type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  payload?: Part;
};

async function get<T>(
  session: Pick<MailSession, "token" | "expiresAt" | "signal">,
  path: string,
  params = {}
) {
  if (session.signal?.aborted)
    throw new Error("Mail Source permissions changed");
  if (session.expiresAt <= Date.now())
    throw new Error(
      "Gmail access expired. Connect again; manual review is still available."
    );
  try {
    return (
      await axios.get<T>(
        `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
        {
          headers: { Authorization: `Bearer ${session.token}` },
          params,
          paramsSerializer: { indexes: null },
          timeout: 15000,
          signal: session.signal,
        }
      )
    ).data;
  } catch {
    throw new Error("Gmail is unavailable. Connect again or review manually.");
  }
}

export async function connectMail() {
  const session = await authorizeMail();
  const profile = await get<{ emailAddress: string }>(session, "profile");
  const labels = await get<{ labels: MailSession["labels"] }>(
    session,
    "labels"
  );
  return { ...session, account: profile.emailAddress, labels: labels.labels };
}

function checkSource(session: MailSession, source: Doc<"mailSources">) {
  if (
    !source.connected ||
    source.excluded ||
    source.account !== session.account
  )
    throw new Error(
      "Connect the selected personal account and enable this Source first"
    );
}

export async function listMessages(
  session: MailSession,
  source: Doc<"mailSources">,
  limit = 25
) {
  checkSource(session, source);
  const result = await get<{ messages?: { id: string; threadId: string }[] }>(
    session,
    "messages",
    { labelIds: source.labelId, maxResults: limit, includeSpamTrash: true }
  );
  return result.messages ?? [];
}

const decode = (data: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(data.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0)
    )
  );

export async function readMessage(
  session: MailSession,
  source: Doc<"mailSources">,
  id: string
): Promise<Message> {
  checkSource(session, source);
  const partFields = (depth: number): string =>
    `mimeType,filename,headers,body(size,attachmentId${source.bodies ? ",data" : ""})${depth ? `,parts(${partFields(depth - 1)})` : ""}`;
  const raw = await get<GmailMessage>(
    session,
    `messages/${encodeURIComponent(id)}`,
    {
      format: source.bodies || source.attachments ? "full" : "metadata",
      metadataHeaders: ["Subject", "From"],
      fields: `id,threadId,labelIds,payload(${partFields(4)})`,
    }
  );
  if (!raw.labelIds?.includes(source.labelId))
    throw new Error("Message is outside the selected Source");
  const text: string[] = [];
  const attachments: string[] = [];
  async function visit(part: Part) {
    if (part.filename) {
      if (
        source.attachments &&
        part.mimeType === "text/plain" &&
        part.body?.attachmentId &&
        (part.body.size ?? Infinity) <= 100000
      ) {
        const attachment = await get<{ data: string }>(
          session,
          `messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(part.body.attachmentId)}`
        );
        attachments.push(
          `${part.filename}\n${decode(attachment.data).slice(0, 10000)}`
        );
      }
    } else if (
      source.bodies &&
      part.mimeType === "text/plain" &&
      part.body?.data
    )
      text.push(decode(part.body.data).slice(0, 20000));
    for (const child of part.parts ?? []) await visit(child);
  }
  if (raw.payload) await visit(raw.payload);
  if (source.threadContext) {
    const thread = await get<{ messages: GmailMessage[] }>(
      session,
      `threads/${encodeURIComponent(raw.threadId)}`,
      { format: "minimal", fields: "messages(id,labelIds)" }
    );
    for (const related of thread.messages
      .filter((m) => m.id !== id && m.labelIds?.includes(source.labelId))
      .slice(-5)) {
      const message = await readMessage(
        session,
        { ...source, threadContext: false, attachments: false },
        related.id
      );
      text.push(`${message.subject}\n${message.text}`);
    }
  }
  return {
    id: raw.id,
    threadId: raw.threadId,
    subject:
      raw.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")
        ?.value ?? "",
    from:
      raw.payload?.headers?.find((h) => h.name.toLowerCase() === "from")
        ?.value ?? "",
    text: text.join("\n\n").slice(0, 30000),
    attachments,
  };
}
