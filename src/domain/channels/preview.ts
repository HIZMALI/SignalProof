import type {
  ChannelMetrics,
  ChannelPayload,
  ChannelPreview,
  PushPresetId,
} from "./types";
import { calculateSmsMetrics } from "./sms";

export const PUSH_PRESETS = {
  compact: { label: "Compact card", titleLimit: 32, bodyLimit: 110 },
  roomy: { label: "Roomy card", titleLimit: 48, bodyLimit: 190 },
} as const;
export function clipPreview(
  text: string,
  limit: number,
): { text: string; visibleEnd: number } {
  const chars = Array.from(text);
  if (chars.length <= limit) return { text, visibleEnd: text.length };
  const visible = chars.slice(0, Math.max(0, limit - 1)).join("");
  return { text: visible + (limit > 0 ? "…" : ""), visibleEnd: visible.length };
}
export function calculateChannelMetrics(
  payload: ChannelPayload,
): ChannelMetrics {
  return {
    titleCharacters: Array.from(payload.title.text).length,
    bodyCharacters: Array.from(payload.body.text).length,
    ...(payload.channel === "sms"
      ? { sms: calculateSmsMetrics(payload.body.text) }
      : {}),
  };
}
export function generateChannelPreview(
  payload: ChannelPayload,
  preset: PushPresetId = "compact",
): ChannelPreview {
  const limits =
    payload.channel === "push"
      ? PUSH_PRESETS[preset]
      : { titleLimit: 60, bodyLimit: 120 };
  const title =
    payload.channel === "sms"
      ? { text: "", visibleEnd: 0 }
      : clipPreview(payload.title.text, limits.titleLimit);
  const body =
    payload.channel === "sms"
      ? { text: payload.body.text, visibleEnd: payload.body.text.length }
      : clipPreview(payload.body.text, limits.bodyLimit);
  return {
    title: title.text,
    body: body.text,
    titleVisibleEnd: title.visibleEnd,
    bodyVisibleEnd: body.visibleEnd,
    truncated:
      title.visibleEnd < payload.title.text.length ||
      body.visibleEnd < payload.body.text.length,
  };
}
