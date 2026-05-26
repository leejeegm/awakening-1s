# 자깨초시 (Self-Awakening 1.00s)

뇌가 외부 자극을 인지하는 1.00초의 각성을 포착하는 Life Operation System MVP.

## 기술 스택

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Icons:** Lucide-react
- **DB:** Supabase (PostgreSQL)
- **Deploy:** Vercel (PWA 지원)

## 로컬 실행

```bash
# 의존성 설치
npm install

# 환경 변수: .env.local.example 을 복사해 .env.local 생성 후 Supabase 값 입력
cp .env.local.example .env.local

# 개발 서버
npm run dev

# 휴대폰에서 같은 Wi‑Fi로 접속하려면 (PC IP:3000으로 접속)
npm run dev:mobile
```

### 휴대폰에서 로그인(접속)하기

휴대폰에서 **관리자 로그인** 또는 **참여자(내 기록 보기) 로그인**을 쓰려면, 먼저 휴대폰이 같은 Wi‑Fi에 있어야 합니다.

1. **PC에서 개발 서버를 휴대폰 접속용으로 실행**
   ```bash
   npm run dev:mobile
   ```
2. **PC의 IP 주소 확인**
   - **Windows:** 명령 프롬프트에서 `ipconfig` → "IPv4 주소" (예: 192.168.0.5)
   - **Mac/Linux:** 터미널에서 `ifconfig` 또는 `ip addr` → 해당 Wi‑Fi의 주소
3. **휴대폰 브라우저에서 접속**
   - 메인(참여·기록): `http://<PC의IP>:3000` (예: `http://192.168.0.5:3000`)
   - 관리자 로그인: `http://<PC의IP>:3000/admin` (예: `http://192.168.0.5:3000/admin`)
4. **로그인**
   - **관리자:** `/admin` 페이지에서 `ADMIN_SECRET` 비밀번호 입력 후 로그인
   - **참여자:** 메인에서 "내 기록 보기"로 들어가 닉네임·비밀번호 입력 후 조회

배포된 사이트(예: Vercel)라면 휴대폰에서 `https://도메인` 또는 `https://도메인/admin`으로 접속하면 됩니다. 별도 설정 없이 동일하게 로그인할 수 있습니다.

## Supabase 설정

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/001_awakenings.sql` ~ `006_participant_plans.sql` 순서대로 실행
3. Settings → API에서 URL과 anon key를 복사해 `.env.local`에 입력  
4. **실시간 타임라인/게이지:** Database → Replication에서 `awakenings` 테이블을 Realtime용으로 활성화

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 감응 시도 X 버튼 이미지

감응 시도 버튼에 사용할 이미지는 `public/resonance-x.jpg` 로 두면 됩니다.  
(예: 프로젝트 루트의 `20260223_감응 엑스도(칼라).jpg` 를 `public/resonance-x.jpg` 로 복사)  
없으면 기본 X 아이콘이 표시됩니다.

## PWA 아이콘 (선택)

모바일 홈 화면 추가 시 아이콘을 쓰려면 다음 파일을 추가하세요.

- `public/icons/icon-192.png` (192×192)
- `public/icons/icon-512.png` (512×512)

없어도 앱은 동작하며, 브라우저 기본 아이콘이 사용됩니다.

## 관리자 기능 (기록 삭제/수정)

미풍양속·욕설·비방·협박·정치·종교 등 문제가 있는 기록만 삭제 또는 수정할 수 있는 **관리자 전용** 기능입니다.

### 관리자 페이지 확인 방법

1. **주소 입력:** 브라우저에서 **`/admin`** 경로로 이동합니다.  
   - 로컬: `http://localhost:3000/admin`  
   - 배포 사이트: `https://your-domain.com/admin`
2. **로그인:** 화면에 나오는 입력창에 `.env.local`에 설정한 **`ADMIN_SECRET`** 비밀번호를 입력한 뒤 **로그인** 버튼을 누릅니다.
3. **기록 관리:** 로그인 후 목록에서 삭제 또는 수정할 기록을 선택해 처리합니다. 조치 내역은 Supabase `admin_actions` 테이블에 저장됩니다.

### 설정 절차

1. **Supabase:** SQL Editor에서 `supabase/migrations/005_admin_actions.sql` 실행 (조치 로그 테이블 생성).
2. **환경 변수:** `.env.local`에 추가  
   - `SUPABASE_SERVICE_ROLE_KEY`: Dashboard → Settings → API → **service_role** (비공개 유지)  
   - `ADMIN_SECRET`: 관리자 로그인 비밀번호 (강한 비밀번호 권장)
3. **공정성:** 삭제/수정 시마다 `admin_actions` 테이블에 누가·무엇을·언제 했는지 로그됩니다. (Supabase Dashboard에서 확인 가능)

## 배포 (Vercel) — 무료 플랜

Vercel 무료 플랜으로 이 프로젝트를 배포하는 **순서별 셋팅 과정**입니다. (예시는 프로젝트 이름 `awakening-1s`, GitHub 사용자 `myusername` 기준입니다.)

---

### 1단계: GitHub에 코드 올리기

**1-1. GitHub 계정**  
- [github.com](https://github.com) 에서 로그인(또는 회원가입).

**1-2. 새 저장소 만들기**  
- 우측 상단 **+** → **New repository**  
- Repository name: `awakening-1s` (원하는 이름)  
- Public 선택, **Create repository** 클릭.

**1-2-1. 저장소 주소(URL) 찾는 방법**  
만든 저장소를 로컬에서 연결하려면 **저장소 URL**이 필요합니다.

1. **GitHub 웹에서 저장소 열기**  
   - [github.com](https://github.com) 로그인 → 우측 상단 프로필 아이콘 옆 **Your repositories** 클릭  
   - 또는 상단 검색창에 저장소 이름(예: `awakening-1s`) 입력 후 본인 저장소 클릭  
   - 주소창에 보이는 URL이 저장소 페이지입니다. 예: `https://github.com/myusername/awakening-1s`

2. **Clone용 URL 복사**  
   - 저장소 페이지에서 초록색 **Code** 버튼 클릭  
   - **HTTPS** 탭에서 나오는 주소 복사 (예: `https://github.com/myusername/awakening-1s.git`)  
   - 이 주소를 로컬에서 `git remote add origin (여기에붙여넣기)` 할 때 사용합니다.

3. **로컬에서 이미 연결돼 있는지 확인**  
   프로젝트 폴더에서 터미널/PowerShell을 열고:
   ```bash
   git remote -v
   ```
   - 아무것도 안 나오면 → 아직 원격 저장소가 없음. 아래 1-3에서 `git remote add origin (URL)` 로 연결.  
   - `origin  https://github.com/...` 가 나오면 → 이미 연결됨. `git push -u origin main` 만 하면 됨.

4. **연결이 잘못됐거나 주소를 바꾸고 싶을 때**  
   ```bash
   git remote remove origin
   git remote add origin https://github.com/본인아이디/저장소이름.git
   ```

**1-3. 로컬 프로젝트를 Git으로 올리기**  
프로젝트 폴더(`awakening-1s`)에서 터미널(또는 PowerShell) 실행:

```bash
# Git 초기화 (이미 되어 있으면 생략)
git init

# 모든 파일 스테이징
git add .

# 첫 커밋
git commit -m "Initial commit: 자깨초시 MVP"

# GitHub 저장소 연결 (아래 주소는 본인 저장소 URL로 바꾸기)
git remote add origin https://github.com/myusername/awakening-1s.git

# main 브랜치로 푸시
git branch -M main
git push -u origin main
```

- `myusername` → 본인 GitHub 아이디, `awakening-1s` → 방금 만든 저장소 이름으로 바꿉니다.  
- GitHub에서 저장소를 만들 때 "Add .gitignore" 등으로 초기 파일을 만들었다면, 위에서 `git pull origin main --rebase` 후 `git push` 할 수 있습니다.

---

### 2단계: Vercel 가입 및 프로젝트 Import

**2-1. Vercel 가입**  
- [vercel.com](https://vercel.com) 접속 → **Sign Up**  
- **Continue with GitHub** 선택 → GitHub 권한 허용 (무료 플랜으로 진행).

**2-2. 새 프로젝트 만들기**  
- 대시보드에서 **Add New…** → **Project**  
- **Import Git Repository**에서 방금 푸시한 저장소(`myusername/awakening-1s`)가 보이면 **Import** 클릭.

**2-3. 프로젝트 설정 화면**  
- **Project Name:** 그대로 두거나 원하는 이름 (예: `awakening-1s`)  
- **Framework Preset:** Next.js (자동 감지됨)  
- **Root Directory:** 비워 두기 (프로젝트 루트가 맞을 때)  
- **Build and Output Settings:** 기본값 유지  
- 이 단계에서는 **Deploy** 를 누르지 말고, 다음 단계에서 환경 변수 먼저 넣습니다.

---

### 3단계: 환경 변수 넣기 (배포 전에 설정 권장)

**3-1. 환경 변수 화면**  
- 같은 페이지에서 **Environment Variables** 섹션 펼치기.  
- 또는 배포 후 **프로젝트 → Settings → Environment Variables** 에서 추가해도 됩니다.

**3-2. 변수 추가 예시**

| Name | Value | 비고 |
|------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefgh.supabase.co` | Supabase 대시보드 → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | 같은 화면의 anon public key |

- **Key** 란에 위 Name, **Value** 란에 실제 값을 붙여넣기.  
- **Environment** 는 **Production** (필요하면 Preview도 체크).  
- **Add** 로 하나씩 추가.

**관리자 기능 사용 시 추가:**

| Name | Value |
|------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `ADMIN_SECRET` | 관리자 로그인에 쓸 비밀번호 (본인이 정한 값) |

**AI 인사이트 사용 시 추가:**

| Name | Value |
|------|--------|
| `GEMINI_API_KEY` 또는 `GEMINI_JAKKAE_API_KEY` | Google Gemini 키 (**1차 필터·요약**). 없으면 해당 구간은 룰베이스로 대체합니다. |
| `GEMINI_MODEL` | (선택) 예: `gemini-2.5-flash`. 미설정 시 `gemini-2.5-flash` (1.5-flash는 API 종료됨). |
| `OPENAI_API_KEY` | OpenAI 키 (**정밀 진단**용). `1.00초(1s)` 컨텍스트가 있을 때만 GPT-4o를 추가 호출합니다. |

---

### 4단계: 배포 실행

**4-1. Deploy**  
- **Deploy** 버튼 클릭.  
- 빌드 로그가 나오며 1~2분 정도 걸릴 수 있습니다.

**4-2. 배포 완료**  
- 성공 시 **Visit** 또는 **Go to Dashboard** 로 이동.  
- 배포 URL 예: `https://awakening-1s.vercel.app`  
- 이 주소로 접속해 메인·기록·관리자(`/admin`) 동작을 확인합니다.

**4-3. (선택) 커스텀 도메인**  
- **Project → Settings → Domains** 에서 본인 도메인 추가 가능 (무료 플랜에서도 1개 등 등 제한 있음).

---

### 5단계: 수정 후 다시 배포 (재배포)

코드만 바꾼 경우:

```bash
git add .
git commit -m "예: 워드클라우드 훅 오류 수정"
git push origin main
```

- 푸시하면 Vercel이 **자동으로 새 배포**를 시작합니다.  
- **Deployments** 탭에서 진행 상황과 최종 URL을 확인할 수 있습니다.

환경 변수만 바꾼 경우:

- **Settings → Environment Variables** 에서 수정 후 저장.  
- **Deployments** → 최신 배포 옆 **⋯** → **Redeploy** 로 같은 코드를 새 환경 변수로 다시 배포합니다.

---

### 무료 플랜 참고

- Hobby(무료) 플랜: 개인 프로젝트용, 빌드/대역폭 제한 있음.  
- 상세 한도: [Vercel 요금제](https://vercel.com/pricing) 에서 확인.

---

### 처음 한 번 배포 요약

1. GitHub에 저장소 만들고 `git push`  
2. Vercel 가입( GitHub 연동 ) → **Add New → Project** → 저장소 **Import**  
3. **Environment Variables** 에 Supabase URL·anon key 등 입력  
4. **Deploy** → 완료 후 `https://프로젝트이름.vercel.app` 접속

## 기록 한도 (닉네임별, 0시 KST 기준)

- **기본(텍스트만) 무료:** 10회/일
- **초°설계자:** 720회/월 · 7,200원/월
- **분°설계자:** 1,000회/월 (이미지 280컷 포함) · 9,900원/월
- **시°설계자:** 1,000회/년 (이미지 280컷 + 멤버십) · 1,000,000원/년

유료 플랜은 `participant_plans` 테이블에 닉네임·플랜·만료일을 넣으면 적용됩니다. 무료는 해당 행이 없으면 10회/일로 제한됩니다.

## AI 감응 인사이트 (선택)

기록 데이터 기반 **따뜻한 한마디·맞춤 감응 카드·주간 감정 요약** 등은 **먼저 Gemini로 1차 요약**합니다.  
표본(또는 해당 주) 안에 **결정적 찰나(`1s`) 기록이 포함**되어 있고 `OPENAI_API_KEY`가 있으면, 그때만 **GPT-4o로 정밀 보강**합니다.  
Gemini 키가 없거나 실패하면 **룰베이스 문구**로 대체됩니다.

**공개 기록 검수:** 먼저 룰 기반 차단 후 **Gemini로 1차 분류**합니다. 텍스트 파싱 실패 시 OpenAI로 재시도합니다.  
Gemini가 **`warn`(애매함)** 이면 **`1s` 찰나로 공개 저장한 경우에만** GPT-4o로 재판정합니다.  
운영에서 AI 없이는 공개를 막고 싶다면 환경 변수 **`MODERATION_STRICT_NO_AI=true`** — 룰 통과 후에도 Gemini·OpenAI 분류를 받지 못하면 공개가 차단됩니다(기본은 `false`).

## 주별 1페이지 보고서 (AI 감정 요약)

**주별 마지막날(일요일) 0시 KST** 기준으로, 선택한 닉네임의 해당 주간 기록을 AI 감정 분석해 1페이지 분량으로 보여 줍니다.

### API 설계

- **엔드포인트:** `GET /api/report/weekly`
- **쿼리:** `nickname`(필수), `week`(YYYY-MM-DD, 그 주 일요일), `download`(0=보기, 1=PDF 다운로드)
- **보기(download=0):** JSON 반환 — `weekLabel`, `recordCount`, `records`, `sentimentSummary`, `keywordSummary`, `canDownload`
- **다운로드(download=1):** 유료 플랜(초°·분°·시°설계자)인 경우에만 PDF 파일 반환. 무료는 401/403 처리 없이 JSON만 제공되며 `canDownload: false`

### 화면 동작

- 메인 페이지 **「주별 1페이지 보고서」** 섹션에서 **닉네임**·**주(일요일 날짜)** 선택 후 **보고서 보기** 클릭 → 같은 주간 기록·AI 감정 요약·키워드(빈도순) 표시.
- **유료 플랜** 닉네임이면 **PDF 다운로드** 버튼이 보이고, 클릭 시 1페이지 PDF가 저장됨.
- **무료**는 화면에서 보기만 가능하고, PDF 다운로드 버튼은 비표시(또는 “유료 플랜에서 다운로드 가능” 문구).

### 의존성

- **OPENAI_API_KEY:** 감정 요약 문구 생성에 사용. 미설정 시 요약란에 안내 문구만 표시.
- **jspdf:** PDF 생성. `npm install jspdf` 후 사용.

## 기능 요약

- **Landing:** 1.00초 자각·감응 철학 노출
- **자각 버튼:** 1.00s° 타이머 + 감응 파동 애니메이션
- **입력:** 닉네임(익명) + 한 줄 자각 기록 (실명/번호 미수집), 닉네임별 일/월/년 한도 적용
- **감응 성장 문구:** "감응 시도가 누적될수록 감응하는 인간으로 성장중입니다." + 음성(TTS) 동기부여
- **실험 데이터:** Supabase 실시간 타임라인
- **공명 게이지:** 좌우·상하 파동 애니메이션, 클릭/터치 시 내 누적·전체 참여자 누적 건 표시
- **감응 포인트:** 내 누적 포인트 / 참여자 전체 누적 포인트 (포인트 = 기록 보상·후원 안내)
- **AI 인사이트:** (선택) 기록 기반 감응 트렌드·맞춤 카드 뉴스
- **주별 1페이지 보고서:** 주(일요일 기준)·닉네임별 AI 감정 요약. 무료=보기만, 유료=PDF 다운로드
- **간이 개인정보 처리방침:** 하단 링크 → 팝업
