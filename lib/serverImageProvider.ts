export type ImageProvider = "gemini" | "webui" | "pollinations";

export function hasGeminiImageKey() {
  return Boolean(
    (process.env.GEMINI_JAKKAE_API_KEY ?? process.env.GEMINI_API_KEY ?? "").trim()
  );
}

/** IMAGE_PROVIDER 미설정 시: Gemini 키 → webui URL → pollinations */
export function resolveImageProvider(): ImageProvider {
  const raw = (process.env.IMAGE_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "gemini" || raw === "webui" || raw === "pollinations") return raw;
  if (hasGeminiImageKey()) return "gemini";
  if ((process.env.IMAGE_ENGINE_URL ?? "").trim()) return "webui";
  return "pollinations";
}

export function providerDisplayName(provider: ImageProvider) {
  switch (provider) {
    case "gemini":
      return "Google Gemini";
    case "webui":
      return "GPU WebUI";
    case "pollinations":
      return "Pollinations (데모)";
  }
}

/** null이면 설정 OK */
export function providerConfigError(provider: ImageProvider): string | null {
  if (provider === "gemini") {
    if (!hasGeminiImageKey()) {
      return "GEMINI_JAKKAE_API_KEY 또는 GEMINI_API_KEY를 Vercel/로컬 env에 설정해 주세요.";
    }
    return null;
  }
  if (provider === "webui") {
    if (!(process.env.IMAGE_ENGINE_URL ?? "").trim()) {
      return "IMAGE_ENGINE_URL(WebUI txt2img)을 설정해 주세요.";
    }
    return null;
  }
  return null;
}
