import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '../../../lib/cn';
import MediaAsset from '../../MediaAsset';

interface ProjectCardProps extends HTMLAttributes<HTMLDivElement> {
  imgSrc: string;
  title: string;
  description: string;
  link: string;
  linkText?: string;
  onLinkClick?: () => void;
}

export const ProjectCard = forwardRef<HTMLDivElement, ProjectCardProps>(
  ({ className, imgSrc, title, description, link, linkText = 'View Project', onLinkClick, ...props }, ref) => {
    const isExternalLink = /^https?:\/\//i.test(link);
    return (
      <div
        ref={ref}
        className={cn(
          'group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm transition-all duration-500 ease-in-out hover:-translate-y-2 hover:shadow-xl',
          className
        )}
        {...props}
      >
        <div className="aspect-video overflow-hidden">
          <MediaAsset
            src={imgSrc}
            alt={title}
            className="h-full w-full"
            mediaClassName="h-full w-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-110"
          />
        </div>

        <div className="flex flex-1 flex-col p-6">
          <h3 className="text-xl font-semibold transition-colors duration-300 group-hover:text-primary">
            {title}
          </h3>
          <p className="mt-3 flex-1 text-slate-500">{description}</p>

          <a
            href={link}
            target={isExternalLink ? '_blank' : undefined}
            rel={isExternalLink ? 'noopener noreferrer' : undefined}
            className="group/button mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary transition-all duration-300 hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              if (onLinkClick) {
                event.preventDefault();
                onLinkClick();
              }
            }}
          >
            {linkText}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/button:translate-x-1" />
          </a>
        </div>
      </div>
    );
  }
);

ProjectCard.displayName = 'ProjectCard';
