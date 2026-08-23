import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface ProductMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Renders admin-authored product copy (description, USP) as Markdown so
 * bold/italic/list formatting entered in the admin dialog actually shows up
 * on the public product page instead of being displayed as raw "**text**".
 */
export function ProductMarkdown({ content, className }: ProductMarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:leading-relaxed',
        className,
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
