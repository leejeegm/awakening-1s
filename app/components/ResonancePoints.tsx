"use client";

const POINTS_PER_RECORD = 100;

type Props = {
  /** 닉네임별 내가 제출한 기록 건수 (DB 기준) */
  myRecordCount: number;
  /** 모든 닉네임 참여자 기록 총합 (DB 기준) */
  totalRecords: number;
};

export default function ResonancePoints({ myRecordCount, totalRecords }: Props) {
  const myPoints = myRecordCount * POINTS_PER_RECORD;
  const totalPoints = totalRecords * POINTS_PER_RECORD;
  const hasTotal = totalRecords > 0;

  return (
    <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-4">
      <p className="text-sm font-medium text-slate-400">자신을 깨우는 감응 포인트</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-600/50 text-center">
          <p className="text-xs text-slate-500 mb-0.5">내 누적 포인트</p>
          <p className="text-xl font-bold text-electric-blue">
            {myPoints.toLocaleString()}
            <span className="text-sm font-normal text-slate-400 ml-0.5">포인트</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">기록 {myRecordCount}건 × {POINTS_PER_RECORD}포인트</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-600/50 text-center">
          <p className="text-xs text-slate-500 mb-0.5">참여자 전체 누적 포인트</p>
          <p className="text-xl font-bold text-deep-violet">
            {hasTotal ? (
              <>
                {totalPoints.toLocaleString()}
                <span className="text-sm font-normal text-slate-400 ml-0.5">포인트</span>
              </>
            ) : (
              <span className="text-sm font-normal text-slate-500">집계 중</span>
            )}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasTotal
              ? `전체 기록 ${totalRecords}건 × ${POINTS_PER_RECORD}포인트`
              : "전체 기록 집계 중"}
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-700 space-y-1.5 text-xs text-slate-400">
        <p>· 자신의 누적 포인트는 자신의 기록 보상입니다.</p>
        <p>· 포인트를 후원하면, 50%는 시스템 운영에, 50%는 참여자 초청 행사에 사용 예정입니다.</p>
      </div>
    </div>
  );
}
