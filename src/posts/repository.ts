import { uploadDirectPostPhoto } from './directMedia';
import { postImagePath } from '../lib/mediaPath';
import { effectiveAvatarPath } from '../lib/mediaPath';
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WorkPostRow } from "../lib/database.types";
import type {
  ManagedPost,
  ManagedPosts,
  PostPhoto,
  PublicPosts,
  PublishedWork,
} from "./types";
import { imagePath, pageNumber, validId } from "../marketplace/validation";
import { missingPosts, validatePost, validCursor } from "./validation";
const POST_FIELDS =
  "id,business_id,title,description,status,created_at,updated_at,published_at";
const DIRECT_IMAGES = "uploaded_images:work_post_photos!work_post_photos_post_fkey(id,storage_path,media_state,selected,staged,sort_order)";
type DirectImage={id:string;storage_path:string;media_state:"pending"|"ready";selected:boolean;staged:boolean;sort_order:number|null};
const missingDirect=(error:{code:string;message:string}|null)=>!!error&&["PGRST200","PGRST204","PGRST205","42703"].includes(error.code)&&/work_post_photos|uploaded_images/.test(error.message);
function combinedImages(legacy:RawImages, direct:DirectImage[] = [], drafts=false):PostPhoto[]{return [...photos(legacy).map((p,i)=>({...p,sort:legacy.find(v=>v.photo?.id===p.id)?.sort_order??i})),...direct.filter(p=>p.selected||(drafts&&p.staged)).map(p=>({id:p.id,path:p.storage_path,caption:null,kind:"post" as const,mediaState:p.media_state,sort:p.sort_order??6}))].sort((a,b)=>a.sort-b.sort).map(({sort,...p})=>p);}
const IMAGES =
  "images:work_post_images!work_post_images_post_fkey(sort_order,photo:portfolio_items!work_post_images_portfolio_fkey(id,caption,storage_path))";
type RawImages = {
  sort_order: number;
  photo: { id: string; caption: string | null; storage_path: string } | null;
}[];
const photos = (images: RawImages): PostPhoto[] =>
  [...images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((i) =>
      i.photo
        ? [
            {
              id: i.photo.id,
              path: i.photo.storage_path,
              caption: i.photo.caption,
            },
          ]
        : [],
    );
function fail(code: string): never {
  throw { code };
}
export function createManagedPosts(
  client: SupabaseClient<Database>,
): ManagedPosts {
  async function manager(id: string) {
    if (!validId(id)) fail("NOT_MANAGER");
    const user = await client.auth.getUser();
    if (user.error || !user.data.user) fail("AUTH_REQUIRED");
    const member = await client
      .from("business_members")
      .select("id")
      .eq("business_id", id)
      .eq("user_id", user.data.user.id)
      .eq("role", "owner")
      .maybeSingle();
    if (member.error) throw member.error;
    if (!member.data) fail("NOT_MANAGER");
    const ready = await client.from("work_posts").select("id").limit(0);
    if (ready.error) {
      if (missingPosts(ready.error)) fail("SETUP_REQUIRED");
      throw ready.error;
    }
  }
  async function command(
    businessId: string,
    id: string,
    name: string,
    extra: {
      post_title?: string;
      post_description?: string;
      photo_ids?: string[];
    } = {},
  ) {
    if (!validId(id)) fail("INVALID_INPUT");
    await manager(businessId);
    const { data, error } = await client.rpc("work_post_command", {
      command: name,
      target_business: businessId,
      target_post: id,
      ...extra,
    });
    if (error) throw error;
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      data.id !== id
    )
      fail("INVALID_RESPONSE");
  }
  return {
    async get(businessId, postId, signal) {
      if(!validId(postId))return null;
      await manager(businessId);
      const result=await client.from('work_posts').select(`${POST_FIELDS},${IMAGES}`).eq('business_id',businessId).eq('id',postId).abortSignal(signal??new AbortController().signal).maybeSingle().overrideTypes<WorkPostRow & {images:RawImages}|null,{merge:false}>();
      if(result.error)throw result.error;if(!result.data)return null;
      const direct=await client.from('work_posts').select(`id,${DIRECT_IMAGES}`).eq('business_id',businessId).eq('id',postId).abortSignal(signal??new AbortController().signal).maybeSingle().overrideTypes<{uploaded_images:DirectImage[]}|null,{merge:false}>();
      if(direct.error&&!missingDirect(direct.error))throw direct.error;
      return {...result.data,images:combinedImages(result.data.images,direct.data?.uploaded_images,result.data.status==='draft')};
    },
    async directPhotosAvailable(){const {error}=await client.from('work_posts').select(`id,${DIRECT_IMAGES}`).limit(0);if(error&&missingDirect(error))return false;if(error)throw error;return true;},
    uploadPostPhoto: (bid,postId,id,file,input)=>uploadDirectPostPhoto(client,bid,postId,id,file,input),
    async load(id, value, signal) {
      await manager(id);
      const current = pageNumber(value);
      const [business, result] = await Promise.all([
        client
          .from("businesses")
          .select("id,name,status")
          .eq("id", id)
          .abortSignal(signal ?? new AbortController().signal)
          .single(),
        client
          .from("work_posts")
          .select(`${POST_FIELDS},${IMAGES}`)
          .eq("business_id", id)
          .order("updated_at", { ascending: false })
          .order("id", { ascending: false })
          .range((current - 1) * 10, current * 10)
          .abortSignal(signal ?? new AbortController().signal)
          .overrideTypes<
            (WorkPostRow & { images: RawImages })[],
            { merge: false }
          >(),
      ]);
      if (business.error) throw business.error;
      if (result.error) throw result.error;
      let directRows:Record<string,DirectImage[]>={};
      const withDirect=await client.from('work_posts').select(`id,${DIRECT_IMAGES}`).eq('business_id',id).in('id',(result.data??[]).map(p=>p.id)).overrideTypes<{id:string;uploaded_images:DirectImage[]}[],{merge:false}>();
      if(withDirect.error&&!missingDirect(withDirect.error))throw withDirect.error;
      if(!withDirect.error)directRows=Object.fromEntries((withDirect.data??[]).map(p=>[p.id,p.uploaded_images]));
      const items: ManagedPost[] = (result.data ?? [])
        .slice(0, 10)
        .map((row) => ({ ...row, images: combinedImages(row.images,directRows[row.id],row.status==='draft') }));
      return {
        business: business.data,
        posts: {
          items,
          page: current,
          hasNext: (result.data?.length ?? 0) > 10,
        },
      };
    },
    async photos(id, value, signal) {
      await manager(id);
      const current = pageNumber(value);
      const { data, error } = await client
        .from("portfolio_items")
        .select("id,caption,storage_path")
        .eq("business_id", id)
        .eq("media_state", "ready")
        .order("sort_order")
        .order("id")
        .range((current - 1) * 12, current * 12)
        .abortSignal(signal ?? new AbortController().signal);
      if (error) throw error;
      return {
        items: (data ?? [])
          .slice(0, 12)
          .map((p) => ({ id: p.id, caption: p.caption, path: p.storage_path })),
        page: current,
        hasNext: (data?.length ?? 0) > 12,
      };
    },
    async save(bid, id, input) {
      if (validatePost(input)) fail("22023");
      if(input.photos.some(p=>p.kind==='post')){
        const {error}=await client.rpc('save_work_post_composition',{target_business:bid,target_post:id,post_title:input.title.trim(),post_description:input.description,image_refs:input.photos.map(p=>({id:p.id,kind:p.kind??'portfolio'}))});if(error)throw error;return;
      }
      await command(bid, id, "save", {
        post_title: input.title.trim(),
        post_description: input.description,
        photo_ids: input.photos.map((p) => p.id),
      });
    },
    command: (bid, id, name) => command(bid, id, name),
    async imageUrl(id, path) {
      if (!imagePath(id, path) && !postImagePath(id,path)) fail("INVALID_INPUT");
      await manager(id);
      const { data, error } = await client.storage
        .from(postImagePath(id,path)?"business-posts":"business-portfolio")
        .createSignedUrl(path, 60);
      if (error) throw error;
      const url = new URL(data.signedUrl);
      if (
        url.origin !== "https://yazdjiwaksamizrbqewq.supabase.co" ||
        url.username ||
        url.password ||
        url.hash ||
        url.pathname !== `/storage/v1/object/sign/${postImagePath(id,path)?"business-posts":"business-portfolio"}/${path}`
      )
        fail("INVALID_RESPONSE");
      return data.signedUrl;
    },
  };
}
interface RawPublicPost {
  id: string;
  business_id: string;
  title: string;
  description: string;
  published_at: string;
  created_at?: string;
  images: RawImages;
  uploaded_images?: DirectImage[];
  business: {
    id: string;
    name: string;
    slug: string;
    avatar_path: string | null;
    profile_avatar_path?: string | null;
    city: { name: string; state_code: string } | null;
    category: { name: string } | null;
  };
}
const PUBLIC_POST_FIELDS =
  "id,business_id,title,description,created_at,published_at,business:businesses!work_posts_business_id_fkey!inner(id,name,slug,avatar_path,city:cities!businesses_city_id_fkey(name,state_code),category:categories!businesses_category_id_fkey(name))," +
  IMAGES;
function publicPost(row: RawPublicPost): PublishedWork {
  return {
    id: row.id,
    businessId: row.business_id,
    title: row.title,
    description: row.description,
    publishedAt: row.published_at,
    createdAt: row.created_at ?? null,
    images: combinedImages(row.images,row.uploaded_images?.filter(photo=>photo.selected && photo.media_state==='ready')),
    business: {
      id: row.business.id,
      name: row.business.name,
      slug: row.business.slug,
      avatarPath: effectiveAvatarPath(row.business),
      category: row.business.category?.name ?? "Serviços locais",
      city: row.business.city
        ? `${row.business.city.name}/${row.business.city.state_code}`
        : "Localização não informada",
    },
  };
}
export function createPublicPosts(
  client: SupabaseClient<Database>,
): PublicPosts {
  let profileReady = true, directReady = true;
  const fields = () => (profileReady ? PUBLIC_POST_FIELDS.replace('slug,avatar_path,', 'slug,avatar_path,profile_avatar_path,') : PUBLIC_POST_FIELDS)+(directReady?','+DIRECT_IMAGES:'');
  const missingProfile = (error: { code: string; message: string } | null) => error && ['42703','PGRST204'].includes(error.code) && error.message.includes('profile_avatar_path');
  return {
    async list(cursor, businessId, signal) {
      if (cursor && !validCursor(cursor)) fail("INVALID_CURSOR");
      if (businessId && !validId(businessId)) fail("INVALID_INPUT");
      const read = () => {
        let query = client
          .from("work_posts")
          .select(fields())
          .eq("status", "published")
          .eq("business.status", "published");
        if (businessId) query = query.eq("business_id", businessId);
        if (cursor)
          query = query.or(
            `published_at.lt."${cursor.publishedAt}",and(published_at.eq."${cursor.publishedAt}",id.lt.${cursor.id})`,
          );
        return query
          .order("published_at", { ascending: false })
          .order("id", { ascending: false })
          .order("sort_order", { referencedTable: "images" })
          .limit(6, { referencedTable: "images" })
          .limit(7)
          .abortSignal(signal ?? new AbortController().signal)
          .overrideTypes<RawPublicPost[], { merge: false }>();
      };
      let result = await read();
      if(missingDirect(result.error)){directReady=false;result=await read();}
      if (missingProfile(result.error)) { profileReady = false; result = await read(); }
      const { data, error } = result;
      if (error) {
        if (missingPosts(error)) return null;
        throw error;
      }
      const items = (data ?? []).slice(0, 6).map(publicPost),
        last = items.at(-1);
      return {
        items,
        next:
          (data?.length ?? 0) > 6 && last
            ? { publishedAt: last.publishedAt, id: last.id }
            : null,
      };
    },
    async get(id, signal) {
      if (!validId(id)) return null;
      const read = () => client
        .from("work_posts")
        .select(fields())
        .eq("id", id)
        .eq("status", "published")
        .eq("business.status", "published")
        .order("sort_order", { referencedTable: "images" })
        .limit(6, { referencedTable: "images" })
        .abortSignal(signal ?? new AbortController().signal)
        .maybeSingle()
        .overrideTypes<RawPublicPost | null, { merge: false }>();
      let result = await read();
      if(missingDirect(result.error)){directReady=false;result=await read();}
      if (missingProfile(result.error)) { profileReady = false; result = await read(); }
      const { data, error } = result;
      if (error) {
        if (missingPosts(error)) return null;
        throw error;
      }
      return data ? publicPost(data) : null;
    },
  };
}
