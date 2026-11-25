import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../lib/database.types";
import type { Offer, OfferCatalog, OffersRepository } from "./model";
import { priceInCents } from "../work/validation";
export function createOffersRepository(
  client: SupabaseClient<Database>,
): OffersRepository {
  async function command(
    business: string,
    id: string,
    command: string,
    data: Json = {},
  ) {
    const r = await client.rpc("offer_command", {
      target_business: business,
      target_offer: id,
      command,
      data,
    });
    if (r.error) throw r.error;
    return r.data;
  }
  return {
    async postOffer(kind, post) {
      const r = await client.rpc("get_post_offer", {
        post_kind: kind,
        target_post: post,
      });
      if (r.error) throw r.error;
      return r.data as unknown as Offer | null;
    },
    async linkPost(kind, post, offer) {
      const r = await client.rpc("set_post_offer", {
        post_kind: kind,
        target_post: post,
        ...(offer
          ? { target_offer: offer.id, offer_source: offer.source }
          : {}),
      });
      if (r.error) throw r.error;
    },
    async catalog() {
      const r = await client.rpc("offers_catalog");
      if (r.error) throw r.error;
      return r.data as unknown as OfferCatalog;
    },
    async list(business, privateView) {
      const r = await client.rpc("offers_query", {
        target_business: business,
        include_private: privateView,
      });
      if (r.error) throw r.error;
      return r.data as unknown as Offer[];
    },
    async get(id, source) {
      const r = await client.rpc("offers_query", { target_offer: id });
      if (r.error) throw r.error;
      return (
        (r.data as unknown as Offer[]).find((o) => o.source === source) ?? null
      );
    },
    async search(f) {
      const r = await client.rpc("search_unified", {
        p_query: f.query,
        p_city: f.city,
        p_area: f.area,
        p_kind: f.kind,
        p_page: f.page,
        p_provider_type: f.providerType,
      });
      if (r.error) throw r.error;
      return r.data as unknown as Awaited<
        ReturnType<OffersRepository["search"]>
      >;
    },
    async save(business, id, input) {
      return (await command(business, id, "save", {
        kind: input.kind,
        name: input.name.trim(),
        description: input.description.trim(),
        areaId: input.areaId,
        activityIds: input.activityIds,
        pricingType: input.pricingType,
        priceCents:
          input.pricingType === "quote" ? null : priceInCents(input.price),
        active: input.active,
        featured: input.kind === "product" && input.featured,
        expectedUpdatedAt: input.expectedUpdatedAt ?? null,
      })) as unknown as Offer;
    },
    async remove(business, id) {
      await command(business, id, "delete");
    },
    async image(path) {
      const r = await client.storage
        .from("business-offers")
        .createSignedUrl(path, 60);
      if (r.error) throw r.error;
      return r.data.signedUrl;
    },
    async upload(business, id, imageId, blob) {
      if (blob.type !== "image/webp" || blob.size < 1 || blob.size > 5242880)
        throw new Error("Imagem inválida.");
      const im = (await command(business, id, "prepare_image", {
        imageId,
      })) as { storage_path?: string };
      const path = `${business}/${id}/${imageId}.webp`;
      if (im.storage_path !== path)
        throw new Error("Resposta de imagem inválida.");
      const finalize = () =>
        command(business, id, "finalize_image", { imageId });
      try {
        await finalize();
        return;
      } catch (e) {
        if (!(e && typeof e === "object" && "code" in e && e.code === "22023"))
          throw e;
      }
      const r = await client.storage
        .from("business-offers")
        .upload(path, blob, {
          contentType: "image/webp",
          upsert: false,
          cacheControl: "60",
        });
      if (r.error) {
        try {
          await finalize();
          return;
        } catch {
          throw r.error;
        }
      }
      await finalize();
    },
  };
}
