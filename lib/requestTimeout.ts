const DEFAULT_MS = 8000;

/** Promise가 지정 시간 안에 끝나지 않으면 reject. 느린 네트워크에서 무한 대기 방지. */
export function withTimeout<T>(promise: Promise<T>, ms: number = DEFAULT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), ms)
    ),
  ]);
}
