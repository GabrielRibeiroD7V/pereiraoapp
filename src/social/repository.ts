import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../lib/database.types";
import type {
  SocialImage,
  SocialPost,
  SocialPage,
  SocialRepository,
} from "./model";
import { validId } from "../marketplace/validation";
export function createSocialRepository(
  client: SupabaseClient<Database>,
): SocialRepository {
  async function command(action: string, id: string, data: Json = {}) {
    if (!validId(id)) throw { code: "22023" };
    const result = await client.rpc("personal_post_command", {
      command: action,
      target_post: id,
      data,
    });
    if (result.error) throw result.error;
    return result.data;
  }
  async function image(photo: SocialImage) {
    if (
      !["personal-posts", "business-posts", "business-portfolio"].includes(
        photo.bucket,
      ) ||
      !photo.path ||
      photo.path.includes("..") ||
      photo.path.startsWith("/")
    )
      throw { code: "22023" };
    const r = await client.storage
      .from(photo.bucket)
      .createSignedUrl(photo.path, 60);
    if (r.error) throw r.error;
    const url = new URL(r.data.signedUrl);
    if (
      url.origin !== "https://yazdjiwaksamizrbqewq.supabase.co" ||
      url.pathname !==
        `/storage/v1/object/sign/${photo.bucket}/${photo.path}` ||
      url.username ||
      url.password
    )
      throw { code: "INVALID_RESPONSE" };
    return r.data.signedUrl;
  }
  return {
    async mine(page) {
      const r = await client.rpc("personal_posts_query", {
        scope: "mine",
        page_number: page,
      });
      if (r.error) throw r.error;
      return r.data as unknown as SocialPage;
    },
    async get(id) {
      if (!validId(id)) return null;
      const r = await client.rpc("personal_posts_query", {
        scope: "detail",
        target: id,
      });
      if (r.error) throw r.error;
      return r.data as unknown as SocialPost | null;
    },
    async feed(cursor, authorId) {
      if (authorId && !validId(authorId)) throw { code: "22023" };
      const r = await client.rpc("publication_feed", {
        before_time: cursor?.time ?? null,
        before_id: cursor?.id ?? null,
        before_kind: cursor?.kind ?? null,
        author_filter: authorId ?? null,
      });
      if (r.error) throw r.error;
      return r.data as unknown as SocialPage;
    },
    image,
    async save(id, input) {
      if (
        input.title.length > 120 ||
        input.description.length > 3000 ||
        input.images.length < 1 ||
        input.images.length > 6 ||
        new Set(input.images.map((p) => p.id)).size !== input.images.length
      )
        throw { code: "22023" };
      for (const photo of input.images) {
        if (
          photo.blob &&
          (photo.blob.type !== "image/webp" ||
            photo.blob.size < 1 ||
            photo.blob.size > 5242880)
        )
          throw { code: "22023" };
      }
      for (const photo of input.images) {
        if (!photo.blob) continue;
        const plan = (await command("prepare", id, {
          photoId: photo.id,
          bytes: photo.blob.size,
        })) as { path?: string; mediaState?: string };
        if (!plan.path) throw { code: "INVALID_RESPONSE" };
        if (plan.mediaState !== "ready") {
          const uploaded = await client.storage
            .from("personal-posts")
            .upload(plan.path, photo.blob, {
              contentType: "image/webp",
              cacheControl: "60",
              upsert: false,
            });
          if (uploaded.error) {
            // Lost response or retry: finalize only the same prepared ID; no new file/ID.
            try {
              await command("finalize", id, { photoId: photo.id });
            } catch {
              throw uploaded.error;
            }
          } else await command("finalize", id, { photoId: photo.id });
        }
      }
      await command("save", id, {
        title: input.title.trim(),
        description: input.description,
        imageIds: input.images.map((p) => p.id),
      });
    },
    async command(id, action) {
      if (action !== "delete") {
        await command(action, id);
        return;
      }
      const result = (await command("delete", id)) as { paths?: string[] };
      if (result.paths?.length) {
        const r = await client.storage
          .from("personal-posts")
          .remove(result.paths);
        if (r.error) throw r.error;
      }
      await command("finish_delete", id);
    },
  };
}
