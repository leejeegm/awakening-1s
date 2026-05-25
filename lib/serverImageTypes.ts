export type ServerImageGenerateResult =
  | { ok: true; imageBase64: string }
  | { ok: false; error: string; timedOut?: boolean; engineStatus?: number; engineError?: unknown };
