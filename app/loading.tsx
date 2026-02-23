export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-400">
      <p className="text-lg font-medium text-slate-300">자깨초시</p>
      <p className="mt-2 text-sm">불러오는 중...</p>
      <div className="mt-4 w-8 h-8 border-2 border-electric-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
