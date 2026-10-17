import { useCallback, useEffect, useState } from 'react';

/** Seconds-left counter for "Resend code" buttons. start(n) restarts it; it stops at 0. */
export function useCountdown() {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return undefined;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const start = useCallback((seconds = 60) => setLeft(seconds), []);
  const label = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;

  return { left, label, start };
}

export const OTP_RESEND_SECONDS = 60;
