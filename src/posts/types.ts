import type { WorkPostRow } from "../lib/database.types";
import type { PublicPage } from "../marketplace/types";
export interface PostPhoto {
  kind?: "post" | "portfolio";
  mediaState?: "pending" | "ready";
  id: string;
  path: string;
  caption: string | null;
}
export interface ManagedPost extends WorkPostRow {
  images: PostPhoto[];
}
export interface PostInput {
  title: string;
  description: string;
  photos: PostPhoto[];
}
export interface WorkCursor {
  publishedAt: string;
  id: string;
}
export interface PublishedWork {
  id: string;
  businessId: string;
  title: string;
  description: string;
  publishedAt: string;
  createdAt?: string | null;
  images: PostPhoto[];
  business: {
    id: string;
    slug: string;
    name: string;
    category: string;
    city: string;
    avatarPath: string | null;
  };
}
export interface WorkFeedPage {
  items: PublishedWork[];
  next: WorkCursor | null;
}
export interface PublicPosts {
  list(
    cursor?: WorkCursor | null,
    businessId?: string,
    signal?: AbortSignal,
  ): Promise<WorkFeedPage | null>;
  get(id: string, signal?: AbortSignal): Promise<PublishedWork | null>;
}
export interface ManagedPosts {
  get(businessId: string, postId: string, signal?: AbortSignal): Promise<ManagedPost | null>;
  directPhotosAvailable?():Promise<boolean>;
  uploadPostPhoto?(businessId:string,postId:string,id:string,file:Blob,input:PostInput):Promise<void>;

  load(
    businessId: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<{
    business: { id: string; name: string; status: string };
    posts: PublicPage<ManagedPost>;
  }>;
  photos(
    businessId: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<PublicPage<PostPhoto>>;
  save(businessId: string, id: string, input: PostInput): Promise<void>;
  command(
    businessId: string,
    id: string,
    command: "publish" | "unpublish" | "delete",
  ): Promise<void>;
  imageUrl(businessId: string, path: string): Promise<string>;
}
