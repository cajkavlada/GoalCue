"use node";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import axios from "axios";

import {
  inputLimit,
  outputLimit,
  Provider,
  timeout,
  unavailable,
} from "./aiPolicy";

function encryptionSecret() {
  const key = Buffer.from(process.env.AI_KEY_ENCRYPTION_SECRET ?? "", "base64");
  if (key.length !== 32) unavailable("AI key encryption is not configured");
  return key;
}

export function encryptKey(key: string, userId: string, provider: Provider) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionSecret(), iv);
  cipher.setAAD(Buffer.from(`${userId}/${provider}`));
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
}

export function decryptKey(
  encrypted: string,
  userId: string,
  provider: Provider
) {
  try {
    const [iv, tag, ciphertext] = encrypted
      .split(".")
      .map((part) => Buffer.from(part, "base64"));
    const cipher = createDecipheriv("aes-256-gcm", encryptionSecret(), iv!);
    cipher.setAAD(Buffer.from(`${userId}/${provider}`));
    cipher.setAuthTag(tag!);
    return Buffer.concat([cipher.update(ciphertext!), cipher.final()]).toString(
      "utf8"
    );
  } catch {
    unavailable("AI credentials could not be unlocked");
  }
}

export function ownerKey(provider: Provider) {
  const key = process.env[`AI_${provider.toUpperCase()}_KEY`];
  if (!key) unavailable("Owner-funded provider is not configured");
  return key;
}

function providerHeaders(provider: Provider, key: string) {
  if (provider === "openai") return { Authorization: `Bearer ${key}` };
  if (provider === "anthropic")
    return {
      Authorization: `Bearer ${key}`,
      "anthropic-version": "2026-10-21",
    };
  return { "x-goog-api-key": key };
}

const roots = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
};

export async function checkAvailability(
  provider: Provider,
  model: string,
  key: string
) {
  try {
    const { data } = await axios.get(`${roots[provider]}/models/${model}`, {
      headers: providerHeaders(provider, key),
      timeout,
      maxRedirects: 0,
    });
    if (
      (provider === "gemini" ? data.name : data.id) !==
      (provider === "gemini" ? `models/${model}` : model)
    )
      unavailable("Selected AI model is not available on this account");
    if (
      provider === "gemini" &&
      !data.supportedGenerationMethods?.includes("generateContent")
    )
      unavailable("Selected AI model cannot generate content");
  } catch {
    unavailable("AI account or selected model could not be verified");
  }
}

export function validatePrompt(prompt: string) {
  if (!prompt.trim() || Buffer.byteLength(prompt, "utf8") + 1024 > inputLimit)
    unavailable("AI input exceeds the supported token bound");
}

export async function callProvider(
  provider: Provider,
  model: string,
  key: string,
  prompt: string
) {
  const config = {
    headers: providerHeaders(provider, key),
    timeout,
    maxRedirects: 0,
  };
  if (provider === "openai") {
    const { data } = await axios.post(
      `${roots.openai}/responses`,
      {
        model,
        input: prompt,
        max_output_tokens: outputLimit,
        store: false,
        service_tier: "default",
      },
      config
    );
    return {
      text: (data.output ?? [])
        .filter((item: { type: string }) => item.type === "message")
        .flatMap(
          (item: { content: { type: string; text?: string }[] }) => item.content
        )
        .filter((item: { type: string }) => item.type === "output_text")
        .map((item: { text: string }) => item.text)
        .join(""),
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    };
  }
  if (provider === "anthropic") {
    const { data } = await axios.post(
      `${roots.anthropic}/messages`,
      {
        model,
        max_tokens: outputLimit,
        messages: [{ role: "user", content: prompt }],
      },
      config
    );
    return {
      text: (data.content ?? [])
        .filter((item: { type: string }) => item.type === "text")
        .map((item: { text: string }) => item.text)
        .join(""),
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    };
  }
  const { data } = await axios.post(
    `${roots.gemini}/models/${model}:generateContent`,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: outputLimit },
    },
    config
  );
  return {
    text: (data.candidates?.[0]?.content?.parts ?? [])
      .filter((part: { thought?: boolean }) => !part.thought)
      .map((part: { text?: string }) => part.text ?? "")
      .join(""),
    inputTokens: data.usageMetadata?.promptTokenCount,
    outputTokens:
      data.usageMetadata?.candidatesTokenCount === undefined
        ? undefined
        : data.usageMetadata.candidatesTokenCount +
          (data.usageMetadata.thoughtsTokenCount ?? 0),
  };
}

export function rejectedWithoutCharge(error: unknown) {
  return (
    axios.isAxiosError(error) &&
    [400, 401, 403, 404, 422, 429].includes(error.response?.status ?? 0)
  );
}
