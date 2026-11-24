import type { ReactNode } from 'react';
import { PhotoCarousel } from '../components/PhotoCarousel';
import type { ManagedPost } from './types';

export function postVisibility(status: ManagedPost['status']) {
  return status === 'published' ? 'Publicado' : status === 'draft' ? 'Rascunho — só você vê' : 'Fora de circulação — só você vê';
}

/** A mesma composição para o post público, o rascunho privado e a prévia de criação. */
export function PostContent({ title, description, author, meta, images, visibility, publishedAt, actions, headingLevel = 'h2', carouselLabel }: {
  title: string; description: string; author: string; meta?: string;
  images: { id: string; content: ReactNode }[];
  visibility?: string; publishedAt?: string | null; actions?: ReactNode; headingLevel?: 'h1' | 'h2'; carouselLabel?: string;
}) {
  const Heading=headingLevel;
  return <article className="post-content">
    <header className="post-content__author"><strong>{author}</strong>{meta && <p>{meta}</p>}{visibility && <p className="post-content__visibility">{visibility}</p>}</header>
    <div className="post-content__media"><PhotoCarousel label={carouselLabel ?? `Fotos de ${title}`} items={images}/></div>
    <div className="post-content__body"><Heading>{title}</Heading><p className="post-full-description">{description.trim() ? description : 'Esta publicação não tem legenda.'}</p>
      {publishedAt && <time dateTime={publishedAt}>{new Date(publishedAt).toLocaleDateString('pt-BR')}</time>}
      {actions && <div className="post-content__actions">{actions}</div>}
    </div>
  </article>;
}
