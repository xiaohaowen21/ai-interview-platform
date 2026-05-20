import { PlayCircle } from 'lucide-react';
import { cn } from '../lib/cn';
import { isVideoAssetUrl } from '../utils/media';

interface MediaAssetProps {
  src: string;
  alt: string;
  className?: string;
  mediaClassName?: string;
  interactive?: boolean;
}

export default function MediaAsset({
  src,
  alt,
  className,
  mediaClassName,
  interactive = false,
}: MediaAssetProps) {
  const isVideo = isVideoAssetUrl(src);

  if (!isVideo) {
    return (
      <div className={cn('h-full w-full', className)}>
        <img
          src={src}
          alt={alt}
          className={cn('h-full w-full object-cover', mediaClassName)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-slate-950', className)}>
      <video
        src={src}
        className={cn('h-full w-full bg-slate-950 object-contain', mediaClassName)}
        controls={interactive}
        preload="metadata"
        playsInline
      />
      {!interactive && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/14">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/88 text-slate-900 shadow-lg">
            <PlayCircle className="h-7 w-7" />
          </span>
        </div>
      )}
    </div>
  );
}
