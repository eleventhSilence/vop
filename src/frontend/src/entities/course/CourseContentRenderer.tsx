import { Fragment, type ReactNode } from 'react';
import type { CourseMedia } from './types';

type Props = { content: string; media?: CourseMedia[] };
export type CourseHeading = { id: string; text: string; level: 1 | 2 };

const mediaBySlug = (media?: CourseMedia[]) => new Map((media ?? []).map((m) => [m.slug, m]));
const resolveTitle = (media?: CourseMedia, preferred?: string) => preferred?.trim() || media?.title?.trim() || media?.original_name?.trim() || media?.slug || 'Материал';
const slugifyHeading = (text: string) => text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'section';

const stripInlineMarkdown = (text: string) => text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/~~([^~]+)~~/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').trim();

export const extractCourseHeadings = (content: string): CourseHeading[] => {
  const counters = new Map<string, number>();
  return content.split('\n').map((line) => line.startsWith('## ') ? { level: 2 as const, raw: line.slice(3) } : line.startsWith('# ') ? { level: 1 as const, raw: line.slice(2) } : null)
    .filter((v): v is { level: 1 | 2; raw: string } => Boolean(v)).map((v) => {
      const text = stripInlineMarkdown(v.raw);
      const base = slugifyHeading(text);
      const count = (counters.get(base) ?? 0) + 1;
      counters.set(base, count);
      return { id: count > 1 ? `${base}-${count}` : base, level: v.level, text: text || 'Раздел' };
    });
};

const resolveDownloadName = (media: CourseMedia) => {
  const original = media.original_name?.trim();
  if (original) return original;
  try {
    const pathname = new URL(media.file_url, window.location.origin).pathname;
    const fileName = pathname.split('/').pop();
    if (fileName) return decodeURIComponent(fileName);
  } catch {
    const fileName = media.file_url.split('/').pop();
    if (fileName) return decodeURIComponent(fileName);
  }
  return media.title?.trim() || 'media-file';
};

const renderEmbed = (slug: string, media?: CourseMedia, preferredTitle?: string) => {
  if (!media) return <div className="muted">Материал недоступен</div>;
  const title = preferredTitle?.trim() || undefined;
  const visualTitle = resolveTitle(media);
  if (media.media_type === 'image') return <figure className="course-media-figure"><img src={media.file_url} alt={title || visualTitle} title={title} className="course-media-image" /></figure>;
  if (media.media_type === 'video') return <figure className="course-media-figure"><video controls src={media.file_url} title={title} aria-label={title} className="course-media-video" /></figure>;
  return <article className="course-media-document" title={title} aria-label={title}><strong>{visualTitle}</strong>{media.original_name ? <p className="muted">{media.original_name}</p> : null}<a href={media.file_url} target="_blank" rel="noreferrer" download={resolveDownloadName(media)}>Открыть</a></article>;
};

const renderInline = (text: string, lookup: Map<string, CourseMedia>) : ReactNode[] => text.split(/(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean).map((part, i) => {
  if (part.startsWith('```')) return <code key={i}>{part.slice(1, -1)}</code>;
  if (part.startsWith('***') && part.endsWith('***')) return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
  if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
  if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
  if (part.startsWith('~~') && part.endsWith('~~')) return <del key={i}>{part.slice(2, -2)}</del>;
  if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
  const m = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
  if (m) {
    const href = m[2];
    const mediaMatch = href.match(/^media:([a-z0-9-]+)$/i);
    if (mediaMatch) return <Fragment key={i}>{renderEmbed(mediaMatch[1], lookup.get(mediaMatch[1]), m[1])}</Fragment>;
    return <a key={i} href={href} target="_blank" rel="noopener noreferrer">{m[1]}</a>;
  }
  return <Fragment key={i}>{part}</Fragment>;
});

export const CourseContentRenderer = ({ content, media }: Props) => {
  const lookup = mediaBySlug(media);
  const lines = content.split('\n');
  const headings = extractCourseHeadings(content);
  let headingIndex = 0;
  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i += 1; continue; }
    const legacy = trimmed.match(/^\{\{\s*media:([a-z0-9-]+)\s*\}\}$/i);
    if (legacy) { nodes.push(<div key={`m-${i}`}>{renderEmbed(legacy[1], lookup.get(legacy[1]))}</div>); i += 1; continue; }
    const img = trimmed.match(/^!\[([^\]]*)\]\(media\\?:([a-z0-9-]+)\)$/i);
    if (img) { const item = lookup.get(img[2]); nodes.push(item && item.media_type==='image' ? <figure key={`img-${i}`} className="course-media-figure"><img src={item.file_url} alt={img[1]||item.title||''} title={img[1]||undefined} className="course-media-image"/></figure> : <div key={`img-${i}`} className="muted">Материал недоступен</div>); i+=1; continue; }
    if (trimmed.startsWith('### ')) { nodes.push(<h3 key={`h3-${i}`}>{renderInline(line.slice(4), lookup)}</h3>); i+=1; continue; }
    if (trimmed.startsWith('## ')) { const h=headings[headingIndex++]; nodes.push(<h2 key={`h2-${i}`} id={h?.id}>{renderInline(line.slice(3), lookup)}</h2>); i+=1; continue; }
    if (trimmed.startsWith('# ')) { const h=headings[headingIndex++]; nodes.push(<h1 key={`h1-${i}`} id={h?.id}>{renderInline(line.slice(2), lookup)}</h1>); i+=1; continue; }
    if (trimmed === '---') { nodes.push(<hr key={`hr-${i}`} />); i+=1; continue; }
    if (trimmed.startsWith('> ')) { nodes.push(<blockquote key={`bq-${i}`}><p>{renderInline(trimmed.slice(2), lookup)}</p></blockquote>); i+=1; continue; }
    if (trimmed.startsWith('```')) { const code: string[]=[]; i+=1; while(i<lines.length && !lines[i].trim().startsWith('```')){code.push(lines[i]); i+=1;} i+=1; nodes.push(<pre key={`pre-${i}`}><code>{code.join('\n')}</code></pre>); continue; }
    if (trimmed.startsWith('|') && i+1<lines.length && lines[i+1].trim().match(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/)) {
      const header = trimmed.split('|').map((c) => c.trim()).filter(Boolean);
      i += 2; const rows: string[][]=[];
      while (i<lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim().split('|').map((c)=>c.trim()).filter(Boolean)); i+=1; }
      nodes.push(<div key={`tbl-${i}`} className="course-content__table-wrap"><table><thead><tr>{header.map((h,idx)=><th key={idx}>{renderInline(h, lookup)}</th>)}</tr></thead><tbody>{rows.map((r,ri)=><tr key={ri}>{r.map((c,ci)=><td key={ci}>{renderInline(c, lookup)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (trimmed.match(/^(- |\* |\d+\. )/)) {
      const ordered = Boolean(trimmed.match(/^\d+\. /)); const items: ReactNode[]=[];
      const orderedStart = ordered ? Number(trimmed.match(/^(\d+)\. /)?.[1] ?? '1') : undefined;
      let hasTaskItems = false;
      while (i<lines.length && lines[i].trim().match(/^(- |\* |\d+\. )/)) {
        const cur = lines[i].trim();
        const task = cur.match(/^[-*] \[([ xX])\] (.+)$/);
        if (task) {
          hasTaskItems = true;
          items.push(<li key={`li-${i}`} className="task-list-item"><input type="checkbox" checked={task[1].toLowerCase()==='x'} disabled readOnly />{renderInline(task[2], lookup)}</li>);
        }
        else items.push(<li key={`li-${i}`}>{renderInline(cur.replace(/^(- |\* |\d+\. )/, ''), lookup)}</li>);
        i+=1;
      }
      nodes.push(ordered ? <ol key={`ol-${i}`} start={orderedStart}>{items}</ol> : <ul key={`ul-${i}`} className={hasTaskItems ? 'contains-task-list' : undefined}>{items}</ul>); continue;
    }
    nodes.push(<p key={`p-${i}`}>{renderInline(line, lookup)}</p>); i+=1;
  }
  return <div className="prose-block course-content">{nodes}</div>;
};
