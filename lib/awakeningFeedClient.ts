/** 서버 피드 API로 목록 조회 (RLS 우회·공개/비공개 정책 일관) */
export type AwakeningFeedItem = {
  id: string;
  created_at: string;
  nickname: string | null;
  note: string;
  duration_type?: string;
  is_public?: boolean;
  resonance_kind?: string | null;
  resonance_kind_ai?: string | null;
};

export async function fetchPublicAwakeningFeed(limit = 60): Promise<AwakeningFeedItem[]> {
  const res = await fetch("/api/feed/awakenings", { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { items?: AwakeningFeedItem[] };
  return Array.isArray(json.items) ? json.items : [];
}

export async function fetchNicknameAwakeningFeed(
  nickname: string,
  authHash?: string
): Promise<AwakeningFeedItem[]> {
  const nick = nickname.trim().slice(0, 20);
  if (!nick) return [];
  const params = new URLSearchParams({ nickname: nick });
  if (authHash?.trim()) params.set("authHash", authHash.trim());
  const res = await fetch(`/api/feed/awakenings?${params}`, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { items?: AwakeningFeedItem[] };
  return Array.isArray(json.items) ? json.items : [];
}

export function notesFromFeedItems(items: AwakeningFeedItem[]): string[] {
  return items.map((r) => r.note).filter(Boolean);
}
