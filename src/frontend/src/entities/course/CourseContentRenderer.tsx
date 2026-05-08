import { Fragment } from 'react';
import type { CourseMedia } from './types';

type Props = { content: string; media?: CourseMedia[] };
export type CourseHeading = { id: string; text: string; level: 1 | 2 };

const mediaBySlug = (media?: CourseMedia[]) => new Map((media ?? []).map((m) => [m.slug, m]));

const resolveTitle = (media?: CourseMedia, preferred?: string) => {
  if (preferred?.trim()) return preferred.trim();
  if (media?.title?.trim()) return media.title.trim();
  if (media?.original_name?.trim()) return media.original_name.trim();
  return media?.slug ?? 'Материал';
};

const renderEmbed = (slug: string, media?: CourseMedia, preferredTitle?: string) => {
  if (!media) return <div className="muted">Материал недоступен</div>;
  const title = preferredTitle?.trim() || undefined;
  const visualTitle = resolveTitle(media);
  if (media.media_type === 'image') return (
    <figure className="course-media-figure">
      <img src={media.file_url} alt={title || visualTitle} title={title} className="course-media-image" />
    </figure>
  );
  if (media.media_type === 'video') return (
    <figure className="course-media-figure">
      <video controls src={media.file_url} title={title} aria-label={title} className="course-media-video" />
    </figure>
  );
  return (
    <article className="course-media-document" title={title} aria-label={title}>
      <strong>{visualTitle}</strong>
      {media.original_name ? <p className="muted">{media.original_name}</p> : null}
      <a href={media.file_url} target="_blank" rel="noreferrer" title={title} aria-label={title}>Открыть</a>
    </article>
  );
};

const renderInline = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    const m = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (m) {
      if (m[2].startsWith('media:')) return <span key={i} className="muted">Материал недоступен</span>;
      return <a key={i} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
};

const stripInlineMarkdown = (text: string) => text
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
  .trim();

const slugifyHeading = (text: string) => {
  const normalized = text.toLowerCase().trim();
  const cleaned = normalized
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'section';
};

export const extractCourseHeadings = (content: string): CourseHeading[] => {
  const counters = new Map<string, number>();
  return content
    .split('\n')
    .map((line) => {
      if (line.startsWith('## ')) return { level: 2 as const, raw: line.slice(3) };
      if (line.startsWith('# ')) return { level: 1 as const, raw: line.slice(2) };
      return null;
    })
    .filter((item): item is { level: 1 | 2; raw: string } => Boolean(item))
    .map((item) => {
      const text = stripInlineMarkdown(item.raw);
      const baseId = slugifyHeading(text);
      const count = (counters.get(baseId) ?? 0) + 1;
      counters.set(baseId, count);
      return {
        id: count > 1 ? `${baseId}-${count}` : baseId,
        level: item.level,
        text: text || 'Раздел',
      };
    });
};

export const CourseContentRenderer = ({ content, media }: Props) => {
  const lookup = mediaBySlug(media);
  const lines = content.split('\n');
  const headings = extractCourseHeadings(content);
  let headingIndex = 0;
  return <div className="prose-block">{lines.map((line, idx) => {
    const embed = line.trim().match(/^\{\{\s*media:([a-z0-9-]+)\s*\}\}$/i);
    if (embed) return <div key={idx}>{renderEmbed(embed[1], lookup.get(embed[1]))}</div>;
    const img = line.trim().match(/^!\[([^\]]*)\]\(media:([a-z0-9-]+)\)$/i);
    if (img) {
      const m = lookup.get(img[2]);
      if (!m || m.media_type !== 'image') return <div key={idx} className="muted">Материал недоступен</div>;
      const caption = img[1]?.trim();
      return <figure key={idx} className="course-media-figure"><img src={m.file_url} alt={caption || m.title} title={caption} className="course-media-image" /></figure>;
    }
    const mediaLink = line.trim().match(/^\[([^\]]+)\]\(media:([a-z0-9-]+)\)$/i);
    if (mediaLink) {
      return <div key={idx}>{renderEmbed(mediaLink[2], lookup.get(mediaLink[2]), mediaLink[1])}</div>;
    }
    if (line.startsWith('## ')) {
      const heading = headings[headingIndex++];
      return <h2 key={idx} id={heading?.id}>{renderInline(line.slice(3))}</h2>;
    }
    if (line.startsWith('# ')) {
      const heading = headings[headingIndex++];
      return <h1 key={idx} id={heading?.id}>{renderInline(line.slice(2))}</h1>;
    }
    if (line.startsWith('- ')) return <li key={idx}>{renderInline(line.slice(2))}</li>;
    return <p key={idx}>{renderInline(line)}</p>;
  })}</div>;
};
