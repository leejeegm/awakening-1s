"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import { Lock, X } from "lucide-react";

type AwakeningRow = Database["public"]["Tables"]["awakenings"]["Row"];
type KeyRow = Database["public"]["Tables"]["participant_keys"]["Row"];

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Props = {
  /** 내 기록 보기로 조회 성공 시: 닉네임 + 비밀번호 해시(서버 이미지 등 인증용) */
  onNicknameVerified?: (nickname: string, authHash: string) => void;
  /** 현재 로그인(기록 저장) 중인 닉네임이 있으면 모달 입력 기본값으로 노출 */
  defaultNickname?: string;
};

export default function MyRecordsView({ onNicknameVerified, defaultNickname = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [hint, setHint] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [records, setRecords] = useState<AwakeningRow[]>([]);

  const resolveDefaultNickname = () =>
    (defaultNickname ?? "").trim() ||
    (typeof window !== "undefined" ? (localStorage.getItem("lastRecordNickname") ?? "").trim() : "");

  const handleOpen = () => {
    const current = resolveDefaultNickname();
    if (current) setNickname(current);
    setOpen(true);
  };

  const onLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nickname.trim();
    const p = password.trim();
    const pc = passwordConfirm.trim();
    if (!n || !p) {
      setMessage("닉네임과 비밀번호를 모두 입력해 주세요.");
      setStatus("error");
      return;
    }
    if (!supabase) {
      setMessage("Supabase가 설정되지 않았습니다.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const hash = await sha256Hex(p);
      const { data: keyRow } = await supabase
        .from("participant_keys")
        .select("password_hash, password_hint")
        .eq("nickname", n)
        .maybeSingle() as { data: KeyRow | null };

      if (!keyRow) {
        if (p !== pc) {
          setMessage("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
          setStatus("error");
          return;
        }
        await supabase.from("participant_keys").insert({
          nickname: n,
          password_hash: hash,
          password_hint: hint.trim() || null,
        } as never);
      } else if (keyRow.password_hash !== hash) {
        setMessage(
          keyRow.password_hint
            ? `비밀번호가 일치하지 않습니다. 힌트: ${keyRow.password_hint}`
            : "비밀번호가 일치하지 않습니다. 처음 조회 시 입력한 비밀번호를 사용해 주세요."
        );
        setStatus("error");
        return;
      }

      const feedRes = await fetch(
        `/api/feed/awakenings?nickname=${encodeURIComponent(n)}&authHash=${encodeURIComponent(hash)}`,
        { method: "GET" }
      );
      const feedJson = (await feedRes.json().catch(() => ({}))) as { items?: AwakeningRow[] };
      const items = Array.isArray(feedJson.items) ? (feedJson.items as AwakeningRow[]) : [];
      setRecords(items);
      setStatus("ok");
      onNicknameVerified?.(n, hash);
    } catch {
      setMessage("오류가 발생했습니다.");
      setStatus("error");
    }
  };

  const close = () => {
    setOpen(false);
    setStatus("idle");
    setMessage("");
    setRecords([]);
    setPassword("");
    setPasswordConfirm("");
    setHint("");
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-deep-violet/60 hover:bg-deep-violet text-white font-semibold text-[12px] transition"
      >
        <Lock className="w-4 h-4" />
        내 자각 실험 결과 보기(닉네임 비번 설정)
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-[min(96vw,40rem)] min-w-[17rem] min-h-[14rem] max-w-[98vw] max-h-[95vh] overflow-hidden flex flex-col resize both">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-[12px] font-bold text-slate-100">내 자각 실험 결과 보기(닉네임 비번 설정)</h3>
              <button
                type="button"
                onClick={close}
                className="p-1 rounded hover:bg-slate-700"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <p className="text-[12px] text-slate-500">
                닉네임과 비밀번호를 입력하면 해당 닉네임으로 기록한 누적 자각 목록을 볼 수 있습니다. 처음 조회 시 입력한 비밀번호가 해당 닉네임에 저장됩니다. 잊지 마세요. 비밀번호 힌트를 넣어두면 비밀번호를 잊었을 때 힌트가 표시됩니다. 모서리를 드래그하면 창 크기를 조절할 수 있습니다.
              </p>
              <form onSubmit={onLookup} className="space-y-3">
                <input
                  type="text"
                  placeholder="닉네임"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={20}
                  className="w-full px-4 py-2.5 min-h-[44px] rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:border-electric-blue outline-none text-base touch-manipulation"
                />
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 min-h-[44px] rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:border-electric-blue outline-none text-base touch-manipulation"
                />
                <input
                  type="password"
                  placeholder="비밀번호 확인 (처음 조회 시에만 사용)"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full px-4 py-2.5 min-h-[44px] rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:border-electric-blue outline-none text-base touch-manipulation"
                />
                <input
                  type="text"
                  placeholder="비밀번호 힌트 (선택, 처음 조회 시만 저장됨)"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  maxLength={30}
                  className="w-full px-4 py-2 min-h-[44px] rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:border-electric-blue outline-none text-base touch-manipulation"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full min-h-[44px] py-2.5 rounded-lg bg-gradient-resonans text-white font-medium disabled:opacity-60 touch-manipulation"
                >
                  {status === "loading" ? "조회 중..." : "조회"}
                </button>
              </form>
              {message && (
                <p className={`text-[12px] ${status === "error" ? "text-red-400" : "text-slate-400"}`}>
                  {message}
                </p>
              )}
              {status === "ok" && (
                <div>
                  <p className="text-[12px] text-slate-400 mb-2">
                    총 {records.length}건
                  </p>
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {records.map((item) => (
                      <li
                        key={item.id}
                        className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-[12px]"
                      >
                        <time className="text-[12px] text-slate-500">
                          {new Date(item.created_at).toLocaleString("ko-KR")}
                        </time>
                        <p className="mt-1 text-slate-300 break-words">{item.note}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
