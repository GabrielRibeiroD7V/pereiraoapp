import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { PostInput } from "./types";
import { MAX_UPLOAD_BYTES } from "../work/images";
export async function uploadDirectPostPhoto(
  client: SupabaseClient<Database>,
  bid: string,
  postId: string,
  id: string,
  file: Blob,
  input: PostInput,
) {
  if (file.type !== "image/webp" || !file.size || file.size > MAX_UPLOAD_BYTES)
    throw { code: "22023" };
  const result = await client.rpc("prepare_work_post_photo", {
    target_business: bid,
    target_post: postId,
    target_photo: id,
    image_bytes: file.size,
    draft_title: input.title,
    draft_description: input.description,
  });
  if (result.error) throw result.error;
  const path = `${bid}/posts/${id}.webp`;
  if (
    !result.data ||
    typeof result.data !== "object" ||
    Array.isArray(result.data) ||
    result.data.storage_path !== path
  )
    throw { code: "INVALID_RESPONSE" };
  const finalize = async () => {
    const { error } = await client.rpc("finalize_work_post_photo", {
      target_business: bid,
      target_photo: id,
    });
    if (error) throw error;
  };
  if (result.data.media_state === "ready") return;
  try {
    await finalize();
    return;
  } catch (error) {
    if (
      !(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "22023"
      )
    )
      throw error;
  }
  const upload = await client.storage
    .from("business-posts")
    .upload(path, file, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: "0",
    });
  if (upload.error) {
    try {
      await finalize();
      return;
    } catch {
      throw upload.error;
    }
  }
  await finalize();
}
