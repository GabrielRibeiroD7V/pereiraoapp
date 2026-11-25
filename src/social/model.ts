export interface SocialImage {
  id: string;
  path: string;
  bucket: "personal-posts" | "business-posts" | "business-portfolio";
}
export interface SocialPost {
  id: string;
  kind: "personal" | "professional";
  authorId: string | null;
  author: string;
  title: string;
  description: string;
  status: "draft" | "published" | "unpublished";
  createdAt: string;
  publishedAt: string | null;
  images: SocialImage[];
  profileUrl: string | null;
  businessId?: string;
  deleting?: boolean;
  blocked?: boolean;
}
export interface SocialCursor {
  time: string;
  id: string;
  kind: string;
}
export interface SocialPage {
  items: SocialPost[];
  hasNext: boolean;
}
export interface PersonalComposition {
  title: string;
  description: string;
  images: (SocialImage & { blob?: Blob })[];
}
export interface SocialRepository {
  mine(page: number): Promise<SocialPage>;
  get(id: string): Promise<SocialPost | null>;
  feed(cursor?: SocialCursor | null, authorId?: string): Promise<SocialPage>;
  image(image: SocialImage): Promise<string>;
  save(id: string, input: PersonalComposition): Promise<void>;
  command(
    id: string,
    action: "publish" | "unpublish" | "delete",
  ): Promise<void>;
}
export const postPath = (post: SocialPost) =>
  post.kind === "personal"
    ? `/publicacoes/${post.id}`
    : `/trabalhos/${post.id}`;
