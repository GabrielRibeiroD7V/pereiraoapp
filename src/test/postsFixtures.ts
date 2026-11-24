import type {
  ManagedPosts,
  ManagedPost,
  PostPhoto,
  PublicPosts,
  PublishedWork,
} from "../posts/types";
import { fixtureBusinessId, fixtureImage } from "./workFixtures";
export const fixturePostId = "00000000-0000-4000-8000-000000000201";
export const fixturePostPhotos: PostPhoto[] = [1, 2].map((n) => ({
  id: `00000000-0000-4000-8000-00000000010${n}`,
  caption: `Foto sintética ${n}`,
  path: `${fixtureBusinessId}/portfolio/00000000-0000-4000-8000-00000000010${n}.webp`,
}));
export function postsFixtures(businessStatus = "published", empty = false) {
  let rows: ManagedPost[] = empty
    ? []
    : [
        {
          id: fixturePostId,
          business_id: fixtureBusinessId,
          title: "Trabalho demonstrativo local",
          description:
            "Descrição simulada de um trabalho concluído, sem dados operacionais.",
          status: "draft",
          created_at: "2026-11-20T20:00:00Z",
          updated_at: "2026-11-20T20:00:00Z",
          published_at: null,
          images: [...fixturePostPhotos],
        },
      ];
  const check = (id: string) => {
    if (id !== fixtureBusinessId) throw { code: "NOT_MANAGER" };
  };
  const managed: ManagedPosts = {
    directPhotosAvailable: async()=>true,
    uploadPostPhoto: async()=>{},
    load: async (id, page) => {
      check(id);
      return {
        business: {
          id,
          name: "Negócio simulado local",
          status: businessStatus,
        },
        posts: { items: rows, page, hasNext: false },
      };
    },
    photos: async (id, page) => {
      check(id);
      return { items: [...fixturePostPhotos], page, hasNext: page === 1 };
    },
    imageUrl: async () => fixtureImage,
    save: async (bid, id, input) => {
      check(bid);
      const old = rows.find((p) => p.id === id);
      const value: ManagedPost = {
        id,
        business_id: bid,
        title: input.title,
        description: input.description,
        status:
          old?.status === "published"
            ? "unpublished"
            : (old?.status ?? "draft"),
        created_at: old?.created_at ?? "",
        updated_at: "",
        published_at: old?.published_at ?? null,
        images: input.photos,
      };
      rows = old
        ? rows.map((p) => (p.id === id ? value : p))
        : [...rows, value];
    },
    command: async (bid, id, command) => {
      check(bid);
      if (command === "publish" && businessStatus !== "published")
        throw { code: "23514" };
      rows =
        command === "delete"
          ? rows.filter((p) => p.id !== id)
          : rows.map((p) =>
              p.id === id
                ? {
                    ...p,
                    status: command === "publish" ? "published" : "unpublished",
                    published_at:
                      command === "publish"
                        ? "2026-11-20T21:00:00Z"
                        : p.published_at,
                  }
                : p,
            );
    },
  };
  const work: PublishedWork = {
    id: fixturePostId,
    businessId: fixtureBusinessId,
    title: "Trabalho demonstrativo local",
    description:
      "Descrição simulada de trabalho realizado. Não é um serviço para contratar nem um registro operacional.",
    publishedAt: "2026-11-20T21:00:00.123456+00:00",
    images: [...fixturePostPhotos],
    business: {
      id: fixtureBusinessId,
      name: "Profissional simulado",
      slug: "prestador-simulado",
      category: "Climatização",
      city: "Mundo Novo/MS",
      avatarPath: null,
    },
  };
  const publicPosts: PublicPosts = {
    list: async (cursor) => ({
      items: empty || cursor ? [] : [work],
      next:
        empty || cursor ? null : { publishedAt: work.publishedAt, id: work.id },
    }),
    get: async (id) => (id === work.id && !empty ? work : null),
  };
  return { managed, publicPosts, work, snapshot: () => rows };
}
