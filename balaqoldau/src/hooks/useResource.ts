import { useCallback, useEffect, useState } from 'react';
export function useResource<T>(key: string, loader: (key: string, signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; data: T | null; error: Error | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    loader(key, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, attempt, data, error: null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, attempt, data: null, error: error instanceof Error ? error : new Error('Деректер жүктелмеді.') });
    });
    return () => controller.abort();
  }, [key, attempt, loader]);
  const current = result?.key === key && result.attempt === attempt ? result : null;
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { data: current?.data ?? null, error: current?.error ?? null, loading: !current, retry };
}
