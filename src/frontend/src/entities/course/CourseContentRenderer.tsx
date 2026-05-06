import { Fragment } from 'react';
import type { CourseMedia } from './types';

type Props = { content: string; media?: CourseMedia[] };

const mediaBySlug = (media?: CourseMedia[]) => new Map((media ?? []).map((m) => [m.slug, m]));

const renderEmbed = (slug: string, media?: CourseMedia) => {
  if (!media) return <div className="muted">Материал недоступен</div>;
  if (media.media_type === 'image') return <img src={media.file_url} alt={media.title} className="course-media-image" />;
  if (media.media_type === 'video') return <video controls src={media.file_url} className="course-media-video" />;
  return <div className="card"><strong>{media.title}</strong><div><a href={media.file_url} target="_blank" rel="noreferrer">Открыть/Скачать</a></div></div>;
};

const renderInline = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    const m = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (m) return <a key={i} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
};

export const CourseContentRenderer = ({ content, media }: Props) => {
  const lookup = mediaBySlug(media);
  const lines = content.split('\n');
  return <div className="prose-block">{lines.map((line, idx) => {
    const embed = line.trim().match(/^\{\{\s*media:([a-z0-9-]+)\s*\}\}$/i);
    if (embed) return <div key={idx}>{renderEmbed(embed[1], lookup.get(embed[1]))}</div>;
    const img = line.trim().match(/^!\[([^\]]*)\]\(media:([a-z0-9-]+)\)$/i);
    if (img) {
      const m = lookup.get(img[2]);
      if (!m || m.media_type !== 'image') return <div key={idx} className="muted">Материал недоступен</div>;
      return <img key={idx} src={m.file_url} alt={img[1] || m.title} className="course-media-image" />;
    }
    if (line.startsWith('### ')) return <h4 key={idx}>{renderInline(line.slice(4))}</h4>;
    if (line.startsWith('## ')) return <h3 key={idx}>{renderInline(line.slice(3))}</h3>;
    if (line.startsWith('# ')) return <h2 key={idx}>{renderInline(line.slice(2))}</h2>;
    if (line.startsWith('- ')) return <li key={idx}>{renderInline(line.slice(2))}</li>;
    return <p key={idx}>{renderInline(line)}</p>;
  })}</div>;
};
