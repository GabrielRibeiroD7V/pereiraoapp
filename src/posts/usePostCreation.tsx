import type { PostPhoto } from "./types";
import { useRef, useState } from "react";
import { PostEditor } from "./PostEditor";
import { usePosts } from "./PostsProvider";
/** Input mounted before the user's tap: Safari keeps native-picker activation. */
export function usePostCreation(
  businessId: string,
  onSelected: () => void,
  onSaved: () => void,
  businessName?: string,
) {
  const input = useRef<HTMLInputElement>(null),
    [files, setFiles] = useState<File[] | null>(null);
  const { managed } = usePosts();
  const [existing, setExisting] = useState<PostPhoto[]>([]),
    [description, setDescription] = useState("");
  return {
    startWithPhoto: (photo: PostPhoto) => {
      setExisting([photo]);
      setDescription(photo.caption ?? "");
      setFiles([]);
      onSelected();
    },
    choose: () => {
      if (input.current) {
        input.current.value = "";
        input.current.click();
      }
    },
    input: (
      <input
        hidden
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        aria-label="Selecionar fotos para nova publicação"
        onChange={(event) => {
          const selected = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (selected.length) {
            setExisting([]);
            setDescription("");
            setFiles(selected);
            onSelected();
          }
        }}
      />
    ),
    editor: files && (
      <PostEditor
        businessId={businessId}
        businessName={businessName}
        initialFiles={files}
        initialPhotos={existing}
        initialDescription={description}
        onClose={() => setFiles(null)}
        onSave={async (id, value) => {
          if (!managed) throw { code: "SETUP_REQUIRED" };
          await managed.save(businessId, id, value);
          onSaved();
        }}
      />
    ),
  };
}
