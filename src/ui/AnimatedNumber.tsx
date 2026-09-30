import { useEffect, useState } from 'react';
import type { Locale } from '../core/types';
export function AnimatedNumber({ value, locale, digits = 0 }: { value: number; locale: Locale; digits?: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(value); return; }
    setDisplay(0);
    const start = performance.now() + 800;
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.max(0, Math.min(1, (time - start) / 1150));
      setDisplay(value * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const format = (n: number) => new Intl.NumberFormat(locale, {minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n);
  return <span aria-label={format(value)}><span aria-hidden="true">{format(display)}</span></span>;
}
