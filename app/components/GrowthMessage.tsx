"use client";

import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { Volume2, VolumeX, Square, Sparkles } from "lucide-react";
import ImageComicGeneratorModal from "@/app/components/ImageComicGeneratorModal";
import {
  PLAN_LABELS,
  PLAN_DAILY_LIMIT,
  PLAN_PERIOD_LIMIT,
  PLAN_PRICE,
  type PlanType,
} from "@/lib/planLimits";

const GROWTH_TEXT = "감응 시도가 누적될수록 감응하는 인간으로 성장중입니다.";

const WORD_COLORS = [
  "#2563EB",
  "#4C1D95",
  "#059669",
  "#D97706",
  "#DB2777",
  "#0891B2",
  "#7C3AED",
  "#EA580C",
];

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

const DURATION_OPTIONS = [
  { value: "1s", label: "1초 찰나" },
  { value: "10s", label: "10초 찰나" },
  { value: "100s", label: "100초 찰나" },
] as const;

type Props = {
  planType: PlanType;
  usedToday?: number;
  usedPeriod?: number;
  lastRecordNickname?: string;
  /** 「내 자각 실험 결과 보기」조회 성공 시 받은 비밀번호 해시(서버 이미지 인증) */
  participantAuthHash?: string;
};

export default function GrowthMessage({
  planType,
  usedToday = 0,
  usedPeriod,
  lastRecordNickname = "",
  participantAuthHash = "",
}: Props) {
  const prevUsedTodayRef = useRef<number | undefined>(undefined);
  // 디폴트 무음: 자동 읽기/말하기는 사용자가 켠 뒤에만 동작
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [warmOpen, setWarmOpen] = useState(true);
  const [warmDuration, setWarmDuration] = useState<"1s" | "10s" | "100s">("1s");
  const [warmMessage, setWarmMessage] = useState<string | null>(null);
  const [warmSource, setWarmSource] = useState<"openai" | "gemini" | "rule" | null>(null);
  const [warmLoading, setWarmLoading] = useState(false);
  const [warmError, setWarmError] = useState<string | null>(null);
  const [warmWarning, setWarmWarning] = useState<string | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [pastItems, setPastItems] = useState<{ id: string; content_type: string; content: string; meta: unknown; created_at: string }[]>([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastError, setPastError] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genBaseText, setGenBaseText] = useState("");

  const speak = useCallback(
    (text: string, opts?: { force?: boolean }) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      if (!opts?.force && !voiceEnabled) return;
      if (!opts?.force && volume <= 0) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ko-KR";
      u.rate = 0.9;
      u.volume = Math.max(0, Math.min(1, volume));
      u.onstart = () => setIsSpeaking(true);
      u.onend = u.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [volume, voiceEnabled]
  );

  const speakGrowth = useCallback(() => {
    // 사용자 클릭 시 음성 켜기 + 재생(force는 voiceEnabled와 무관)
    setVoiceEnabled(true);
    speak(GROWTH_TEXT, { force: true });
  }, [speak]);

  const stopSpeak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    if (!voiceEnabled) {
      prevUsedTodayRef.current = usedToday;
      return;
    }
    if (prevUsedTodayRef.current !== undefined && usedToday > prevUsedTodayRef.current) {
      speakGrowth();
    }
    prevUsedTodayRef.current = usedToday;
  }, [usedToday, speakGrowth, voiceEnabled]);

  const fetchWarmMessage = useCallback(async () => {
    const nick = (lastRecordNickname || "").trim() || (typeof window !== "undefined" ? localStorage.getItem("lastRecordNickname") ?? "" : "").trim();
    if (!nick) {
      setWarmError("닉네임이 없습니다. 먼저 자각 기록을 남겨 주세요.");
      setWarmMessage(null);
      return;
    }
    setWarmLoading(true);
    setWarmError(null);
    setWarmWarning(null);
    setWarmMessage(null);
    setWarmSource(null);
    try {
      const res = await fetch(
        `/api/ai/warm-message?nickname=${encodeURIComponent(nick)}&durationType=${warmDuration}`
      );
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        warning?: string;
        source?: "openai" | "gemini" | "rule";
      };
      if (!res.ok) {
        setWarmError(data.error ?? "요청 실패");
        return;
      }
      const src = data.source;
      setWarmSource(src === "openai" || src === "gemini" || src === "rule" ? src : null);
      setWarmWarning(
        data.source === "rule"
          ? (data.warning ?? "일시적 문제로 룰베이스 메시지로 제공 중입니다.")
          : null
      );
      setWarmMessage(data.message ?? null);
    } catch {
      setWarmError("네트워크 오류");
    } finally {
      setWarmLoading(false);
    }
  }, [lastRecordNickname, warmDuration]);

  const getNickname = useCallback(() => {
    return (lastRecordNickname || "").trim() || (typeof window !== "undefined" ? localStorage.getItem("lastRecordNickname") ?? "" : "").trim();
  }, [lastRecordNickname]);

  const fetchPastMessages = useCallback(async () => {
    const nick = getNickname();
    if (!nick) {
      setPastError("닉네임이 없습니다. 먼저 자각 기록을 남겨 주세요.");
      setPastItems([]);
      return;
    }
    setPastLoading(true);
    setPastError(null);
    try {
      const res = await fetch(`/api/ai/past-messages?nickname=${encodeURIComponent(nick)}&limit=30`);
      const data = (await res.json()) as { items?: typeof pastItems; error?: string };
      if (!res.ok) {
        setPastError(data.error ?? "불러오기 실패");
        setPastItems([]);
        return;
      }
      setPastItems(data.items ?? []);
    } catch {
      setPastError("네트워크 오류");
      setPastItems([]);
    } finally {
      setPastLoading(false);
    }
  }, [getNickname]);

  const wordsWithColors = useMemo(() => {
    const words = splitWords(GROWTH_TEXT);
    const shuffled = [...WORD_COLORS].sort(() => Math.random() - 0.5);
    return words.map((word, i) => ({
      word,
      color: shuffled[i % shuffled.length],
    }));
  }, []);

  const dailyLimit = PLAN_DAILY_LIMIT[planType];
  const periodLimit = PLAN_PERIOD_LIMIT[planType];
  const label = PLAN_LABELS[planType];
  const price = PLAN_PRICE[planType as keyof typeof PLAN_PRICE];

  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-3">
      <p className="text-xs text-slate-500 mb-1">감응 성장 문구 · 아래에서 음성/중지/소리/감응 사용</p>
      <p className="text-sm flex items-center gap-x-1.5 gap-y-1 flex-wrap">
        {wordsWithColors.map(({ word, color }, i) => (
          <span
            key={`${i}-${word}`}
            className="growth-word-wave inline-block"
            style={{
              color,
              animationDelay: `${i * 0.12}s`,
              textShadow: `0 0 1px ${color}40, 0 1px 2px rgba(0,0,0,0.3)`,
            }}
          >
            {word}
          </span>
        ))}
        {/* 음성 재생 / 중지 */}
        <span className="shrink-0 inline-flex items-center gap-1">
          <button
            type="button"
            onClick={speakGrowth}
            disabled={isSpeaking}
            className="p-1.5 rounded-lg bg-slate-700/80 hover:bg-electric-blue/30 text-slate-400 hover:text-electric-blue transition disabled:opacity-50"
            title="음성으로 듣기"
            aria-label="감응 동기부여 음성 재생"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={stopSpeak}
            className="p-1.5 rounded-lg bg-slate-700/80 hover:bg-red-500/30 text-slate-400 hover:text-red-400 transition"
            title="음성 중지"
            aria-label="음성 중지"
          >
            <Square className="w-4 h-4" />
          </button>
          {/* 소리 크기 */}
          <span className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              className="p-1 rounded hover:bg-slate-700/60 transition"
              title={voiceEnabled ? "음성 끄기(무음)" : "음성 켜기"}
              aria-label={voiceEnabled ? "음성 끄기" : "음성 켜기"}
            >
              {voiceEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-slate-300" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              disabled={!voiceEnabled}
              className="w-16 h-1.5 accent-blue-500 bg-slate-600 rounded disabled:opacity-40"
              aria-label="음량"
            />
          </span>
        </span>
        {/* 감응 버튼 */}
        <button
          type="button"
          onClick={() => setWarmOpen((o) => !o)}
          className="shrink-0 p-1.5 rounded-lg bg-deep-violet/50 hover:bg-deep-violet/80 text-slate-300 hover:text-white transition inline-flex items-center gap-1"
          title="AI 감응 분석 따뜻한 한마디"
          aria-label="감응 분석"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-medium">감응 {warmOpen ? "닫기" : "보기"}</span>
        </button>
      </p>

      {/* 감응 모달: 1/10/100초 선택 → 카드 보기 / 말하기 */}
      {warmOpen && (
        <div className="mt-3 p-3 rounded-lg bg-slate-900/80 border border-slate-600 space-y-3">
          <p className="text-xs text-slate-400">오늘 작성한 찰나 3개 기준 AI 따뜻한 한마디</p>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setWarmDuration(opt.value);
                  setWarmMessage(null);
                  setWarmSource(null);
                  setWarmError(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  warmDuration === opt.value
                    ? "bg-electric-blue/30 text-electric-blue border border-electric-blue/50"
                    : "bg-slate-700/50 text-slate-400 border border-slate-600 hover:bg-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fetchWarmMessage}
              disabled={warmLoading}
              className="px-3 py-1.5 rounded-lg bg-deep-violet/70 hover:bg-deep-violet text-white text-sm font-medium disabled:opacity-50"
            >
              {warmLoading ? "분석 중…" : "따뜻한 한마디 보기"}
            </button>
            {warmMessage && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!voiceEnabled) setVoiceEnabled(true);
                    speak(warmMessage, { force: true });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm font-medium inline-flex items-center gap-1"
                >
                  <Volume2 className="w-3.5 h-3.5" /> 말하기
                </button>
                <button
                  type="button"
                  onClick={stopSpeak}
                  className="px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-red-500/25 text-slate-300 hover:text-red-300 text-sm font-medium inline-flex items-center gap-1"
                  title="음성 중지"
                  aria-label="따뜻한 한마디 음성 중지"
                >
                  <Square className="w-3.5 h-3.5" />
                  중지
                </button>
                <span className="inline-flex items-center gap-1 ml-1">
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    disabled={!voiceEnabled}
                    className="w-16 h-1.5 accent-blue-500 bg-slate-600 rounded disabled:opacity-40"
                    aria-label="따뜻한 한마디 음량"
                  />
                </span>
              </>
            )}
          </div>
          {warmError && <p className="text-xs text-red-400">{warmError}</p>}
          {warmWarning && <p className="text-xs text-amber-300">{warmWarning}</p>}
          {warmMessage && (
            <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-600 text-sm text-slate-200 leading-relaxed space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {warmSource === "openai" && (
                  <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-200 border border-violet-400/30">
                    GPT-4o 정밀
                  </span>
                )}
                {warmSource === "gemini" && (
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-200 border border-sky-400/25">
                    Gemini 요약 (1차)
                  </span>
                )}
              </div>
              <div className="leading-relaxed">{warmMessage}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setPastOpen(true);
              fetchPastMessages();
            }}
            className="mt-2 text-xs text-slate-500 hover:text-slate-300 underline"
          >
            이전에 받은 멘트 다시 보기
          </button>
        </div>
      )}

      {pastOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setPastOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="이전에 받은 멘트"
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl bg-slate-800 border border-slate-600 shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-3 border-b border-slate-600">
              <h3 className="text-sm font-medium text-slate-200">이전에 받은 멘트</h3>
              <button
                type="button"
                onClick={() => setPastOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-3 flex-1">
              {pastLoading && <p className="text-sm text-slate-500">불러오는 중…</p>}
              {pastError && <p className="text-sm text-red-400">{pastError}</p>}
              {!pastLoading && !pastError && pastItems.length === 0 && (
                <p className="text-sm text-slate-500">저장된 멘트가 없습니다.</p>
              )}
              {!pastLoading &&
                pastItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-slate-700/80 border border-slate-600 text-sm"
                  >
                    <div className="flex justify-between items-center gap-2 text-xs text-slate-500 mb-1">
                      <span>
                        {item.content_type === "warm_message"
                          ? "따뜻한 한마디"
                          : item.content_type === "insight_card"
                            ? "맞춤 감응"
                            : item.content_type === "weekly_summary"
                              ? "주별 요약"
                              : item.content_type}
                        {typeof item.meta === "object" &&
                          item.meta !== null &&
                          (item.meta as { source?: string }).source === "rule" && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/30">
                              룰베이스
                            </span>
                          )}
                      </span>
                      <time>{new Date(item.created_at).toLocaleString("ko-KR")}</time>
                    </div>
                    <p className="text-slate-200 leading-relaxed break-words">
                      {typeof item.content === "string" ? item.content : JSON.stringify(item.content)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => {
                          const text = typeof item.content === "string" ? item.content : "";
                          if (!voiceEnabled) setVoiceEnabled(true);
                          speak(text, { force: true });
                        }}
                        className="text-xs px-2 py-1 rounded bg-slate-600 text-slate-300 hover:bg-slate-500 inline-flex items-center gap-1"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        말하기
                      </button>
                      <button
                        type="button"
                        onClick={stopSpeak}
                        className="text-xs px-2 py-1 rounded bg-slate-700/80 hover:bg-red-500/25 text-slate-300 hover:text-red-300 inline-flex items-center gap-1"
                        title="음성 중지"
                        aria-label="이전 멘트 음성 중지"
                      >
                        <Square className="w-3.5 h-3.5" />
                        중지
                      </button>
                      <span className="inline-flex items-center gap-1">
                        <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={(e) => setVolume(Number(e.target.value))}
                          disabled={!voiceEnabled}
                          className="w-16 h-1.5 accent-blue-500 bg-slate-600 rounded disabled:opacity-40"
                          aria-label="이전 멘트 음량"
                        />
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setGenBaseText(typeof item.content === "string" ? item.content : "");
                          setGenOpen(true);
                        }}
                        className="text-xs px-2 py-1 rounded bg-deep-violet/50 text-slate-200 hover:bg-deep-violet/70"
                        title="이미지/웹툰 생성"
                      >
                        이미지/웹툰
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <ImageComicGeneratorModal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        nickname={getNickname()}
        authHash={participantAuthHash}
        baseText={genBaseText}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          {label}
          {price != null && (
            <span className="ml-1 text-slate-500">({price})</span>
          )}
        </span>
        {planType === "free" && (
          <span>오늘 {usedToday}/{dailyLimit}회 (0시 기준 24시간)</span>
        )}
        {periodLimit && usedPeriod != null && (
          <span>
            {periodLimit.period === "month" ? "이번 달" : "이번 해"} {usedPeriod}/{periodLimit.count}회
          </span>
        )}
      </div>
    </div>
  );
}
