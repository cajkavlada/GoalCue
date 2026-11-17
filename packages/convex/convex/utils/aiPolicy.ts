import { ConvexError } from "convex/values";

export const supportedModels = {
  openai: ["gpt-6.1-sol", "gpt-6-luna"],
  anthropic: ["claude-sonnet-5-5", "claude-haiku-5-5"],
  gemini: ["gemini-3.8-flash", "gemini-3.5-flash-lite"],
};
export type Provider = keyof typeof supportedModels;
export type Role = "chat" | "background";
export const inputLimit = 16_000;
export const outputLimit = 4_000;
export const timeout = 60_000;

export function unavailable(message: string): never {
  throw new ConvexError({
    message,
    manualPlanningAvailable: true,
    retryRequired: true,
  });
}

export function reviewedModel(provider: Provider, model: string) {
  if (!supportedModels[provider].includes(model))
    unavailable("Unsupported AI model");
  let reviews: Record<
    string,
    {
      inputRate: number;
      outputRate: number;
      checkedAt: number;
      expiresAt: number;
      retention: string;
      accountSettingsChecked: boolean;
    }
  >;
  try {
    reviews = JSON.parse(process.env.AI_MODEL_REVIEWS ?? "{}");
  } catch {
    unavailable("AI provider review is not configured");
  }
  const review = reviews[`${provider}/${model}`];
  const now = Date.now();
  if (
    !review ||
    !Number.isFinite(review.inputRate) ||
    review.inputRate <= 0 ||
    !Number.isFinite(review.outputRate) ||
    review.outputRate <= 0 ||
    !Number.isFinite(review.checkedAt) ||
    review.checkedAt > now ||
    !Number.isFinite(review.expiresAt) ||
    review.expiresAt <= now ||
    review.expiresAt - review.checkedAt > 31 * 86_400_000 ||
    !review.retention ||
    review.accountSettingsChecked !== true
  )
    unavailable("Current pricing, retention and account review required");
  return { ...review, revision: JSON.stringify(review) };
}

export function allowance(
  userId: string,
  funding: "personal" | "owner",
  personalLimit: number
) {
  const owner = userId === process.env.AI_OWNER_SUBJECT;
  const grants = (process.env.AI_OWNER_FUNDED_SUBJECTS ?? "")
    .split(",")
    .filter(Boolean);
  if (funding === "owner" && !owner && !grants.includes(userId))
    unavailable("Owner-funded AI access has not been granted");
  return {
    limit:
      funding === "personal" ? personalLimit : owner ? 10_000_000 : 1_000_000,
    scopes:
      funding === "personal"
        ? [`personal:${userId}`]
        : [
            `owner-user:${userId}`,
            "owner-global",
            ...(owner ? [] : ["invitee-pool"]),
          ],
  };
}

export function cost(
  input: number,
  output: number,
  inputRate: number,
  outputRate: number
) {
  if (![input, output].every((n) => Number.isSafeInteger(n) && n >= 0))
    unavailable("Provider usage is unavailable");
  return Math.ceil(input * inputRate + output * outputRate);
}

export function monthAt(time: number) {
  return new Date(time).toISOString().slice(0, 7);
}
