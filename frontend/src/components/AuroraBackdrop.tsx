import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

interface AuroraBackdropProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
  radialGradient?: boolean;
}

const auroraVars = {
  '--aurora':
    'repeating-linear-gradient(100deg, #3b82f6 10%, #a5b4fc 15%, #93c5fd 20%, #ddd6fe 25%, #60a5fa 30%)',
  '--dark-gradient':
    'repeating-linear-gradient(100deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%)',
  '--white-gradient':
    'repeating-linear-gradient(100deg, #fff 0%, #fff 7%, transparent 10%, transparent 12%, #fff 16%)',
  '--blue-300': '#93c5fd',
  '--blue-400': '#60a5fa',
  '--blue-500': '#3b82f6',
  '--indigo-300': '#a5b4fc',
  '--violet-200': '#ddd6fe',
  '--white': '#fff',
  '--black': '#000',
  '--transparent': 'transparent',
} as CSSProperties;

export default function AuroraBackdrop({
  children,
  className = '',
  radialGradient = true,
  ...props
}: AuroraBackdropProps) {
  return (
    <div
      className={cn(
        'transition-bg relative overflow-hidden bg-zinc-50 text-slate-950 dark:bg-zinc-900',
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          style={auroraVars}
          className={cn(
            'pointer-events-none absolute -inset-[10px] opacity-50 blur-[10px] invert filter will-change-transform dark:invert-0',
            '[background-image:var(--white-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%]',
            'after:absolute after:inset-0 after:[background-attachment:fixed] after:[background-image:var(--white-gradient),var(--aurora)] after:[background-size:200%,_100%] after:[animation:aurora_60s_linear_infinite] after:mix-blend-difference after:content-[\'\']',
            'dark:[background-image:var(--dark-gradient),var(--aurora)] dark:after:[background-image:var(--dark-gradient),var(--aurora)]',
            radialGradient && '[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]',
          )}
        />
      </div>
      {children}
    </div>
  );
}
