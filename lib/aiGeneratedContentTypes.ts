export type AiGeneratedContentType = "insight_card" | "warm_message" | "weekly_summary";

export function toAiGeneratedContentType(raw: string): AiGeneratedContentType | null {
  if (raw === "insight_card" || raw === "warm_message" || raw === "weekly_summary") return raw;
  return null;
}
