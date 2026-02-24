"use client";

import { useState } from "react";
import { X } from "lucide-react";

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
  onSubmit: (nickname: string, note: string, gender?: GenderType | null, ageGroup?: AgeGroupType | null) => Promise<void>;
  submitStatus: "idle" | "loading" | "done" | "error";
  errorMessage: string | null;
};

export default function RecordModal({
  open,
  duration,
  onClose,
  onSubmit,
  submitStatus,
  errorMessage,
}: Props) {
  const [nickname, setNickname] = useState("");
  const [note, setNote] = useState("");
  const [gender, setGender] = useState<GenderType | "">("defer");
  const [ageGroup, setAgeGroup] = useState<AgeGroupType | "">("defer");

  const limit = LIMITS[duration];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nickname.trim();
    const t = note.trim();
    if (!n || !t) return;
    await onSubmit(
      n,
      t,
      gender === "" ? null : gender,
      ageGroup === "" ? null : ageGroup
    );
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
          <p className="text-sm text-electric-blue font-medium">{limit.label}</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="닉네임 (익명)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="w-full px-4 py-2.5 min-h-[44px] rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:border-electric-blue outline-none text-base touch-manipulation"
            />
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
            <button
              type="submit"
              disabled={submitStatus === "loading"}
              className="w-full min-h-[44px] py-2.5 rounded-lg bg-gradient-resonans text-white font-medium disabled:opacity-60 touch-manipulation"
            >
              {submitStatus === "loading" ? "저장 중..." : submitStatus === "done" ? "저장됨" : "기록하기"}
            </button>
          </form>
          {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
        </div>
      </div>
    </div>
  );
}
