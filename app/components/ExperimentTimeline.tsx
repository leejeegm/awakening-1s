"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/requestTimeout";
import type { Database } from "@/types/supabase";
import { Sparkles } from "lucide-react";

type Row = Database["public"]["Tables"]["awakenings"]["Row"];
type ReactionRow = Database["public"]["Tables"]["reactions"]["Row"];

type Props = { lastRecordNickname?: string };

type ReactionCounts = Record<string, { gam: number; eung: number }>;

export default function ExperimentTimeline({ lastRecordNickname = "" }: Props) {
  const [list, setList] = useState<Row[]>([]);
  const [myList, setMyList] = useState<Row[]>([]);
  const [reactions, setReactions] = useState<ReactionCounts>({});
  const [top10, setTop10] = useState<{ id: string; note: string; created_at: string; gam: number; eung: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadErrorState] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "top10">("list");

  const fetchList = async () => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    setLoadErrorState(false);
    setLoading(true);
    try {
      const res = await withTimeout(
        Promise.resolve(
          client
            .from("awakenings")
            .select("id, created_at, nickname, note")
            .order("created_at", { ascending: false })
            .limit(60)
        )
      ) as { data: Row[] | null; error: unknown };
      const { data, error } = res;
      if (error) {
        setLoadErrorState(true);
        setList([]);
        return;
      }
      setList((data ?? []) as Row[]);
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

  const fetchTop10 = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    const counts = await fetchReactions();
    if (!counts) return;
    const sorted = Object.entries(counts)
      .map(([id, c]) => ({ id, total: c.gam + c.eung, ...c }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((e) => e.id);
    if (sorted.length === 0) {
      setTop10([]);
      return;
    }
    let data: unknown = null;
    try {
      const res = await withTimeout(
        Promise.resolve(client.from("awakenings").select("id, note, created_at").in("id", sorted))
      ) as { data: { id: string; note: string; created_at: string }[] | null };
      data = res.data;
    } catch {
      setTop10([]);
      return;
    }
    const byId = Object.fromEntries(((data ?? []) as { id: string; note: string; created_at: string }[]).map((r) => [r.id, r]));
    const withCounts = sorted
      .map((id) => {
        const row = byId[id];
        const c = counts[id] ?? { gam: 0, eung: 0 };
        return row ? { ...row, gam: c.gam, eung: c.eung } : null;
      })
      .filter(Boolean) as { id: string; note: string; created_at: string; gam: number; eung: number }[];
    setTop10(withCounts);
  }, [fetchReactions]);

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    fetchReactions();
    fetchTop10();
  }, [fetchReactions, fetchTop10]);

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
            nickname: raw.nickname,
            note: raw.note,
            duration_type: raw.duration_type ?? "1s",
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
          fetchReactions().then(fetchTop10);
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [fetchReactions, fetchTop10]);

  useEffect(() => {
    const interval = setInterval(() => {
      setViewMode((m) => (m === "list" ? "top10" : "list"));
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const [reactionFeedback, setReactionFeedback] = useState<{ id: string } | null>(null);

  const addReaction = async (awakeningId: string, type: "gam" | "eung") => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from("reactions").insert({ awakening_id: awakeningId, reaction_type: type } as never);
    if (!error) {
      setReactionFeedback({ id: awakeningId });
      fetchReactions();
      fetchTop10();
      setTimeout(() => setReactionFeedback(null), 1600);
    }
  };

  useEffect(() => {
    const client = supabase;
    if (!client || !lastRecordNickname.trim()) {
      setMyList([]);
      return;
    }
    const fetchMyList = async () => {
      try {
        const res = await withTimeout(
          Promise.resolve(
            client
              .from("awakenings")
              .select("id, created_at, nickname, note")
              .eq("nickname", lastRecordNickname.trim())
              .order("created_at", { ascending: false })
              .limit(100)
          )
        ) as { data: Row[] | null; error: unknown };
        const { data, error } = res;
        if (!error) setMyList((data ?? []) as Row[]);
        else setMyList([]);
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

  const renderFullList = (
    items: Row[],
    title: string,
    emptyMessage: string,
    options?: { onlyShowMyNickname?: string; hideReactionButtons?: (item: Row) => boolean }
  ) => {
    const myNick = options?.onlyShowMyNickname?.trim() ?? "";
    const showNickname = (nick: string) => !myNick || nick.trim() === myNick;
    const hideReactions = options?.hideReactionButtons ?? (() => false);
    return (
      <div className="mb-4">
        <h3 className="text-xs font-medium text-slate-500 mb-2">{title}</h3>
        {reactionLegend}
        {items.length === 0 ? (
          <p className="py-4 text-center text-slate-500 text-sm">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3 max-h-56 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50"
              >
                <div className="flex justify-between items-start gap-2">
                  {showNickname(item.nickname) ? (
                    <span className="font-medium text-electric-blue shrink-0">{item.nickname}</span>
                  ) : (
                    <span className="shrink-0" />
                  )}
                  <time className="text-xs text-slate-500 shrink-0">
                    {new Date(item.created_at).toLocaleString("ko-KR")}
                  </time>
                </div>
                <p className="mt-1 text-sm text-slate-300 break-words">{item.note}</p>
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

  const renderTop10 = () => (
    <div className="mb-4">
      <h3 className="text-xs font-medium text-slate-500 mb-2">상위 반응 탑10 (실시간)</h3>
      {reactionLegend}
      {top10.length === 0 ? (
        <p className="py-4 text-center text-slate-500 text-sm">아직 반응이 없습니다. 감·응을 눌러 보세요.</p>
      ) : (
        <ul className="space-y-3 max-h-56 overflow-y-auto">
          {top10.map((item) => (
            <li
              key={item.id}
              className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50"
            >
              <p className="text-sm text-slate-300 break-words">{item.note}</p>
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

  return (
    <div>
      {lastRecordNickname.trim() && (
        <>
          {renderFullList(
            myList,
            "내 자각 실험 결과 (실시간)",
            "이 닉네임으로 남긴 기록이 없습니다.",
            { hideReactionButtons: () => true }
          )}
          {viewMode === "list"
            ? renderFullList(
                list,
                "전체 실험 데이터 (실시간)",
                "아직 기록이 없습니다. 첫 자각을 남겨보세요.",
                {
                  onlyShowMyNickname: lastRecordNickname,
                  hideReactionButtons: (item) => item.nickname?.trim() === lastRecordNickname.trim(),
                }
              )
            : renderTop10()}
        </>
      )}
      {!lastRecordNickname.trim() && (
        <>
          {list.length === 0 ? (
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
              {viewMode === "list"
                ? renderFullList(
                    list,
                    "전체 실험 데이터 (실시간)",
                    "아직 기록이 없습니다.",
                    {
                      onlyShowMyNickname: lastRecordNickname,
                      hideReactionButtons: (item) => item.nickname?.trim() === lastRecordNickname.trim(),
                    }
                  )
                : renderTop10()}
            </>
          )}
        </>
      )}
    </div>
  );
}
