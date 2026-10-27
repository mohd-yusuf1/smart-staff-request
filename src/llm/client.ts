// The only file that talks to the LLM provider (Google Gemini). The rest of
// the app calls parseRequest() and gets either the LLM's JSON, which is still
// untrusted and goes straight to the validator, or an error it can show.
import { z } from 'zod';

import type { IsoDate } from '../domain/types';
import { buildSystemPrompt } from './prompt';

// generateContent in JSON mode: its request and reply shapes are documented in
// the Gemini API reference. The schema is described in the prompt rather than
// enforced by the API, because the validator checks the reply either way.
// Flash-Lite rather than gemini-3.8-flash: on 26 Oct, 3.8 Flash answered most
// test requests with 503 "high demand" or not within 30 s. Google's model page
// recommends both for new projects, and copying words into fields is a light task.
const MODEL = 'gemini-3.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 30_000;
const MAX_DETAIL_LENGTH = 300;
// Google calls 503 "high demand" spikes temporary, so one quick retry is worth
// it. No retry after a timeout: the owner has already waited 30 s.
const HTTP_SERVICE_UNAVAILABLE = 503;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;

export type LlmErrorKind = 'no_key' | 'offline' | 'timeout' | 'auth' | 'rate_limited' | 'server' | 'blocked' | 'bad_reply';

export interface LlmError {
  kind: LlmErrorKind;
  /** Shown to the owner as is. */
  message: string;
  /** Start of the provider's error text, for the developer log only. */
  detail?: string;
}

export type LlmResult = { ok: true; output: unknown } | { ok: false; error: LlmError };

// Only the parts of the reply we read. The reply is untrusted like any input.
const replySchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) })
          .optional(),
      }),
    )
    .optional(),
});

const BAD_REPLY = "The AI reply couldn't be read. Try again, or fill the request in yourself.";

function failure(kind: LlmErrorKind, message: string, detail?: string): LlmResult {
  return { ok: false, error: { kind, message, detail } };
}

function failureForStatus(status: number, body: string): LlmResult {
  const detail = body.slice(0, MAX_DETAIL_LENGTH);
  // An invalid key comes back as 400 with "API key" in the message.
  if (status === 401 || status === 403 || (status === 400 && /api key/i.test(body))) {
    return failure('auth', 'The AI service rejected the API key. Check EXPO_PUBLIC_LLM_API_KEY in .env.', detail);
  }
  if (status === 429) {
    return failure('rate_limited', 'Too many requests to the AI service. Wait a minute and try again.', detail);
  }
  if (status === HTTP_SERVICE_UNAVAILABLE) {
    return failure('server', 'The AI service is busy right now. Try again in a minute, or fill the request in yourself.', detail);
  }
  return failure('server', `The AI service returned an error (${status}). Try again, or fill the request in yourself.`, detail);
}

function requestBody(text: string, today: IsoDate): string {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: buildSystemPrompt(today) }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });
}

function readReply(body: string): LlmResult {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return failure('bad_reply', BAD_REPLY);
  }
  const reply = replySchema.safeParse(json);
  if (!reply.success) return failure('bad_reply', BAD_REPLY);
  if (reply.data.promptFeedback?.blockReason) {
    return failure('blocked', 'The AI service refused this text. Try rewording it, or fill the request in yourself.');
  }

  const parts = reply.data.candidates?.[0]?.content?.parts ?? [];
  // Skip any "thought" parts; only the answer is the JSON we asked for.
  const answer = parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('');
  try {
    return { ok: true, output: JSON.parse(answer) };
  } catch {
    return failure('bad_reply', BAD_REPLY);
  }
}

interface HttpReply {
  status: number;
  body: string;
}

/** One POST; a network failure or timeout comes back as a failed LlmResult. */
async function post(apiKey: string, payload: string): Promise<HttpReply | LlmResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      // Header rather than ?key= so the key never appears in a URL.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: payload,
      signal: controller.signal,
    });
    return { status: response.status, body: await response.text() };
  } catch {
    return controller.signal.aborted
      ? failure('timeout', 'The AI service took too long to answer. Try again.')
      : failure('offline', "Couldn't reach the AI service. Check your internet connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function parseRequest(text: string, today: IsoDate): Promise<LlmResult> {
  // Expo only inlines EXPO_PUBLIC_ values read with this exact dot notation.
  const apiKey = process.env.EXPO_PUBLIC_LLM_API_KEY;
  if (!apiKey) {
    return failure('no_key', 'No API key. Add EXPO_PUBLIC_LLM_API_KEY to .env, then reload the app.');
  }

  const payload = requestBody(text, today);
  for (let attempt = 1; ; attempt += 1) {
    const reply = await post(apiKey, payload);
    if ('ok' in reply) return reply;
    if (reply.status === HTTP_SERVICE_UNAVAILABLE && attempt < MAX_ATTEMPTS) {
      await wait(RETRY_DELAY_MS);
      continue;
    }
    if (reply.status < 200 || reply.status >= 300) return failureForStatus(reply.status, reply.body);
    return readReply(reply.body);
  }
}
