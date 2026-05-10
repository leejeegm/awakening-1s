$ErrorActionPreference = "Stop"

param(
  [int]$Port = 3000,
  [string]$Nickname = "test",
  [ValidateSet("1s","10s","100s")]
  [string]$DurationType = "1s",
  # 주별 보고서: 일요일(YYYY-MM-DD)
  [string]$Week = "2026-02-23"
)

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host ("=" * 72)
  Write-Host $Title
  Write-Host ("=" * 72)
}

function Get-Json([string]$Url) {
  Invoke-RestMethod -Method GET -Uri $Url -TimeoutSec 15
}

$base = "http://localhost:$Port"

Write-Section "0) 서버 헬스 체크"
try {
  $v = Get-Json "$base/api/version"
  Write-Host "OK: dev 서버가 응답합니다."
  $v | ConvertTo-Json -Depth 10
} catch {
  Write-Host "FAIL: $base 가 응답하지 않습니다."
  Write-Host "  - dev 서버가 떠 있는지 확인: npm run dev -- -p $Port"
  Write-Host "  - 포트가 다르면 -Port 값 변경: .\scripts\check-local.ps1 -Port 3001"
  throw
}

Write-Section "1) 따뜻한 한마디 (warm-message) — message/source 확인"
try {
  $warm = Get-Json "$base/api/ai/warm-message?nickname=$([uri]::EscapeDataString($Nickname))&durationType=$DurationType"
  $warm | ConvertTo-Json -Depth 10
  if ($warm.source -eq "rule") {
    Write-Host "NOTE: Gemini 미동작/실패 등 → 룰베이스 대체(source=rule)"
  } elseif ($warm.source -eq "gemini") {
    Write-Host "NOTE: Gemini 1차 제공(10s·100s 또는 OpenAI 미설정 시)"
  }
} catch {
  Write-Host "FAIL: warm-message 호출 실패"
  throw
}

Write-Section "2) 감응 인사이트 (insight) — card/source 확인"
try {
  $insight = Get-Json "$base/api/ai/insight?nickname=$([uri]::EscapeDataString($Nickname))"
  $insight | ConvertTo-Json -Depth 10
  if ($insight.source -eq "rule") {
    Write-Host "NOTE: Gemini 실패 등 → 룰베이스 대체(source=rule)"
  } elseif ($insight.source -eq "gemini") {
    Write-Host "NOTE: 샘플에 1s 기록 없음 → Gemini만 사용(정밀 없음)"
  }
} catch {
  Write-Host "FAIL: insight 호출 실패"
  throw
}

Write-Section "3) 주별 보고서 (weekly) — sentimentSource 확인"
try {
  $weekly = Get-Json "$base/api/report/weekly?nickname=$([uri]::EscapeDataString($Nickname))&week=$([uri]::EscapeDataString($Week))"
  $weekly | ConvertTo-Json -Depth 10
  if ($weekly.sentimentSource -eq "rule") {
    Write-Host "NOTE: Gemini 실패 등 → 룰베이스 대체(sentimentSource=rule)"
  } elseif ($weekly.sentimentSource -eq "gemini") {
    Write-Host "NOTE: 해당 주에 1s 기록 없음 또는 OpenAI 미설정 → Gemini 요약"
  }
} catch {
  Write-Host "FAIL: weekly 호출 실패"
  throw
}

Write-Host ""
Write-Host "DONE."

