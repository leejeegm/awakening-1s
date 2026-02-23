"use client";

const WON_PER_ATTEMPT = 100;

export default function DonationCalculator({ attempts }: { attempts: number }) {
  const amount = attempts * WON_PER_ATTEMPT;

  return (
    <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
      <p className="text-sm text-slate-400 mb-1">기부 예상액</p>
      <p className="text-2xl font-bold text-electric-blue">
        내 시도 {attempts}회 × {WON_PER_ATTEMPT}원 ={" "}
        <span className="text-white">{amount.toLocaleString()}원</span>
      </p>
    </div>
  );
}
