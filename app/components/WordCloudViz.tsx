"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/requestTimeout";
import { X } from "lucide-react";

const NICKNAME_STORAGE_KEY = "lastRecordNickname";

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

function colorForWord(word: string): string {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
  return WORD_COLORS[h % WORD_COLORS.length];
}

type RecordRow = { note: string; created_at: string };

function tokenize(text: string): string[] {
  return text
    .replace(/[\s.,!?;:'"()[\]{}\-\u3000-\u303f\uff00-\uffef]+/g, " ")
    .split(" ")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2);
}

function buildWordCounts(notes: string[]): { text: string; value: number }[] {
  const map = new Map<string, number>();
  for (const note of notes) {
    for (const word of tokenize(note)) {
      map.set(word, (map.get(word) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 22)
    .map(([text, value]) => ({ text, value }));
}

/** 빈도(총합 대비 10~30%)로 폰트 크기, 글자 수 많으면 약간 축소해 가독성 확보 */
function fontSizeFromShare(value: number, totalSum: number, wordLength: number): number {
  if (totalSum <= 0) return 14;
  const share = value / totalSum;
  const clamped = Math.max(0.1, Math.min(0.3, share));
  let size = 12 + clamped * 36;
  if (wordLength > 6) size *= 0.85;
  if (wordLength > 10) size *= 0.9;
  return Math.round(Math.max(11, Math.min(24, size)));
}

function WordCloudPanel({
  words,
  title,
  emptyMessage,
  onKeywordClick,
}: {
  words: { text: string; value: number }[];
  title: string;
  emptyMessage: string;
  onKeywordClick?: (keyword: string) => void;
}) {
  type WordItem = { text: string; value: number; index: number; type: "word" };
  type DecoItem = { text: string; value: number; index: number; type: "deco" };
  const { totalSum, items } = useMemo(() => {
    const total = words.reduce((s, w) => s + w.value, 0);
    const withDeco: (WordItem | DecoItem)[] = words.map((w, i) => ({ ...w, index: i, type: "word" as const }));
    const decoCount = Math.min(2, Math.max(0, Math.floor(words.length / 6)));
    for (let i = 0; i < decoCount; i++) {
      withDeco.push({
        text: i % 2 === 0 ? "감" : "응",
        value: total > 0 ? Math.max(1, Math.floor(total * 0.05)) : 1,
        index: words.length + i,
        type: "deco",
      });
    }
    return { totalSum: total, items: withDeco };
  }, [words]);

  if (words.length === 0) {
    return (
      <div className="flex-1 min-w-0 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
        <p className="text-xs text-slate-500 mb-2">{title}</p>
        <p className="text-slate-500 text-xs">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
      <p className="text-xs text-slate-500 mb-2">{title}</p>
      <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1.5 min-h-[120px] max-h-[200px] overflow-hidden rounded-md py-1">
        {items.map((w, i) => {
          const size = fontSizeFromShare(w.value, totalSum, w.text.length);
          const isDeco = w.type === "deco";
          const color = isDeco ? "var(--deep-violet)" : colorForWord(w.text);
          const clickable = !isDeco && onKeywordClick;
          return (
            <span
              key={isDeco ? `deco-${i}` : w.text}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onKeywordClick(w.text) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") onKeywordClick(w.text);
                    }
                  : undefined
              }
              className={`transition select-none shrink-0 ${clickable ? "cursor-pointer hover:opacity-90" : ""}`}
              style={{
                fontSize: `${size}px`,
                lineHeight: 1.3,
                color,
                opacity: isDeco ? 0.9 : 1,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

type Props = { lastRecordNickname?: string };

export default function WordCloudViz({ lastRecordNickname = "" }: Props) {
  const [allNotes, setAllNotes] = useState<string[]>([]);
  const [myNotes, setMyNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [effectiveNickname, setEffectiveNickname] = useState("");
  const [keywordModal, setKeywordModal] = useState<{
    keyword: string;
    records: RecordRow[];
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    const nick = (lastRecordNickname || "").trim();
    if (nick) {
      setEffectiveNickname(nick);
      return;
    }
    if (typeof window !== "undefined") {
      const stored = (localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "").trim();
      setEffectiveNickname(stored);
    }
  }, [lastRecordNickname]);

  const fetchAll = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    try {
      const res = await withTimeout(
        Promise.resolve(client.from("awakenings").select("note").limit(80))
      ) as { data: { note: string }[] | null };
      setAllNotes((res.data ?? []).map((r) => r.note));
    } catch {
      setAllNotes([]);
    }
  }, []);

  const fetchMy = useCallback(async () => {
    const client = supabase;
    if (!client || !effectiveNickname) {
      setMyNotes([]);
      return;
    }
    try {
      const res = await withTimeout(
        Promise.resolve(client.from("awakenings").select("note").eq("nickname", effectiveNickname))
      ) as { data: { note: string }[] | null };
      setMyNotes((res.data ?? []).map((r) => r.note));
    } catch {
      setMyNotes([]);
    }
  }, [effectiveNickname]);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    const load = async () => {
      await fetchAll();
      await fetchMy();
      setLoading(false);
    };
    load();
  }, [effectiveNickname, fetchAll, fetchMy]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("wordcloud")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "awakenings" },
        (payload) => {
          const n = (payload.new as { note?: string; nickname?: string })?.note;
          const nick = (payload.new as { nickname?: string })?.nickname;
          if (n) {
            setAllNotes((prev) => [n, ...prev].slice(0, 80));
            if (nick && nick.trim() === effectiveNickname) {
              setMyNotes((prev) => [n, ...prev]);
            }
          }
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [effectiveNickname]);

  const fetchRecordsByKeyword = useCallback(async (keyword: string) => {
    setKeywordModal({ keyword, records: [], loading: true });
    const client = supabase;
    if (!client || !keyword.trim()) {
      setKeywordModal((m) => (m ? { ...m, loading: false } : null));
      return;
    }
    try {
      const res = await withTimeout(
        Promise.resolve(
          client
            .from("awakenings")
            .select("note, created_at")
            .ilike("note", `%${keyword.trim()}%`)
            .limit(30)
        )
      ) as { data: RecordRow[] | null };
      const rows = res.data ?? [];
      const shuffled = [...rows].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, 5);
      setKeywordModal({ keyword, records: picked, loading: false });
    } catch {
      setKeywordModal((m) => (m ? { ...m, records: [], loading: false } : null));
    }
  }, []);

  if (!supabase) return null;
  if (loading) {
    return (
      <div className="py-4 text-center text-slate-500 text-sm">워드클라우드 로딩 중...</div>
    );
  }

  const allWords = buildWordCounts(allNotes);
  const myWords = buildWordCounts(myNotes);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <WordCloudPanel
          words={myWords}
          title="자신의 실시간 상태"
          emptyMessage="자신의 기록이 쌓이면 키워드가 표시됩니다."
          onKeywordClick={fetchRecordsByKeyword}
        />
        <WordCloudPanel
          words={allWords}
          title="전체 참여자 실시간 현황"
          emptyMessage="자각 기록이 쌓이면 단어 구름이 표시됩니다."
          onKeywordClick={fetchRecordsByKeyword}
        />
      </div>

      {/* 키워드 클릭 시 해당 키워드가 포함된 기록 최대 5건 표시 */}
      {keywordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-slate-200">
                &quot;{keywordModal.keyword}&quot; 포함 기록 (최대 5건)
              </h3>
              <button
                type="button"
                onClick={() => setKeywordModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto flex-1">
              {keywordModal.loading ? (
                <p className="text-slate-500 text-sm">불러오는 중...</p>
              ) : keywordModal.records.length === 0 ? (
                <p className="text-slate-500 text-sm">해당 키워드가 포함된 기록이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {keywordModal.records.map((r, i) => (
                    <li
                      key={`${r.created_at}-${i}`}
                      className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50"
                    >
                      <p className="text-sm text-slate-200 break-words">{r.note}</p>
                      <time className="text-xs text-slate-500 mt-1 block">
                        {new Date(r.created_at).toLocaleString("ko-KR")}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
