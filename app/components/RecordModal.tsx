"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  RESONANCE_ESSENCES,
  RESONANCE_KIND_NONE,
  RESONANCE_NONE_ESSENCE,
  type ResonanceKindId,
  type ResonanceKindStored,
  resonanceKindShortLabel,
} from "@/lib/resonanceEssence";

export type DurationType = "1s" | "10s" | "100s";

export type GenderType = "male" | "female" | "defer";
export type AgeGroupType =
  | "13under"
  | "14_16"
  | "17_19"
  | "20s"
  | "30s"
  | "40s"
  | "50s"
  | "60s"
  | "70over"
  | "defer";

const LIMITS: Record<DurationType, { label: string; maxLength: number }> = {
  "1s": { label: "한줄 기록하기입니다.", maxLength: 80 },
  "10s": { label: "열 단어 내외 기록하기입니다.", maxLength: 60 },
  "100s": { label: "백 자 내외 기록하기입니다.", maxLength: 100 },
};

const GENDER_OPTIONS: { value: GenderType; label: string }[] = [
  { value: "defer", label: "보류" },
  { value: "male", label: "남" },
  { value: "female", label: "여" },
];

const AGE_OPTIONS: { value: AgeGroupType; label: string }[] = [
  { value: "defer", label: "보류" },
  { value: "13under", label: "13세 이하" },
  { value: "14_16", label: "14-16세" },
  { value: "17_19", label: "17-19세" },
  { value: "20s", label: "20대" },
  { value: "30s", label: "30대" },
  { value: "40s", label: "40대" },
  { value: "50s", label: "50대" },
  { value: "60s", label: "60대" },
  { value: "70over", label: "70대 이상" },
];

type Props = {
  open: boolean;
  duration: DurationType;
  onClose: () => void;
  onSubmit: (
    nickname: string,
    note: string,
    opts?: {
      gender?: GenderType | null;
      ageGroup?: AgeGroupType | null;
      resonanceKind?: ResonanceKindStored;
      isPublic?: boolean;
    }
  ) => Promise<void>;
  submitStatus: "idle" | "loading" | "done" | "error";
  errorMessage: string | null;
  defaultPersonalNickname?: string;
  sharedNickname?: string | null;
};

export default function RecordModal({
  open,
  duration,
  onClose,
  onSubmit,
  submitStatus,
  errorMessage,
  defaultPersonalNickname = "",
  sharedNickname = null,
}: Props) {
  const [recordAs, setRecordAs] = useState<"personal" | "shared">("shared");
  const [nickname, setNickname] = useState("");
  const [note, setNote] = useState("");
  const [gender, setGender] = useState<GenderType | "">("defer");
  const [ageGroup, setAgeGroup] = useState<AgeGroupType | "">("defer");
  const [resonanceKind, setResonanceKind] = useState<ResonanceKindStored>(RESONANCE_KIND_NONE);

  const effectiveNickname = sharedNickname && recordAs === "shared" ? sharedNickname : nickname.trim();
  const showNicknameChoice = !!sharedNickname?.trim();

  useEffect(() => {
    if (open) {
      setNickname(defaultPersonalNickname ?? "");
      setRecordAs(sharedNickname?.trim() ? "shared" : "personal");
    }
  }, [open, defaultPersonalNickname, sharedNickname]);

  const limit = LIMITS[duration];

  const submit = async (isPublic: boolean) => {
    const n = effectiveNickname.slice(0, 20);
    const t = note.trim();
    if (!n || !t) return;
    await onSubmit(n, t, {
      gender: gender === "" ? null : gender,
      ageGroup: ageGroup === "" ? null : ageGroup,
      resonanceKind,
      isPublic,
    });
    setNote("");
    if (submitStatus === "done") onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-semibold text-slate-100">기록하기</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <p className="text-emphasis text-electric-blue">{limit.label}</p>
          <div className="space-y-3">
            {showNicknameChoice ? (
              <div className="space-y-2">
                <span className="block text-xs text-slate-500">기록할 닉네임</span>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recordAs"
                      checked={recordAs === "shared"}
                      onChange={() => setRecordAs("shared")}
                      className="rounded-full border-slate-500 text-electric-blue"
                    />
                    <span className="text-sm text-slate-200">감응(공동): {sharedNickname}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recordAs"
                      checked={recordAs === "personal"}
                      onChange={() => {
                        setRecordAs("personal");
                        if (!nickname.trim()) setNickname(defaultPersonalNickname ?? "");
                      }}
                      className="rounded-full border-slate-500 text-electric-blue"
                    />
                    <span className="text-sm text-slate-200">개인</span>
                  </label>
                </div>
                {recordAs === "personal" && (
                  <input
                    type="text"
                    placeholder="개인 닉네임"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={20}
                    className="w-full px-4 py-2.5 min-h-[44px] rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 text-base touch-manipulation"
                  />
                )}
                {recordAs === "personal" && !nickname.trim() && (
                  <p className="text-xs text-slate-500">개인 닉네임을 입력하세요.</p>
                )}
              </div>
            ) : (
              <input
                type="text"
                placeholder="닉네임 (익명)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                className="w-full px-4 py-2.5 min-h-[44px] rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:border-electric-blue outline-none text-base touch-manipulation"
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">성별 (선택)</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as GenderType | "")}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                >
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">연령대 (선택)</label>
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value as AgeGroupType | "")}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                >
                  {AGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <span className="block text-xs text-slate-500 mb-1.5">감응 유형 (선택·미선택도 기록 의미)</span>
              <p className="text-[10px] text-slate-600 mb-1.5 leading-relaxed">
                「미선택」으로 저장하면 기록 키워드·맥락을 바탕으로 AI가 감응 유형을 추천해 함께 남깁니다.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  title={RESONANCE_NONE_ESSENCE.essence}
                  onClick={() => setResonanceKind(RESONANCE_KIND_NONE)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border transition ${
                    resonanceKind === RESONANCE_KIND_NONE
                      ? "bg-slate-600 border-slate-500 text-slate-100"
                      : "bg-slate-800/80 border-slate-600 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  미선택
                </button>
                {RESONANCE_ESSENCES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.essence}
                    onClick={() => setResonanceKind(item.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] border transition ${
                      resonanceKind === item.id
                        ? "bg-electric-blue/25 border-electric-blue/60 text-electric-blue"
                        : "bg-slate-800/80 border-slate-600 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {resonanceKindShortLabel(item.id)}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                {resonanceKind === RESONANCE_KIND_NONE
                  ? RESONANCE_NONE_ESSENCE.essence
                  : RESONANCE_ESSENCES.find((e) => e.id === resonanceKind)?.essence}
              </p>
            </div>
            <textarea
              placeholder={
                duration === "1s"
                  ? "한 줄로 남기는 자각 기록"
                  : duration === "10s"
                    ? "열 단어 내외로 남기는 자각 기록"
                    : "백 자 내외로 남기는 자각 기록"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={limit.maxLength}
              rows={duration === "100s" ? 3 : 2}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:border-electric-blue outline-none resize-none text-base touch-manipulation"
            />
            <p className="text-xs text-slate-500">{note.length} / {limit.maxLength}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={
                  submitStatus === "loading" ||
                  (showNicknameChoice && recordAs === "personal" && !nickname.trim())
                }
                className="w-full min-h-[44px] py-2.5 rounded-lg bg-gradient-resonans text-white font-semibold text-[12px] disabled:opacity-60 touch-manipulation"
              >
                {submitStatus === "loading" ? "저장 중..." : "저장(나만보기)"}
              </button>
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={
                  submitStatus === "loading" ||
                  (showNicknameChoice && recordAs === "personal" && !nickname.trim())
                }
                className="w-full min-h-[44px] py-2.5 rounded-lg bg-deep-violet/80 hover:bg-deep-violet text-white font-semibold text-[12px] disabled:opacity-60 touch-manipulation"
              >
                {submitStatus === "loading" ? "저장 중..." : "공유저장(내글공개)"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              저장(나만보기)은 내 기록 보기로만 확인됩니다. 공유저장은 익명으로 공개될 수 있으며, 일시적 점검에 따라 공유가 제한될 수 있습니다.
            </p>
          </div>
          {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
        </div>
      </div>
    </div>
  );
}
