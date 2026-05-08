"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/requestTimeout";
import AwakeningButton from "./components/AwakeningButton";
import PrivacyPolicy from "./components/PrivacyPolicy";

const RecordModal = dynamic(
  () => import("./components/RecordModal").then((m) => ({ default: m.default })),
  { ssr: false }
);
const MyRecordsView = dynamic(() => import("./components/MyRecordsView"), { ssr: false });
const ResonansGauge = dynamic(() => import("./components/ResonansGauge"), {
  ssr: false,
  loading: () => <div className="py-6 text-center text-slate-500 text-sm">공명 게이지 불러오는 중...</div>,
});
const ResonancePoints = dynamic(() => import("./components/ResonancePoints"), {
  ssr: false,
  loading: () => <div className="py-4 text-center text-slate-500 text-sm">포인트 불러오는 중...</div>,
});
const WordCloudViz = dynamic(() => import("./components/WordCloudViz"), {
  ssr: false,
  loading: () => <div className="py-4 text-center text-slate-500 text-sm">워드클라우드 불러오는 중...</div>,
});
const ExperimentTimeline = dynamic(() => import("./components/ExperimentTimeline"), {
  ssr: false,
  loading: () => <div className="py-4 text-center text-slate-500 text-sm">타임라인 불러오는 중...</div>,
});
const GrowthMessage = dynamic(() => import("./components/GrowthMessage"), { ssr: false });
const InsightCard = dynamic(() => import("./components/InsightCard"), { ssr: false });
const ReactionCharts = dynamic(() => import("./components/ReactionCharts"), {
  ssr: false,
  loading: () => <div className="py-4 text-center text-slate-500 text-sm">감·응 시각화 불러오는 중...</div>,
});
const WeeklyReportSection = dynamic(() => import("./components/WeeklyReportSection"), { ssr: false });
const ResonanceNicknameSection = dynamic(() => import("./components/ResonanceNicknameSection"), { ssr: false });

import type { DurationType, GenderType, AgeGroupType } from "./components/RecordModal";
import SectionErrorBoundary from "./components/SectionErrorBoundary";
import { checkRecordLimit, type PlanType } from "@/lib/planLimits";

const STORAGE_KEY = "awakening_attempts";
const NICKNAME_KEY = "lastRecordNickname";

function getStoredAttempts(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Math.max(0, parseInt(v, 10)) : 0;
  } catch {
    return 0;
  }
}

function setStoredAttempts(n: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {}
}

function getStoredNickname(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function Home() {
  const recordSectionRef = useRef<HTMLElement>(null);
  const [attempts, setAttempts] = useState(0);
  const [totalRecords, setTotalRecords] = useState<number | null>(null);
  const [duration, setDuration] = useState<DurationType>("1s");
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastRecordNickname, setLastRecordNickname] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem(NICKNAME_KEY) ?? "").trim() : ""
  );
  const [myRecordCount, setMyRecordCount] = useState<number | null>(null);
  const [planInfo, setPlanInfo] = useState<{
    planType: PlanType;
    usedToday: number;
    usedPeriod?: number;
  }>({ planType: "free", usedToday: 0 });
  const [sectionKeys, setSectionKeys] = useState({ gauge: 0, points: 0, wordcloud: 0, timeline: 0, insight: 0, charts: 0, report: 0 });
  const [experimentEnded, setExperimentEnded] = useState(false);
  const [sharedNickname, setSharedNickname] = useState<string | null>(null);

  useEffect(() => {
    setAttempts(getStoredAttempts());
    setLastRecordNickname(getStoredNickname());
  }, []);

  useEffect(() => {
    fetch("/api/experiment-status")
      .then((r) => r.json().catch(() => ({})))
      .then((data: { ended?: boolean }) => setExperimentEnded(!!data.ended));
  }, []);

  const onExperimentEnded = useCallback(() => {
    setExperimentEnded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await withTimeout(
          fetch(
            `/api/stats/awakenings${
              lastRecordNickname.trim()
                ? `?nickname=${encodeURIComponent(lastRecordNickname.trim())}`
                : ""
            }`
          ),
          12000
        );
        const json = (await res.json().catch(() => ({}))) as {
          totalRecords?: number | null;
          myRecordCount?: number | null;
        };
        if (cancelled) return;
        if (typeof json.totalRecords === "number") setTotalRecords(json.totalRecords);
        else if (json.totalRecords === null) setTotalRecords(null);
        if (typeof json.myRecordCount === "number") setMyRecordCount(json.myRecordCount);
        else if (json.myRecordCount === null) setMyRecordCount(lastRecordNickname.trim() ? null : 0);
      } catch {}
      if (!cancelled) t = setTimeout(tick, 8000);
    };
    tick();
    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
    };
  }, [lastRecordNickname]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let channel: ReturnType<typeof client.channel> | null = null;
    const t = setTimeout(() => {
      channel = client
        .channel("page-total")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "awakenings" },
          (payload) => {
            const nick = (payload.new as { nickname?: string })?.nickname;
            setTotalRecords((prev) => (typeof prev === "number" ? prev + 1 : 1));
            if (nick?.trim() === lastRecordNickname.trim()) {
              setMyRecordCount((prev) => (typeof prev === "number" ? prev + 1 : 1));
            }
          }
        )
        .subscribe();
    }, 100);
    return () => {
      clearTimeout(t);
      if (channel) client.removeChannel(channel);
    };
  }, [lastRecordNickname]);
  useEffect(() => {
    const client = supabase;
    if (!client || !lastRecordNickname.trim()) {
      setMyRecordCount(0);
      setPlanInfo({ planType: "free", usedToday: 0 });
      return;
    }
    let cancelled = false;
    const nick = lastRecordNickname.trim();
    const fetchCount = (n: string, since: string) =>
      client
        .from("awakenings")
        .select("*", { count: "exact", head: true })
        .eq("nickname", n)
        .gte("created_at", since)
        .then((r) => r.count ?? 0);
    const fetchPlan = (n: string) =>
      client
        .from("participant_plans")
        .select("plan_type, valid_until")
        .eq("nickname", n)
        .maybeSingle()
        .then((r) => r.data as { plan_type: string; valid_until: string } | null);

    withTimeout(
      Promise.resolve(
        client.from("awakenings").select("*", { count: "exact", head: true }).eq("nickname", nick)
      ),
      10000
    )
      .then((res: { count?: number | null; error?: unknown }) => {
        // RLS 변경 이후 클라이언트 count는 실패할 수 있어, 서버 stats를 우선으로 둡니다.
        if (!cancelled && !res.error && typeof res.count === "number") setMyRecordCount(res.count);
      })
      .catch(() => {});

    checkRecordLimit(nick, fetchCount, fetchPlan).then((r) => {
      if (!cancelled)
        setPlanInfo({
          planType: r.planType,
          usedToday: r.usedToday,
          usedPeriod: r.usedPeriod,
        });
    });
    return () => {
      cancelled = true;
    };
  }, [lastRecordNickname]);

  const onAwakeningComplete = useCallback(() => {
    const next = attempts + 1;
    setAttempts(next);
    setStoredAttempts(next);
    recordSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [attempts]);

  const handleRecordSubmit = async (
    nickname: string,
    note: string,
    opts?: { gender?: GenderType | null; ageGroup?: AgeGroupType | null; isPublic?: boolean }
  ) => {
    const n = nickname.trim().slice(0, 20);
    const t = note.trim();
    if (!n || !t) return;
    setSubmitError(null);
    const client = supabase;
    const fetchCount = (nick: string, since: string) =>
      client
        ? client
            .from("awakenings")
            .select("*", { count: "exact", head: true })
            .eq("nickname", nick)
            .gte("created_at", since)
            .then((r) => r.count ?? 0)
        : Promise.resolve(0);
    const fetchPlan = (nick: string) =>
      client
        ? client
            .from("participant_plans")
            .select("plan_type, valid_until")
            .eq("nickname", nick)
            .maybeSingle()
            .then((r) => r.data as { plan_type: string; valid_until: string } | null)
        : Promise.resolve(null);
    const limitResult = await checkRecordLimit(n, fetchCount, fetchPlan);
    if (!limitResult.allowed) {
      setSubmitError(limitResult.message ?? "기록 한도를 초과했습니다.");
      setSubmitStatus("error");
      return;
    }
    setSubmitStatus("loading");
    const noteSliced = t.slice(0, duration === "1s" ? 80 : duration === "10s" ? 60 : 100);
    try {
      const res = await fetch("/api/awakenings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: n,
          note: noteSliced,
          durationType: duration,
          gender: opts?.gender ?? null,
          ageGroup: opts?.ageGroup ?? null,
          isPublic: !!opts?.isPublic,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; notice?: string };
      if (!res.ok || !json.ok) {
        setSubmitError(json.error ?? "저장에 실패했습니다. 다시 시도해 주세요.");
        setSubmitStatus("error");
        return;
      }
      if (json.notice) {
        setSubmitError(json.notice);
      }
    } catch {
      setSubmitError("저장에 실패했습니다. 다시 시도해 주세요.");
      setSubmitStatus("error");
      return;
    }
    setSubmitStatus("done");
    setRecordModalOpen(false);
    setSubmitStatus("idle");
    setMyRecordCount((prev) => (typeof prev === "number" ? prev + 1 : 1));
    setPlanInfo((prev) => ({
      ...prev,
      usedToday: prev.usedToday + 1,
      usedPeriod: prev.usedPeriod != null ? prev.usedPeriod + 1 : undefined,
    }));
    try {
      localStorage.setItem(NICKNAME_KEY, n);
      setLastRecordNickname(n);
    } catch {}
  };

  if (experimentEnded) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-xl font-medium text-slate-200">실험종료합니다.</p>
        <p className="mt-4 text-sm text-slate-500 max-w-md">
          한시적 실험 운영이 종료되었습니다. 참여해 주셔서 감사합니다.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24">
      {/* Landing: 철학 */}
      <section
        id="main-title-section"
        className="pt-8 px-4 text-center"
        aria-label="자깨초시"
      >
        <h1 className="flex justify-center items-center min-h-[2.5rem] m-0 relative z-10">
          <img
            src="/jakkaechosi_logo.png"
            alt="자깨초시"
            width={140}
            height={35}
            className="max-w-[min(100%,9rem)] h-auto object-contain block select-none"
            style={{ pointerEvents: "auto" }}
            fetchPriority="high"
            draggable={false}
          />
        </h1>
        <p className="mt-2 text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
          1.00초 자각 — 뇌가 자신 내면상태와 외부 자극에 의한 무의식/의식 영향으로 인지, 정서, 행동으로 나타나는 찰나의 순간을 포착합니다.
          <br />
          <span className="mt-1 block">
            감응(Resonans)하는 인간, 좌우 뇌를 잇는 뇌량적 정보 통합에 의한{" "}
            <span className="text-base font-medium text-slate-300 italic underline underline-offset-2">
              자신을 깨우는 1.00초°분°시°의 시도
            </span>
            된 의식 리듬을 시각화합니다.
          </span>
        </p>
      </section>

      {/* 자각 버튼 + 1.00s° 타이머 + 감응 파동 */}
      <section className="px-4">
        <AwakeningButton onComplete={onAwakeningComplete} />
      </section>

      {/* 자각 기록: 선택 + 기록하기 버튼 → 클릭 시 모달(입력창) */}
      <section id="record-section" ref={recordSectionRef} className="px-4 mt-6 scroll-mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-400">자각 기록</h2>
          <MyRecordsView
            onNicknameVerified={(nick) => {
              setLastRecordNickname(nick);
              try {
                localStorage.setItem(NICKNAME_KEY, nick);
              } catch {}
            }}
          />
        </div>

        {/* 1초 / 10초 / 100초 찰나 선택 */}
        <div className="flex gap-2 mb-3">
          {(["1s", "10s", "100s"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition ${
                duration === d
                  ? "bg-gradient-resonans text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {d === "1s" ? "1초 찰나(디폴트)" : d === "10s" ? "10초 찰나" : "100초 찰나"}
            </button>
          ))}
        </div>

        {/* 기록하기 버튼 → 모달 열기 */}
        <button
          type="button"
          onClick={() => setRecordModalOpen(true)}
          className="w-full py-3 rounded-lg bg-gradient-resonans text-white font-semibold text-[12px]"
        >
          기록하기
        </button>
      </section>

      {/* 감응 닉네임 (공동): 친구·연인과 공유해 같은 닉네임으로 실험 */}
      <section className="px-4 mt-4">
        <ResonanceNicknameSection
          currentNickname={lastRecordNickname}
          sharedNickname={sharedNickname}
          onSharedNicknameSet={setSharedNickname}
          onExperimentEnded={onExperimentEnded}
        />
      </section>

      <RecordModal
        open={recordModalOpen}
        duration={duration}
        onClose={() => {
          setRecordModalOpen(false);
          setSubmitStatus("idle");
          setSubmitError(null);
        }}
        onSubmit={handleRecordSubmit}
        submitStatus={submitStatus}
        errorMessage={submitError}
        defaultPersonalNickname={lastRecordNickname}
        sharedNickname={sharedNickname}
      />

      {/* 감응 성장 문구 + 음성/중지/소리/감응 버튼 + 플랜 한도 */}
      <section className="px-4 mt-6" aria-label="감응 성장">
        <h2 className="text-sm font-medium text-slate-400 mb-2">감응 성장</h2>
        <GrowthMessage
          planType={planInfo.planType}
          usedToday={planInfo.usedToday}
          usedPeriod={planInfo.usedPeriod}
          lastRecordNickname={lastRecordNickname}
        />
      </section>

      {/* AI 맞춤 감응카드 — 공명 게이지 바로 위 */}
      <section className="px-4 mt-6" aria-label="맞춤 감응카드">
        <h2 className="text-sm font-medium text-slate-400 mb-2">맞춤 감응카드</h2>
        <SectionErrorBoundary fallbackTitle="AI 인사이트를 불러오는 중 문제가 생겼습니다." onRetry={() => setSectionKeys((prev) => ({ ...prev, insight: prev.insight + 1 }))}>
          <div key={sectionKeys.insight}>
            <InsightCard lastRecordNickname={lastRecordNickname} />
          </div>
        </SectionErrorBoundary>
      </section>

      {/* Resonans Gauge */}
      <section className="px-4 mt-8">
        <SectionErrorBoundary fallbackTitle="공명 게이지를 불러오는 중 문제가 생겼습니다." onRetry={() => setSectionKeys((prev) => ({ ...prev, gauge: prev.gauge + 1 }))}>
          <div key={sectionKeys.gauge}>
            <ResonansGauge myAttempts={attempts} lastRecordNickname={lastRecordNickname} />
          </div>
        </SectionErrorBoundary>
      </section>

      {/* 감응 포인트 */}
      <section className="px-4 mt-4">
        <SectionErrorBoundary fallbackTitle="포인트를 불러오는 중 문제가 생겼습니다." onRetry={() => setSectionKeys((prev) => ({ ...prev, points: prev.points + 1 }))}>
          <div key={sectionKeys.points}>
            <ResonancePoints myRecordCount={myRecordCount} totalRecords={totalRecords} />
          </div>
        </SectionErrorBoundary>
      </section>

      {/* 주별 1페이지 보고서 (AI 감정 요약, 무료=보기 / 유료=PDF 다운로드) */}
      <section className="px-4 mt-6">
        <SectionErrorBoundary fallbackTitle="주별 보고서를 불러올 수 없습니다." onRetry={() => setSectionKeys((prev) => ({ ...prev, report: prev.report + 1 }))}>
          <div key={sectionKeys.report}>
            <WeeklyReportSection defaultNickname={lastRecordNickname} />
          </div>
        </SectionErrorBoundary>
      </section>

      {/* 실험 결과: 워드클라우드 + 타임라인 (전체 / 탑10 반응) */}
      <section className="px-4 mt-8">
        <h2 className="text-sm font-medium text-slate-400 mb-3">실험 데이터 타임라인</h2>
        <p className="text-xs text-slate-500 mb-2">전체 리스트 ↔ 상위 반응 탑10이 약 12초마다 바뀝니다. 타인 기록에 감·응을 눌러 보세요.</p>
        <SectionErrorBoundary fallbackTitle="워드클라우드를 불러오는 중 문제가 생겼습니다." onRetry={() => setSectionKeys((prev) => ({ ...prev, wordcloud: prev.wordcloud + 1 }))}>
          <div key={sectionKeys.wordcloud}>
            <WordCloudViz lastRecordNickname={lastRecordNickname} />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary fallbackTitle="타임라인을 불러오는 중 문제가 생겼습니다." onRetry={() => setSectionKeys((prev) => ({ ...prev, timeline: prev.timeline + 1 }))}>
          <div key={sectionKeys.timeline}>
            <ExperimentTimeline lastRecordNickname={lastRecordNickname} />
          </div>
        </SectionErrorBoundary>
      </section>

      {/* 감·응 선택 결과 시각화: 시간대/요일/주/월 */}
      <section className="px-4 mt-8">
        <SectionErrorBoundary fallbackTitle="감·응 시각화를 불러오는 중 문제가 생겼습니다." onRetry={() => setSectionKeys((prev) => ({ ...prev, charts: prev.charts + 1 }))}>
          <div key={sectionKeys.charts}>
            <ReactionCharts />
          </div>
        </SectionErrorBoundary>
      </section>

      {/* Legal */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 px-4 bg-slate-950/90 border-t border-slate-800">
        <div className="flex justify-center">
          <PrivacyPolicy />
        </div>
      </footer>
    </main>
  );
}
