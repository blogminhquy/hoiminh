// Render Markdown an toàn (marked + DOMPurify) với @mention thành link hồ sơ.
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';

marked.setOptions({ gfm: true, breaks: true });

function linkMentions(html: string): string {
  return html.replace(/(^|[\s>])@([a-z0-9][a-z0-9-]{2,31})/g, (_m, pre: string, h: string) => `${pre}<a href="/u/${h}" data-mention="${h}">@${h}</a>`);
}

/** Markdown → HTML đã làm sạch. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false }) as string;
  return DOMPurify.sanitize(linkMentions(html), { ADD_ATTR: ['target', 'data-mention'], FORBID_TAGS: ['style', 'script', 'iframe'] });
}

export function Markdown({ md, className, small }: { md: string; className?: string; small?: boolean }) {
  const html = useMemo(() => renderMarkdown(md), [md]);
  return <div className={`md${small ? ' sm' : ''}${className ? ' ' + className : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
