"use client";

import { useState, useEffect } from "react";
import { FileText, Download } from "lucide-react";
import { getThisWeekSundayKST } from "@/lib/weekRange";

type ReportData = {
  week: string;
  weekLabel: string;
  nickname: string;
  recordCount: number;
  records: { id: string; created_at: string; note: string }[];
  sentimentSummary: string;
  sentimentSource?: "openai" | "rule";
  keywordSummary: { keyword: string; count: number }[];
  canDownload: boolean;
};

type Props = { defaultNickname?: string };

export default function WeeklyReportSection({ defaultNickname = "" }: Props) {
  const [nickname, setNickname] = useState(defaultNickname);

  // 현재 로그인(기록 저장) 중인 닉네임이 바뀌면 입력란을 그 닉네임으로 맞춤
  useEffect(() => {
    const current = (defaultNickname ?? "").trim();
    if (current) setNickname(current);
  }, [defaultNickname]);
  const [week, setWeek] = useState(() => getThisWeekSundayKST());
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otherPassword, setOtherPassword] = useState("");
  const [verifiedOtherNicknames, setVerifiedOtherNicknames] = useState<Set<string>>(new Set());

  const isOtherNickname =
    nickname.trim() !== "" &&
    defaultNickname.trim() !== "" &&
    nickname.trim().toLowerCase() !== defaultNickname.trim().toLowerCase();

  const doLoadReport = async () => {
    setError(null);
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(
        `/api/report/weekly?nickname=${encodeURIComponent(nickname.trim())}&week=${encodeURIComponent(week)}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "보고서를 불러올 수 없습니다.");
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    if (!nickname.trim()) {
      setError("닉네임을 입력하세요.");
      return;
    }
    if (isOtherNickname) {
      if (!verifiedOtherNicknames.has(nickname.trim().toLowerCase())) {
        if (!otherPassword.trim()) {
          setError("다른 닉네임의 기록은 개인정보 보호를 위해 해당 닉네임의 비밀번호를 입력해 주세요.");
          return;
        }
        const verifyRes = await fetch("/api/participant/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname: nickname.trim(), password: otherPassword }),
        });
        const verifyJson = (await verifyRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!verifyRes.ok || !verifyJson.ok) {
          setError(verifyJson.error ?? "비밀번호가 일치하지 않습니다.");
          return;
        }
        setVerifiedOtherNicknames((prev) =>
          new Set([...Array.from(prev), nickname.trim().toLowerCase()])
        );
      }
    }
    await doLoadReport();
  };

  const downloadPdf = async () => {
    if (!data?.canDownload || !nickname.trim()) return;
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/report/weekly?nickname=${encodeURIComponent(nickname.trim())}&week=${encodeURIComponent(week)}&download=1`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "PDF 다운로드 실패");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weekly-report-${nickname}-${week}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-4">
      <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        주별 1페이지 보고서 (AI 감정 요약)
      </h3>
      <p className="text-xs text-slate-500">
        주별 마지막날(일요일) 0시 KST 기준. 무료: 보기만 가능. 유료 플랜(초°·분°·시°설계자): PDF 다운로드 가능. 다른 닉네임 조회 시 해당 닉네임의 비밀번호 입력이 필요합니다.
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500">닉네임</span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="조회할 닉네임"
            className="rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2 w-36"
            maxLength={20}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500">주(일요일)</span>
          <input
            type="date"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2 w-40"
          />
        </label>
        {isOtherNickname && (
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-slate-500">비밀번호 (해당 닉네임)</span>
            <input
              type="password"
              value={otherPassword}
              onChange={(e) => setOtherPassword(e.target.value)}
              placeholder="개인정보 보호용"
              className="rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2 w-36"
              autoComplete="current-password"
            />
          </label>
        )}
        <button
          type="button"
          onClick={loadReport}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-electric-blue/80 text-white text-sm font-medium hover:bg-electric-blue disabled:opacity-50"
        >
          {loading ? "불러오는 중..." : "보고서 보기"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {data && (
        <div className="rounded-lg bg-slate-900/80 border border-slate-700 p-4 space-y-3 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-200">{data.weekLabel}</p>
              <p className="text-xs text-slate-500">{data.nickname} · 기록 {data.recordCount}건</p>
            </div>
            {data.canDownload && (
              <button
                type="button"
                onClick={downloadPdf}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deep-violet/80 text-white text-xs hover:bg-deep-violet disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {downloading ? "다운로드 중..." : "PDF 다운로드"}
              </button>
            )}
            {!data.canDownload && (
              <span className="text-xs text-slate-500">유료 플랜에서 PDF 다운로드 가능</span>
            )}
          </div>
          {data.sentimentSummary && (
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-2">
                <span>AI 감정 요약</span>
                {data.sentimentSource === "rule" && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/30">
                    일시적 문제로 룰베이스 제공
                  </span>
                )}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{data.sentimentSummary}</p>
            </div>
          )}
          {data.keywordSummary.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">키워드 (빈도순)</p>
              <p className="text-xs text-slate-400">
                {data.keywordSummary.map((k) => `${k.keyword}(${k.count})`).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
