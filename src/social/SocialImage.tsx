import { useCallback } from "react";
import { useSocial } from "./SocialProvider";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import type { SocialImage as Image } from "./model";
export function SocialImage({
  image,
  alt = "",
}: {
  image: Image;
  alt?: string;
}) {
  const repository = useSocial();
  const load = useCallback(
    () =>
      repository
        ? repository.image(image)
        : Promise.reject(Error("Unavailable")),
    [repository, image.path, image.bucket],
  );
  const state = usePublicQuery(`social-image:${image.bucket}:${image.path}`, load, true, 45_000);
  return state.data ? (
    <img
      alt={alt}
      src={state.data}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <p role="status">
      {state.loading ? "Carregando foto…" : "Foto indisponível"}
    </p>
  );
}
