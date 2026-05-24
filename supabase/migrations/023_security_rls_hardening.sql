-- 보안 강화: anon 클라이언트의 민감 테이블 직접 접근 차단 (서버 API + service role만)

-- participant_keys: 비밀번호 해시 노출 방지
drop policy if exists "Allow public select participant_keys" on public.participant_keys;
drop policy if exists "Allow public insert participant_keys" on public.participant_keys;

-- ai_generated_content: 타인 AI 생성문 읽기 방지
drop policy if exists "Allow public read ai_content" on public.ai_generated_content;
drop policy if exists "Allow service insert ai_content" on public.ai_generated_content;

-- awakenings: API 모더레이션 우회 INSERT 방지
drop policy if exists "Allow public insert" on public.awakenings;

-- experiment_control: anon UPDATE 방지
drop policy if exists "Allow service update experiment_control" on public.experiment_control;
create policy "Allow service role update experiment_control"
  on public.experiment_control for update
  to service_role
  using (true)
  with check (true);

-- participant_profiles: anon 쓰기 방지 (읽기는 통계용 유지)
drop policy if exists "Allow insert and update profiles" on public.participant_profiles;

comment on table public.participant_keys is '닉네임별 비밀번호 해시 — 서버 API 전용 (RLS anon 차단)';
