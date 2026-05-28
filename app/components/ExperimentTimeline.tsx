"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/requestTimeout";
import type { Database } from "@/types/supabase";
import { Sparkles } from "lucide-react";
import ResonanceKindBadge from "./ResonanceKindBadge";

type Row = Omit<Database["public"]["Tables"]["awakenings"]["Row"], "nickname"> & {
  nickname: string | null;
  resonance_kind?: string | null;
  resonance_kind_ai?: string | null;
};
type ReactionRow = Database["public"]["Tables"]["reactions"]["Row"];

type Props = { lastRecordNickname?: string };

type ReactionCounts = Record<string, { gam: number; eung: number }>;

type TopReactionRow = {
  id: string;
  note: string;
  created_at: string;
  gam: number;
  eung: number;
  resonance_kind?: string | null;
  resonance_kind_ai?: string | null;
};

/** 자동 전환: 내 자각 ↔ 탑20 (닉네임 있음) 또는 전체 ↔ 탑20 (없음). 감·응 차트는 별도 섹션 */
type TimelineViewMode = "my" | "top20" | "list";

const VIEW_ROTATE_MS = 100_000;

function pickRandomRotateView(current: TimelineViewMode, pool: TimelineViewMode[]): TimelineViewMode {
  const candidates = pool.filter((m) => m !== current);
  if (candidates.length === 0) return pool[0] ?? current;
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

export default function ExperimentTimeline({ lastRecordNickname = "" }: Props) {
  const hasNickname = !!lastRecordNickname.trim();

  const [list, setList] = useState<Row[]>([]);
  const [myList, setMyList] = useState<Row[]>([]);
  const [reactions, setReactions] = useState<ReactionCounts>({});
  const [top20, setTop20] = useState<TopReactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadErrorState] = useState(false);
  const [viewMode, setViewMode] = useState<TimelineViewMode>(() => (hasNickname ? "my" : "list"));
  const [rotatePaused, setRotatePaused] = useState(false);

  const fetchList = async () => {
    setLoadErrorState(false);
    setLoading(true);
    try {
      const res = await withTimeout(fetch("/api/feed/awakenings"), 12000);
      const json = (await res.json().catch(() => ({}))) as { items?: Row[] };
      setList(Array.isArray(json.items) ? (json.items as Row[]) : []);
    } catch {
      setLoadErrorState(true);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchReactions = useCallback(async () => {
    const client = supabase;
    if (!client) return undefined;
    try {
      const res = await withTimeout(
        Promise.resolve(client.from("reactions").select("awakening_id, reaction_type"))
      ) as { data: Pick<ReactionRow, "awakening_id" | "reaction_type">[] | null };
      const { data } = res;
      const counts: ReactionCounts = {};
      for (const r of (data ?? []) as Pick<ReactionRow, "awakening_id" | "reaction_type">[]) {
        if (!counts[r.awakening_id]) counts[r.awakening_id] = { gam: 0, eung: 0 };
        if (r.reaction_type === "gam") counts[r.awakening_id].gam += 1;
        else if (r.reaction_type === "eung") counts[r.awakening_id].eung += 1;
      }
      setReactions(counts);
      return counts;
    } catch {
      return undefined;
    }
  }, []);

  const fetchTop20 = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    const counts = await fetchReactions();
    if (!counts) return;
    const sorted = Object.entries(counts)
      .map(([id, c]) => ({ id, total: c.gam + c.eung, ...c }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map((e) => e.id);
    if (sorted.length === 0) {
      setTop20([]);
      return;
    }
    let data: unknown = null;
    try {
      const res = await withTimeout(
        Promise.resolve(
          client
            .from("awakenings")
            .select("id, note, created_at, resonance_kind, resonance_kind_ai")
            .in("id", sorted)
        )
      ) as {
        data:
          | {
              id: string;
              note: string;
              created_at: string;
              resonance_kind?: string | null;
              resonance_kind_ai?: string | null;
            }[]
          | null;
      };
      data = res.data;
    } catch {
      setTop20([]);
      return;
    }
    const byId = Object.fromEntries(
      (
        (data ?? []) as {
          id: string;
          note: string;
          created_at: string;
          resonance_kind?: string | null;
          resonance_kind_ai?: string | null;
        }[]
      ).map((r) => [r.id, r])
    );
    const withCounts = sorted
      .map((id) => {
        const row = byId[id];
        const c = counts[id] ?? { gam: 0, eung: 0 };
        return row ? { ...row, gam: c.gam, eung: c.eung } : null;
      })
      .filter(Boolean) as TopReactionRow[];
    setTop20(withCounts);
  }, [fetchReactions]);

  const selectViewMode = useCallback((mode: TimelineViewMode) => {
    setViewMode(mode);
    setRotatePaused(false);
  }, []);

  useEffect(() => {
    setViewMode(hasNickname ? "my" : "list");
  }, [hasNickname]);

  const pauseRotate = useCallback(() => {
    setRotatePaused(true);
  }, []);

  useEffect(() => {
    fetchList();
  }, []);

  // 클라이언트 RLS/Realtime 제약과 무관하게 “기존처럼” 흐르게 하기 위해 주기적으로 갱신
  useEffect(() => {
    const t = setInterval(fetchList, 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchReactions();
    fetchTop20();
  }, [fetchReactions, fetchTop20]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("awakenings")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "awakenings" },
        (payload) => {
        const raw = payload.new as Record<string, unknown>;
          const item = {
            id: raw.id,
            created_at: raw.created_at,
          nickname: null,
            note: raw.note,
            duration_type: raw.duration_type ?? "1s",
            resonance_kind: (raw.resonance_kind as string | null) ?? null,
            resonance_kind_ai: (raw.resonance_kind_ai as string | null) ?? null,
          } as Row;
          setList((prev) => [item, ...prev].slice(0, 60));
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("reactions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reactions" },
        () => {
          fetchReactions().then(fetchTop20);
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [fetchReactions, fetchTop20]);

  useEffect(() => {
    if (rotatePaused) return;
    const pool: TimelineViewMode[] = hasNickname ? ["my", "top20"] : ["list", "top20"];
    const interval = setInterval(() => {
      setViewMode((current) => pickRandomRotateView(current, pool));
    }, VIEW_ROTATE_MS);
    return () => clearInterval(interval);
  }, [rotatePaused, hasNickname]);

  const [reactionFeedback, setReactionFeedback] = useState<{ id: string } | null>(null);

  const addReaction = async (awakeningId: string, type: "gam" | "eung") => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from("reactions").insert({ awakening_id: awakeningId, reaction_type: type } as never);
    if (!error) {
      setReactionFeedback({ id: awakeningId });
      fetchReactions();
      fetchTop20();
      setTimeout(() => setReactionFeedback(null), 1600);
    }
  };

  useEffect(() => {
    if (!lastRecordNickname.trim()) {
      setMyList([]);
      return;
    }
    const fetchMyList = async () => {
      try {
        // (간이) 내 목록은 우선 공개만 보여주고, "자각 기록 보기"에서 비밀번호 확인 후 전체 목록을 봅니다.
        const res = await withTimeout(
          fetch(`/api/feed/awakenings?nickname=${encodeURIComponent(lastRecordNickname.trim())}`),
          12000
        );
        const json = (await res.json().catch(() => ({}))) as { items?: Row[] };
        setMyList(Array.isArray(json.items) ? (json.items as Row[]) : []);
      } catch {
        setMyList([]);
      }
    };
    fetchMyList();
  }, [lastRecordNickname]);

  useEffect(() => {
    const client = supabase;
    if (!client || !lastRecordNickname.trim()) return;
    const channel = client
      .channel("my-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "awakenings" },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          if ((raw.nickname as string)?.trim() !== lastRecordNickname.trim()) return;
          const item = {
            id: raw.id,
            created_at: raw.created_at,
            nickname: raw.nickname,
            note: raw.note,
            duration_type: raw.duration_type ?? "1s",
            resonance_kind: (raw.resonance_kind as string | null) ?? null,
            resonance_kind_ai: (raw.resonance_kind_ai as string | null) ?? null,
          } as Row;
          setMyList((prev) => [item, ...prev].slice(0, 100));
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [lastRecordNickname]);

  if (!supabase) {
    return (
      <div className="py-6 text-center text-slate-500 text-sm">
        .env.local에 Supabase URL과 키를 설정하면 타임라인이 표시됩니다.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-6 text-center text-slate-500 text-sm">로딩 중...</div>
    );
  }

  if (loadError) {
    return (
      <div className="py-6 text-center">
        <p className="text-slate-500 text-sm mb-1">데이터를 불러오지 못했습니다.</p>
        <p className="text-slate-600 text-xs mb-3">연결이 느리면 잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={fetchList}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const reactionLegend = (
    <p className="text-xs text-slate-500 mb-2">
      <span className="text-electric-blue">감</span>: 긍정적으로 느낌이 들 때 ·{" "}
      <span className="text-deep-violet">응</span>: 구독하고 싶은 마음이 들 때
    </p>
  );

  const viewModeTabs = (
    <div className="flex flex-wrap items-center gap-2 mb-2" onPointerDown={pauseRotate}>
      {hasNickname && (
        <button
          type="button"
          onClick={() => selectViewMode("my")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            viewMode === "my"
              ? "bg-electric-blue/25 text-electric-blue border-electric-blue/40"
              : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
          }`}
        >
          내 자각 (실시간)
        </button>
      )}
      <button
        type="button"
        onClick={() => selectViewMode("top20")}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
          viewMode === "top20"
            ? "bg-deep-violet/25 text-deep-violet border-deep-violet/40"
            : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
        }`}
      >
        상위 반응 탑20 (실시간)
      </button>
      <button
        type="button"
        onClick={() => selectViewMode("list")}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
          viewMode === "list"
            ? "bg-slate-600/40 text-slate-200 border-slate-500/50"
            : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
        }`}
      >
        전체 리스트
      </button>
      {rotatePaused ? (
        <span className="text-[11px] text-amber-300">자동 전환 일시정지 (탭 선택 시 해제)</span>
      ) : (
        <span className="text-[11px] text-slate-600">
          {hasNickname
            ? "100초마다 내 자각 ↔ 탑20 랜덤 전환 (전체·감·응 차트 제외)"
            : "100초마다 전체 ↔ 탑20 랜덤 전환"}
        </span>
      )}
    </div>
  );

  const renderFullList = (
    items: Row[],
    title: string,
    emptyMessage: string,
    options?: {
      onlyShowMyNickname?: string;
      hideReactionButtons?: (item: Row) => boolean;
      showViewTabs?: boolean;
    }
  ) => {
    const myNick = options?.onlyShowMyNickname?.trim() ?? "";
    // 공개 피드에서는 nickname을 null로 내려 익명 유지
    const showNickname = (nick: string | null) => !!nick && (!myNick || nick.trim() === myNick);
    const hideReactions = options?.hideReactionButtons ?? (() => false);
    const showViewTabs = options?.showViewTabs ?? false;
    return (
      <div className="mb-4" onPointerDown={showViewTabs ? pauseRotate : undefined}>
        <h3 className="text-xs font-medium text-slate-500 mb-2">{title}</h3>
        {showViewTabs && viewModeTabs}
        {reactionLegend}
        {items.length === 0 ? (
          <p className="py-4 text-center text-slate-500 text-sm">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3 max-h-56 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50"
                onPointerDown={pauseRotate}
              >
                <div className="flex justify-between items-start gap-2">
                  {showNickname(item.nickname) ? (
                    <span className="font-medium text-electric-blue shrink-0">{item.nickname}</span>
                  ) : (
                    <span className="text-xs text-slate-600 shrink-0">익명</span>
                  )}
                  <time className="text-xs text-slate-500 shrink-0">
                    {new Date(item.created_at).toLocaleString("ko-KR")}
                  </time>
                </div>
                <p className="mt-1 text-sm text-slate-300 break-words">{item.note}</p>
                <ResonanceKindBadge
                  resonanceKind={item.resonance_kind}
                  resonanceKindAi={item.resonance_kind_ai}
                  className="mt-1.5"
                />
                {!hideReactions(item) && (
                  <div className="mt-2 flex gap-2 items-center relative">
                    <button
                      type="button"
                      onClick={() => addReaction(item.id, "gam")}
                      className="text-xs min-h-[44px] min-w-[44px] px-3 py-2 rounded bg-slate-700 text-slate-300 hover:bg-electric-blue/20 touch-manipulation"
                      title="긍정적으로 느낌이 들 때"
                    >
                      감
                    </button>
                    <button
                      type="button"
                      onClick={() => addReaction(item.id, "eung")}
                      className="text-xs min-h-[44px] min-w-[44px] px-3 py-2 rounded bg-slate-700 text-slate-300 hover:bg-deep-violet/20 touch-manipulation"
                      title="구독하고 싶은 마음이 들 때"
                    >
                      응
                    </button>
                    {reactionFeedback?.id === item.id && (
                      <span className="reaction-feedback-float text-deep-violet font-bold text-sm animate-reaction-blink">
                        감응
                      </span>
                    )}
                  </div>
                )}
            </li>
          ))}
        </ul>
      )}
    </div>
    );
  };

  const renderTop20 = () => (
    <div className="mb-4" onPointerDown={pauseRotate}>
      <h3 className="text-xs font-medium text-slate-500 mb-2">상위 반응 탑20 (실시간)</h3>
      {reactionLegend}
      {top20.length === 0 ? (
        <p className="py-4 text-center text-slate-500 text-sm">아직 반응이 없습니다. 감·응을 눌러 보세요.</p>
      ) : (
        <ul className="space-y-3 max-h-56 overflow-y-auto">
          {top20.map((item) => (
            <li
              key={item.id}
              className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50"
              onPointerDown={pauseRotate}
            >
              <p className="text-sm text-slate-300 break-words">{item.note}</p>
              <ResonanceKindBadge
                resonanceKind={item.resonance_kind}
                resonanceKindAi={item.resonance_kind_ai}
                className="mt-1.5"
              />
              <div className="mt-2 flex gap-2 items-center relative">
                <button
                  type="button"
                  onClick={() => addReaction(item.id, "gam")}
                  className="text-xs min-h-[44px] min-w-[44px] px-3 py-2 rounded bg-slate-700 text-slate-300 hover:bg-electric-blue/20 touch-manipulation"
                  title="긍정적으로 느낌이 들 때"
                >
                  감
                </button>
                <button
                  type="button"
                  onClick={() => addReaction(item.id, "eung")}
                  className="text-xs min-h-[44px] min-w-[44px] px-3 py-2 rounded bg-slate-700 text-slate-300 hover:bg-deep-violet/20 touch-manipulation"
                  title="구독하고 싶은 마음이 들 때"
                >
                  응
                </button>
                {reactionFeedback?.id === item.id && (
                  <span className="reaction-feedback-float text-deep-violet font-bold text-sm animate-reaction-blink">
                    감응
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderActivePanel = () => {
    if (viewMode === "my") {
      return renderFullList(myList, "내 자각 실험 결과 (실시간)", "이 닉네임으로 남긴 기록이 없습니다.", {
        hideReactionButtons: () => true,
      });
    }
    if (viewMode === "top20") {
      return renderTop20();
    }
    return renderFullList(
      list,
      "전체 실험 데이터 (실시간)",
      hasNickname ? "아직 기록이 없습니다. 첫 자각을 남겨보세요." : "아직 기록이 없습니다.",
      {
        onlyShowMyNickname: lastRecordNickname,
        hideReactionButtons: (item) => item.nickname?.trim() === lastRecordNickname.trim(),
      }
    );
  };

  return (
    <div>
      {list.length === 0 && !hasNickname && myList.length === 0 ? (
        <button
          type="button"
          onClick={() => document.getElementById("record-section")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="w-full py-8 text-center text-slate-500 text-sm hover:text-slate-300 transition rounded-xl border border-dashed border-slate-600 hover:border-slate-500"
        >
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <span className="block">아직 기록이 없습니다. 첫 자각을 남겨보세요.</span>
          <span className="block mt-1 text-xs text-slate-600">클릭하면 기록하기로 이동</span>
        </button>
      ) : (
        <>
          <div className="mb-2">{viewModeTabs}</div>
          {renderActivePanel()}
        </>
      )}
    </div>
  );
}
