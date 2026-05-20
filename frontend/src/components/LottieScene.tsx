import { motion } from 'framer-motion';

interface LottieSceneProps {
  src: string;
  className?: string;
  speed?: number | string;
}

export default function LottieScene({ className, speed = 1 }: LottieSceneProps) {
  const duration = typeof speed === 'number' ? Math.max(6, 12 / Math.max(speed, 0.25)) : 12;

  return (
    <div className={`relative overflow-hidden rounded-[inherit] ${className ?? ''}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(241,245,249,0.82)_42%,_rgba(226,232,240,0.88)_100%)]" />

      <motion.div
        className="absolute left-[14%] top-[18%] h-10 w-10 rounded-full bg-white/75 shadow-[0_10px_24px_rgba(148,163,184,0.25)]"
        animate={{ y: [0, -8, 0], x: [0, 4, 0] }}
        transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute bottom-[14%] right-[12%] h-14 w-14 rounded-full bg-slate-300/55 blur-[1px]"
        animate={{ y: [0, 10, 0], x: [0, -6, 0] }}
        transition={{ duration: duration + 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute inset-[20%] rounded-[32%] bg-[conic-gradient(from_180deg,_rgba(15,23,42,0.92),_rgba(71,85,105,0.5),_rgba(245,158,11,0.28),_rgba(15,23,42,0.92))] shadow-[0_20px_40px_rgba(15,23,42,0.18)]"
        animate={{ rotate: [0, 360], scale: [1, 1.05, 1] }}
        transition={{ duration: duration + 4, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div
        className="absolute inset-[29%] rounded-[28%] border border-white/70 bg-white/65 backdrop-blur-sm"
        animate={{ rotate: [0, -360] }}
        transition={{ duration: duration + 6, repeat: Infinity, ease: 'linear' }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-200/80 bg-white/85 text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
          <span className="text-lg font-semibold tracking-[0.18em]">AI</span>
        </div>
      </div>
    </div>
  );
}
