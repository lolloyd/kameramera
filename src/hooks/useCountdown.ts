'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useCountdown() {
  const [value, setValue] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const resolver = useRef<((done: boolean) => void) | null>(null);

  const cancel = useCallback(() => {
    clearInterval(timer.current);
    setValue(null);
    resolver.current?.(false);
    resolver.current = null;
  }, []);

  /** Resolves true when the countdown finishes, false if cancelled. */
  const start = useCallback(
    (seconds: number) =>
      new Promise<boolean>((resolve) => {
        cancel();
        resolver.current = resolve;
        let n = seconds;
        setValue(n);
        timer.current = setInterval(() => {
          n -= 1;
          if (n <= 0) {
            clearInterval(timer.current);
            setValue(null);
            resolver.current = null;
            resolve(true);
          } else {
            setValue(n);
          }
        }, 1000);
      }),
    [cancel],
  );

  useEffect(() => cancel, [cancel]);

  return { value, start, cancel };
}
