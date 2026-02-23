"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 24, background: "#0f172a", color: "#e2e8f0", fontFamily: "sans-serif" }}>
        <div style={{ maxWidth: 400, margin: "40px auto", textAlign: "center" }}>
          <h1 style={{ color: "#f87171", fontSize: "1.25rem" }}>오류가 발생했습니다</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem", marginTop: 8, marginBottom: 24 }}>
            앱을 불러오는 중 문제가 생겼습니다. 새로고침해 보세요.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              background: "linear-gradient(135deg, #4C1D95, #2563EB)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            새로고침
          </button>
        </div>
      </body>
    </html>
  );
}
