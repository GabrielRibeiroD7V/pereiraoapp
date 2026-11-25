import type { PostInput, WorkCursor } from "./types";
import { validId } from "../marketplace/validation";
export function validatePost(input: PostInput) {
  if (input.title.trim().length < 2 || input.title.trim().length > 120)
    return "Informe um título entre 2 e 120 caracteres.";
  if (input.description.length > 3000)
    return "A descrição deve ter até 3000 caracteres.";
  if (
    input.photos.length > 6 ||
    new Set(input.photos.map((p) => p.id)).size !== input.photos.length ||
    input.photos.some((p) => !validId(p.id))
  )
    return "Escolha até seis fotografias diferentes do seu portfólio.";
  return null;
}
export function missingPosts(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    ["42P01", "PGRST205"].includes(String(error.code))
  );
}
export function validCursor(cursor: WorkCursor) {
  return (
    validId(cursor.id) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      cursor.publishedAt,
    ) &&
    Number.isFinite(Date.parse(cursor.publishedAt))
  );
}
export function postError(error: unknown) {
  const message=error&&typeof error==='object'&&'message' in error?String(error.message):'';
  if(message.includes('EMAIL_CONFIRMATION_REQUIRED'))return 'Confirme seu e-mail antes de publicar.';
  if(message.includes('PUBLICATION_RATE_LIMIT'))return 'Limite de publicações atingido. Tente mais tarde.';
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code === "SETUP_REQUIRED")
    return "As publicações estão sendo preparadas. Seu portfólio continua disponível.";
  if (["42501", "NOT_MANAGER", "AUTH_REQUIRED"].includes(code))
    return "Entre com a conta responsável pelo negócio para continuar.";
  if (code === "23514")
    return "Confira se as fotografias estão prontas e se o conteúdo não está bloqueado pela moderação. Seu rascunho foi preservado.";
  if (code === "22023")
    return "Revise o título, a descrição e a seleção de fotografias.";
  return "Não foi possível concluir. Verifique sua conexão e tente novamente.";
}
