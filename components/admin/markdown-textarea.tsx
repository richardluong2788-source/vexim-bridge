'use client';

/**
 * Markdown Textarea
 *
 * A plain <textarea> can never support "in đậm / in nghiêng" (bold/italic)
 * because there is no underlying rich-text model — it only stores a string.
 * This component keeps the simple textarea storage model (so it's a drop-in
 * replacement) but adds a small formatting toolbar that inserts Markdown
 * syntax (**bold**, *italic*, lists) around the current selection. The
 * stored value is Markdown text, which is then rendered with `react-markdown`
 * wherever the field is displayed publicly.
 */

import { useRef } from 'react';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface MarkdownTextareaProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

type WrapStyle = 'bold' | 'italic';

export function MarkdownTextarea({
  id,
  name,
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}: MarkdownTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyWrap = (style: WrapStyle) => {
    const marker = style === 'bold' ? '**' : '*';
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const placeholderText = style === 'bold' ? 'chữ đậm' : 'chữ nghiêng';
    const inner = selected || placeholderText;
    const newValue = value.slice(0, start) + marker + inner + marker + value.slice(end);

    onChange(newValue);

    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + marker.length;
      const cursorEnd = cursorStart + inner.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const applyListPrefix = (ordered: boolean) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;

    // Expand selection to cover full lines so prefixing works line-by-line.
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEndIdx = value.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;

    const block = value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const prefixed = lines
      .map((line, i) => {
        if (line.trim() === '') return line;
        const prefix = ordered ? `${i + 1}. ` : '- ';
        // Avoid double-prefixing if already a list line
        return /^(-|\d+\.)\s/.test(line) ? line : `${prefix}${line}`;
      })
      .join('\n');

    const newValue = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
    onChange(newValue);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + prefixed.length);
    });
  };

  return (
    <div className={cn('rounded-md border border-input overflow-hidden', className)}>
      <div className="flex items-center gap-1 border-b bg-muted/40 px-1.5 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Đậm (Bold)"
          aria-label="In đậm"
          onClick={() => applyWrap('bold')}
        >
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Nghiêng (Italic)"
          aria-label="In nghiêng"
          onClick={() => applyWrap('italic')}
        >
          <Italic className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Danh sách gạch đầu dòng"
          aria-label="Danh sách gạch đầu dòng"
          onClick={() => applyListPrefix(false)}
        >
          <List className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Danh sách đánh số"
          aria-label="Danh sách đánh số"
          onClick={() => applyListPrefix(true)}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </Button>
        <span className="ml-auto pr-2 text-[11px] text-muted-foreground">Hỗ trợ Markdown</span>
      </div>
      <Textarea
        ref={textareaRef}
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-none border-0 focus-visible:ring-0"
      />
    </div>
  );
}
