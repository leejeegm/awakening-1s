"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error?.message ?? "알 수 없는 오류";
  const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100">
      <h1 className="text-xl font-bold text-red-400 mb-2">오류가 발생했습니다</h1>
      <p className="text-slate-400 text-sm mb-4 text-center max-w-md">
        페이지를 불러오는 중 문제가 생겼습니다. 아래 버튼으로 다시 시도하거나 메인으로 돌아가 보세요.
      </p>
      {(message || isDev) && (
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-400 mb-2"
        >
          {showDetail ? "오류 내용 접기" : "오류 내용 보기"}
        </button>
      )}
      {showDetail && (
        <pre className="text-left text-xs text-slate-500 bg-slate-900 rounded p-3 mb-4 max-w-md overflow-auto max-h-32">
          {message}
        </pre>
      )}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 min-h-[44px] rounded-lg bg-gradient-to-r from-deep-violet to-electric-blue text-white font-medium touch-manipulation"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="px-4 py-2 min-h-[44px] rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 font-medium touch-manipulation inline-flex items-center justify-center"
        >
          메인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
