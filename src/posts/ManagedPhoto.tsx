import { useCallback, useState } from "react";
import { usePosts } from "./PostsProvider";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import type { PostPhoto } from "./types";
export function ManagedPhoto({
  businessId,
  photo,
}: {
  businessId: string;
  photo: PostPhoto;
}) {
  const { managed } = usePosts();
  const load = useCallback(
    () =>
      managed
        ? managed.imageUrl(businessId, photo.path)
        : Promise.reject(new Error("Unavailable")),
    [managed, businessId, photo.path],
  );
  const [failed, setFailed] = useState<string | null>(null);
  const state = usePublicQuery(`${businessId}:${photo.path}`, load);
  return state.data && failed !== state.data ? (
    <img
      src={state.data}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(state.data!)}
    />
  ) : (
    <span className="field-help">
      {state.loading ? "Carregando…" : "Imagem indisponível"}
    </span>
  );
}
