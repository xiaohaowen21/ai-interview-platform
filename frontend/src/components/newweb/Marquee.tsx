import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface MarqueeProps {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children: ReactNode;
  vertical?: boolean;
  repeat?: number;
  ariaLabel?: string;
  ariaLive?: 'off' | 'polite' | 'assertive';
  ariaRole?: string;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ariaLabel,
  ariaLive = 'off',
  ariaRole = 'marquee',
}: MarqueeProps) {
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const repeats = useMemo(() => Array.from({ length: repeat }, (_, index) => index), [repeat]);

  return (
    <div
      ref={marqueeRef}
      data-slot="marquee"
      className={cn(
        'group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem] [gap:var(--gap)]',
        vertical ? 'flex-col' : 'flex-row',
        className
      )}
      aria-label={ariaLabel}
      aria-live={ariaLive}
      role={ariaRole}
      tabIndex={0}
    >
      {repeats.map((index) => (
        <div
          key={index}
          className={cn(
            vertical ? 'animate-marquee-vertical flex-col [gap:var(--gap)]' : 'animate-marquee flex-row [gap:var(--gap)]',
            'flex shrink-0 justify-around',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
            reverse && '[animation-direction:reverse]'
          )}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
