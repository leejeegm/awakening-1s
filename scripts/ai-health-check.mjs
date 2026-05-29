import { readFileSync } from "fs";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    // ignore
  }
}

function sanitize(text) {
  return text.replace(/\s+/g, " ").trim();
}

function charCount(text) {
  return Array.from(sanitize(text)).length;
}

function geminiThinkingConfig(model) {
  const m = model.toLowerCase();
  if (/gemini-2\.5-pro/.test(m)) return { thinkingBudget: 128 };
  if (/gemini-2\.5.*flash/.test(m)) return { thinkingBudget: 0 };
  return undefined;
}

loadEnv();

const geminiKey = !!(process.env.GEMINI_JAKKAE_API_KEY || process.env.GEMINI_API_KEY);
const openaiKey = !!process.env.OPENAI_API_KEY;
console.log("ENV gemini:", geminiKey ? "SET" : "MISSING");
console.log("ENV openai:", openaiKey ? "SET" : "MISSING");
console.log("GEMINI_MODEL:", process.env.GEMINI_MODEL || "(default gemini-2.5-flash)");

async function testGemini() {
  const apiKey = process.env.GEMINI_JAKKAE_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    console.log("\nGemini test: SKIP (no key)");
    return;
  }
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt =
    "당신은 주간 요약 도우미입니다. 한국어 100자 이내 한 문단만.\n\n기록:\n뇌가 맑아지는 순간\n오늘 산책";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.7,
          thinkingConfig: geminiThinkingConfig(model),
        },
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.log("\nGemini test: FAIL", res.status, body.slice(0, 300));
      return;
    }
    const json = JSON.parse(body);
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("")?.trim() ?? "";
    console.log("\nGemini test: OK", "len=" + charCount(text));
    console.log("Gemini raw:", text.slice(0, 150));
  } catch (e) {
    console.log("\nGemini test: ERROR", String(e).slice(0, 200));
  }
}

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    console.log("\nOpenAI test: SKIP (no key)");
    return;
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "한국어 100자 이내 주간 요약 한 문단만." },
          { role: "user", content: "기록: 뇌가 맑아진다. 산책했다." },
        ],
        max_tokens: 150,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.log("\nOpenAI test: FAIL", res.status, body.slice(0, 300));
      return;
    }
    const json = JSON.parse(body);
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    console.log("\nOpenAI test: OK", "len=" + charCount(text));
    console.log("OpenAI raw:", text.slice(0, 150));
  } catch (e) {
    console.log("\nOpenAI test: ERROR", String(e).slice(0, 200));
  }
}

async function testGeminiWeeklyFull() {
  const apiKey = process.env.GEMINI_JAKKAE_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) return;
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const userBlock = `다음은 한 주간의 자각 기록입니다. 주간 감응 요약 한 문단을 작성해 주세요.

필수 조건:
- 전체 길이 100자 이내(공백 포함, 한글 글자 수 기준). 한 문단만 출력.
- 한국어 맞춤법·띄어쓰기·조사를 자연스럽게.

기록:
뇌가 맑아지는 순간
오늘 산책했고 마음이 편했다`;
  const prompt =
    "당신은 사용자의 자각 기록을 읽고 한 주를 요약하는 도우미입니다. 한국어로만, 100자 이내 한 문단으로 답하세요. 맞춤법과 문맥을 지키고, 따뜻하고 감동적인 문장으로 작성하세요.\n\n" +
    userBlock;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.7,
        thinkingConfig: geminiThinkingConfig(model),
      },
    }),
  });
  const json = await res.json();
  const c = json.candidates?.[0];
  const text = c?.content?.parts?.map((p) => p.text ?? "").join("")?.trim() ?? "";
  console.log("\n--- Gemini weekly-full ---");
  console.log("status", res.status, "finishReason", c?.finishReason);
  console.log("text len", charCount(text), "raw:", JSON.stringify(text));
  if (json.error) console.log("error", json.error);
}

async function testGeminiTokenLimits() {
  const apiKey = process.env.GEMINI_JAKKAE_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) return;
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt =
    "한국어로 80자 이상 한 문단. 주간 기록 요약: 뇌가 맑아지고 산책했다.";
  console.log("\n--- Gemini maxOutputTokens sweep ---");
  for (const max of [150, 512, 1024]) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: max,
          temperature: 0.7,
          thinkingConfig: geminiThinkingConfig(model),
        },
      }),
    });
    const json = await res.json();
    const c = json.candidates?.[0];
    const text = (c?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    console.log(
      `max=${max} finish=${c?.finishReason} len=${charCount(text)} text=${JSON.stringify(text.slice(0, 100))}`
    );
    if (json.usageMetadata) {
      console.log("  usage:", JSON.stringify(json.usageMetadata));
    }
  }
}

await testGemini();
await testGeminiWeeklyFull();
await testGeminiTokenLimits();
await testOpenAI();
