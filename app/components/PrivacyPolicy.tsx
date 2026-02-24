"use client";

import { useState } from "react";
import { X } from "lucide-react";

const POLICY_TEXT = `
간이 개인정보 처리방침

1. 수집 항목
- 닉네임(익명), 성별(남, 여, 보류), 연령대(13세 이하, 14-16세, 17-19세, 20대, 30대, 40대, 50대, 60대, 70대 이상, 보류), 자각 기록(한 줄 텍스트 등)만 수집합니다.
- 실명, 전화번호, 이메일 등 개인식별 정보는 수집하지 않습니다.

2. 이용 목적
- '자깨초시' 1.00초 자각 실험 데이터 축적 및 공명 게이지·타임라인 표시용으로만 이용합니다.

3. 보관 기간
- 서비스 운영 기간 동안 보관하며, 법령에 따른 보존 의무가 있는 경우 해당 기간 준수 후 파기할 수 있습니다.

4. 제3자 제공
- 제공하지 않습니다.

5. 문의
- 서비스 내 문의 채널을 통해 요청하시면 됩니다.

6. AI 생성 콘텐츠
- AI가 생성한 맞춤 감응카드, 따뜻한 한마디, 주별 감정 요약 등은 개인정보와 무관합니다. 서비스 개선 및 시간의 흐름에 따른 연관성·성별·연령대 기반 맞춤 멘트 제공을 위해 저장·활용할 수 있습니다.
`;

export default function PrivacyPolicy() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-400 underline hover:text-electric-blue transition"
      >
        간이 개인정보 처리방침
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="font-semibold text-slate-100">개인정보 처리방침</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-slate-700"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto text-sm text-slate-300 whitespace-pre-line">
              {POLICY_TEXT.trim()}
            </div>
            <div className="p-4 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full py-2 rounded-lg bg-gradient-resonans text-white font-medium"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
