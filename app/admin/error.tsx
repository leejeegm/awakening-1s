"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen px-6 py-10 bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-semibold">관리자 화면 오류</h1>
        <p className="text-sm text-slate-400">
          관리자 페이지를 불러오는 중 문제가 발생했습니다. 다시 시도하거나 메인으로 돌아가 주세요.
        </p>
        {process.env.NODE_ENV === "development" && (
          <pre className="rounded-lg bg-slate-900 p-3 text-xs text-red-300 overflow-auto">{error.message}</pre>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-electric-blue text-white text-sm"
          >
            다시 시도
          </button>
          <a href="/" className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm">
            메인으로
          </a>
        </div>
      </div>
    </main>
  );
}
