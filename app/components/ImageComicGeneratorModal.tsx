"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

type Mode = "local" | "server";
type Feature = "image_cut" | "comic_4panel";

type Props = {
  open: boolean;
  onClose: () => void;
  nickname: string;
  baseText: string;
};

function dataUrlFromBase64(b64: string) {
  // A1111 returns raw base64 png without prefix
  if (b64.startsWith("data:")) return b64;
  return `data:image/png;base64,${b64}`;
}

async function splitToFourPanels(dataUrl: string) {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("이미지 로드 실패"));
  });
  const w = img.width;
  const h = img.height;
  const halfW = Math.floor(w / 2);
  const halfH = Math.floor(h / 2);
  const panels: string[] = [];
  const positions = [
    [0, 0],
    [halfW, 0],
    [0, halfH],
    [halfW, halfH],
  ] as const;
  for (const [x, y] of positions) {
    const canvas = document.createElement("canvas");
    canvas.width = halfW;
    canvas.height = halfH;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.drawImage(img, x, y, halfW, halfH, 0, 0, halfW, halfH);
    panels.push(canvas.toDataURL("image/png"));
  }
  return panels;
}

export default function ImageComicGeneratorModal({ open, onClose, nickname, baseText }: Props) {
  const [mode, setMode] = useState<Mode>("local");
  const [feature, setFeature] = useState<Feature>("image_cut");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [panels, setPanels] = useState<string[] | null>(null);
  const [usage, setUsage] = useState<{
    usedToday: number;
    dailyLimit: number;
    usedMonth: number;
    monthlyLimit: number;
  } | null>(null);
  const [history, setHistory] = useState<
    { id: string; created_at: string; feature_key: Feature; url: string | null }[]
  >([]);
  const [cacheHit, setCacheHit] = useState(false);

  const normalizedNickname = useMemo(() => (nickname ?? "").trim().toLowerCase(), [nickname]);

  useEffect(() => {
    if (!open) return;
    try {
      const savedMode = (localStorage.getItem("gen_mode") as Mode | null) ?? "local";
      const savedFeature = (localStorage.getItem("gen_feature") as Feature | null) ?? "image_cut";
      if (savedMode === "local" || savedMode === "server") setMode(savedMode);
      if (savedFeature === "image_cut" || savedFeature === "comic_4panel") setFeature(savedFeature);
    } catch {}
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPrompt(
      `다음 글을 바탕으로 이미지로 표현해줘. 개인 식별 정보는 넣지 말아줘.\n\n${(baseText ?? "").trim()}`
    );
    setNegativePrompt("text, watermark, logo, signature, phone number, email");
    setError(null);
    setImageUrl(null);
    setPanels(null);
    setUsage(null);
    setHistory([]);
    setCacheHit(false);
  }, [open, baseText]);

  const loadHistory = async () => {
    if (!normalizedNickname) return;
    const res = await fetch(
      `/api/ai/image/history?nickname=${encodeURIComponent(normalizedNickname)}&limit=10`
    );
    const json = (await res.json().catch(() => ({}))) as {
      items?: { id: string; created_at: string; feature_key: Feature; url: string | null }[];
    };
    setHistory(Array.isArray(json.items) ? json.items : []);
  };

  useEffect(() => {
    try {
      localStorage.setItem("gen_mode", mode);
      localStorage.setItem("gen_feature", feature);
    } catch {}
  }, [mode, feature]);

  const checkServerEntitlement = async () => {
    const res = await fetch(`/api/entitlements?nickname=${encodeURIComponent(normalizedNickname)}`);
    const json = (await res.json().catch(() => ({}))) as { features?: Record<string, boolean> };
    return !!json.features?.[feature];
  };

  const generateLocal = async () => {
    // Local open-source engine: Stable Diffusion WebUI (AUTOMATIC1111) default API
    const url = "http://127.0.0.1:7860/sdapi/v1/txt2img";
    const payload = {
      prompt:
        feature === "comic_4panel"
          ? `${prompt}\n\n4 panel comic, 2x2 grid layout, korean webtoon style`
          : prompt,
      negative_prompt: negativePrompt || undefined,
      steps: 20,
      width: feature === "comic_4panel" ? 1024 : 768,
      height: feature === "comic_4panel" ? 1024 : 512,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { images?: string[] };
    if (!res.ok) throw new Error("로컬 엔진 호출 실패(웹UI 실행/설정/CORS를 확인하세요).");
    const b64 = Array.isArray(json.images) ? json.images[0] : null;
    if (!b64) throw new Error("로컬 엔진 결과가 없습니다.");
    return dataUrlFromBase64(b64);
  };

  const generateServer = async () => {
    const ok = await checkServerEntitlement();
    if (!ok) {
      throw new Error("서버 생성은 유료/관리자 승인 후 사용 가능합니다.");
    }
    const res = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: normalizedNickname,
        featureKey: feature,
        prompt,
        negativePrompt,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      imageBase64?: string;
      error?: string;
      usage?: { usedToday: number; dailyLimit: number; usedMonth: number; monthlyLimit: number };
      cached?: boolean;
      url?: string | null;
      storage?: { bucket: string; path: string };
      usedToday?: number;
      dailyLimit?: number;
      usedMonth?: number;
      monthlyLimit?: number;
    };
    if (!res.ok) throw new Error(json.error ?? "서버 생성 실패");
    if (json.cached && (json.url || (json.storage?.bucket && json.storage?.path))) {
      setCacheHit(true);
      await loadHistory();
      if (json.url) return json.url;
      throw new Error("동일 요청 캐시는 있으나 링크 생성에 실패했습니다. 아래 최근 생성에서 확인해 주세요.");
    }
    if (!json.imageBase64) throw new Error("서버 생성 결과가 없습니다.");
    setCacheHit(false);
    if (json.usage) setUsage(json.usage);
    else if (
      typeof json.usedToday === "number" &&
      typeof json.dailyLimit === "number" &&
      typeof json.usedMonth === "number" &&
      typeof json.monthlyLimit === "number"
    ) {
      setUsage({
        usedToday: json.usedToday,
        dailyLimit: json.dailyLimit,
        usedMonth: json.usedMonth,
        monthlyLimit: json.monthlyLimit,
      });
    }
    await loadHistory();
    return dataUrlFromBase64(json.imageBase64);
  };

  const onGenerate = async () => {
    setBusy(true);
    setError(null);
    setImageUrl(null);
    setPanels(null);
    try {
      const url = mode === "local" ? await generateLocal() : await generateServer();
      setImageUrl(url);
      if (feature === "comic_4panel") {
        const p = await splitToFourPanels(url);
        setPanels(p);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-[min(96vw,46rem)] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-sm font-bold text-slate-100">이미지/웹툰 생성</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500">생성 방식</span>
            <button
              type="button"
              onClick={() => setMode("local")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                mode === "local"
                  ? "bg-electric-blue/25 text-electric-blue border-electric-blue/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
              }`}
            >
              로컬(무료)
            </button>
            <button
              type="button"
              onClick={() => setMode("server")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                mode === "server"
                  ? "bg-deep-violet/25 text-deep-violet border-deep-violet/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
              }`}
            >
              서버(유료·승인)
            </button>
            <span className="text-[11px] text-slate-600">
              로컬은 내 PC에서 SD WebUI(예: `http://127.0.0.1:7860`)가 켜져 있어야 합니다.
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500">형태</span>
            <button
              type="button"
              onClick={() => setFeature("image_cut")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                feature === "image_cut"
                  ? "bg-slate-700/70 text-slate-200 border-slate-600"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
              }`}
            >
              한 장 이미지 컷
            </button>
            <button
              type="button"
              onClick={() => setFeature("comic_4panel")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                feature === "comic_4panel"
                  ? "bg-slate-700/70 text-slate-200 border-slate-600"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
              }`}
            >
              4면 분할 웹툰(한 장 그리드)
            </button>
          </div>

          <label className="block">
            <span className="text-xs text-slate-400">프롬프트</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm min-h-[120px] resize-y"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">네거티브(선택)</span>
            <input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
            />
          </label>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-gradient-resonans text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? "생성 중..." : "생성하기"}
            </button>
            {error && <span className="text-xs text-red-400 break-words">{error}</span>}
          </div>
          {cacheHit && mode === "server" && (
            <p className="text-[11px] text-emerald-300">
              캐시 재사용됨: 동일 요청은 비용/엔진 호출 없이 즉시 표시됩니다.
            </p>
          )}
          {usage && mode === "server" && (
            <p className="text-[11px] text-slate-500">
              서버 사용량: 오늘 {usage.usedToday}/{usage.dailyLimit}, 이번 달 {usage.usedMonth}/{usage.monthlyLimit}
            </p>
          )}

          {imageUrl && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">결과</p>
              <img src={imageUrl} alt="generated" className="w-full rounded-lg border border-slate-700" />
              <div className="flex flex-wrap gap-2">
                <a
                  href={imageUrl}
                  download={feature === "comic_4panel" ? "comic-grid.png" : "image.png"}
                  className="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                >
                  다운로드
                </a>
              </div>
            </div>
          )}

          {panels && panels.length === 4 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">4면 분할(자동 분할)</p>
              <div className="grid grid-cols-2 gap-2">
                {panels.map((p, i) => (
                  <a key={i} href={p} download={`panel-${i + 1}.png`} className="block">
                    <img src={p} alt={`panel-${i + 1}`} className="w-full rounded border border-slate-700" />
                  </a>
                ))}
              </div>
              <p className="text-[11px] text-slate-600">각 패널 클릭하면 개별 다운로드됩니다.</p>
            </div>
          )}

          {mode === "server" && (
            <div className="pt-3 border-t border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">최근 생성(서버)</p>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="text-[11px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  새로고침
                </button>
              </div>
              {history.length === 0 ? (
                <p className="text-[11px] text-slate-600">최근 생성 내역이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {history.map((h) => (
                    <a
                      key={h.id}
                      href={h.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded border border-slate-700 bg-slate-900/50 overflow-hidden hover:border-slate-500"
                      title={`${new Date(h.created_at).toLocaleString("ko-KR")} · ${h.feature_key}`}
                    >
                      {h.url ? (
                        <img src={h.url} alt="history" className="w-full h-24 object-cover" />
                      ) : (
                        <div className="h-24 flex items-center justify-center text-[11px] text-slate-600">
                          링크 준비중
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

