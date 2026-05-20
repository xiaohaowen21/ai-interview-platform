import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lottie-player': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        autoplay?: boolean | string;
        background?: string;
        loop?: boolean | string;
        mode?: string;
        speed?: number | string;
        src?: string;
        style?: CSSProperties;
      };
    }
  }
}

export {};
