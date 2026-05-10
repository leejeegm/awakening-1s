# GPT(OpenAI) API 키 발급 및 세팅 — AI 감정 분석·인사이트 활성화

## Gemini와 역할 분담 (먼저 읽기)

이 프로젝트는 **`GEMINI_*` 로 1차 요약·분류**를 하고, **`OPENAI_API_KEY`(GPT‑4o)는 제한적으로** 씁니다.

| 구간 | 1차 | GPT‑4o 정밀 |
|------|-----|-------------|
| 따뜻한 한마디, 인사이트 카드, 주간 감정 요약 | Gemini(실패 시 룰베이스) | 표본·해당 주에 **`1s` 기록 포함** 시에만 |
| **공개** 기록 검수 | 패턴 차단 후 Gemini JSON 분류 | Gemini **실패** 시 폴백, 또는 Gemini가 **`warn`** 이고 사용자가 **`1s` 공개**일 때만 |

그래서 **Gemini 없이 OpenAI만** 넣어도 동작은 하지만(Gemini 단계 실패 후 OpenAI로 넘어감), 비용·지연을 줄이려면 **Gemini도 함께 설정**하는 것을 권장합니다.

---

## 1단계: OpenAI 계정 준비

1. **회원가입/로그인**
   - 브라우저에서 [https://platform.openai.com](https://platform.openai.com) 접속
   - **Sign up** 또는 **Log in** (Google/Apple/이메일)

2. **결제 수단 등록 (필수)**
   - 왼쪽 메뉴 **Settings** → **Billing** → **Add payment method**
   - 카드 등록 후 **Usage limits**에서 월 한도 설정 권장 (예: $5)

---

## 2단계: API 키 발급

1. **API Keys 페이지 이동**
   - [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys) 접속  
   - 또는 로그인 후 왼쪽 메뉴 **API keys** 클릭

2. **새 키 만들기**
   - **Create new secret key** 클릭
   - 이름 입력 (예: `awakening-1s`) → **Create secret key**

3. **키 복사**
   - **sk-proj-...** 로 시작하는 키가 한 번만 표시됨  
   - **Copy** 로 복사 후 안전한 곳에 붙여넣기 (다시 볼 수 없음)

---

## 3단계: 프로젝트에 환경 변수 세팅

### 로컬 개발 (localhost)

1. 프로젝트 루트의 **`.env.local`** 파일 열기  
   - 없으면 **`.env.local.example`** 을 복사해 **`.env.local`** 로 저장

2. 아래 한 줄 추가 또는 주석 해제 후 키 붙여넣기:
   ```env
   OPENAI_API_KEY=sk-proj-여기에_복사한_키_붙여넣기
   ```

3. **저장 후 개발 서버 재시작**
   ```bash
   npm run dev
   ```

### Vercel 배포

1. [Vercel 대시보드](https://vercel.com/dashboard) → 해당 프로젝트 선택  
2. **Settings** → **Environment Variables**  
3. **Add New**  
   - **Name:** `OPENAI_API_KEY`  
   - **Value:** 발급한 API 키 (sk-proj-...)  
   - **Environment:** Production, Preview, Development 원하는 것 선택  
4. **Save** 후 **Redeploy** (Deployments → ⋮ → Redeploy)

---

## 4단계: 기능 확인

`OPENAI_API_KEY` 가 있으면 아래처럼 **조건부**로 GPT‑4o가 붙습니다(전 구간 무조건 호출은 아님).

| 기능 | 위치 | GPT‑4o가 쓰이는 경우(요약) |
|------|------|---------------------------|
| 따뜻한 한마디 | 감응 성장 카드 안 | 해당 요청 찰이 **`1s`** 이고 Gemini 1차를 거친 뒤 **정밀 다듬기** |
| **AI 인사이트 카드** | 메인 | 최근 표본 안에 **`1s` 기록**이 있으면 카드 문구 보강 |
| **주별 감정 요약** | 주별 보고서 | 그 주 데이터에 **`1s` 기록**이 있으면 요약 보강 |
| **공개 기록 검수** | 저장 API | Gemini 실패 시 폴백, 또는 **1s 공개 + Gemini가 warn** |

- 키가 **없으면**: 위 “정밀” 단계는 건너뛰고, Gemini 또는 룰베이스 결과만 사용됩니다.

---

## 주의사항

- **API 키는 외부에 노출하지 마세요.** `.env.local`은 Git에 올리지 않음 (기본 `.gitignore` 포함)
- **Vercel**에서는 반드시 **Environment Variables**에만 입력하고, 코드에는 넣지 마세요.
- 사용량은 [Usage](https://platform.openai.com/usage)에서 확인 가능합니다.
