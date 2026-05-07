export const dynamic = "force-dynamic";

async function getVersion() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/version`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load version");
  return (await res.json()) as Record<string, unknown>;
}

export default async function VersionPage() {
  const data = await getVersion();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">버전(로컬 확인)</h1>
        <p className="text-sm text-zinc-500">
          이 페이지는 로컬에서 “현재 실행 중인 빌드”를 빠르게 확인하기 위한
          화면입니다.
        </p>
        <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100 overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
        <p className="text-sm text-zinc-500">
          API 직접 확인: <a className="underline" href="/api/version">/api/version</a>
        </p>
      </div>
    </main>
  );
}

