import {PostDates} from './PostDates';
import type { ReactNode } from 'react';
import { PhotoCarousel } from '../components/PhotoCarousel';
import type { ManagedPost } from './types';

export function postVisibility(status: ManagedPost['status']) {
  return status === 'published' ? 'Publicado' : status === 'draft' ? 'Rascunho — só você vê' : 'Fora de circulação — só você vê';
}

/** A mesma composição para o post público, o rascunho privado e a prévia de criação. */
export function PostContent({ title, description, author, meta, images, visibility, publishedAt, actions, headingLevel = 'h2', carouselLabel, management, avatar, createdAt, titleNode }: {
  title: string; description: string; author: string; meta?: string;
  images: { id: string; content: ReactNode }[];
  visibility?: string; publishedAt?: string | null; actions?: ReactNode; headingLevel?: 'h1' | 'h2'; carouselLabel?: string; management?: ReactNode; avatar?: ReactNode; createdAt?: string | null; titleNode?: ReactNode;
}) {
  const Heading=headingLevel;
  return <article className="post-content" aria-label={title}>
    <header className="post-content__author">{avatar && <span className="post-content__avatar">{avatar}</span>}<div className="post-content__byline"><strong>{author}</strong>{meta && <p>{meta}</p>}{visibility && <p className="post-content__visibility">{visibility}</p>}</div>{management}</header>
    <div className="post-content__media"><PhotoCarousel label={carouselLabel ?? `Fotos de ${title}`} items={images}/></div>
    <div className="post-content__body"><Heading id={headingLevel==='h1'?'page-title':undefined} tabIndex={headingLevel==='h1'?-1:undefined}>{titleNode ?? title}</Heading><p className="post-full-description">{description.trim() ? description : 'Esta publicação não tem legenda.'}</p>
      <PostDates createdAt={createdAt} publishedAt={publishedAt}/>
      {actions && <div className="post-content__actions">{actions}</div>}
    </div>
  </article>;
}
