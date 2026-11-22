// Validação pura compartilhada entre navegador e servidor; sem dependências de UI.
export const validId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function imagePath(id: string, path: string) {
  return (
    validId(id) &&
    path.startsWith(`${id}/portfolio/`) &&
    /^[0-9a-f-]{36}\.(?:webp|png|jpe?g)$/i.test(
      path.slice(`${id}/portfolio/`.length),
    ) &&
    validId(path.slice(`${id}/portfolio/`.length).replace(/\.[^.]+$/, ""))
  );
}

// Retrato separado do portfólio; nomes de bucket nunca vêm de entrada livre.
export function profileImagePath(id: string, path: string) {
  const prefix = `${id}/profile/`;
  return validId(id) && path.startsWith(prefix) && path.endsWith('.webp')
    && validId(path.slice(prefix.length, -5));
}
export function imageBucket(id: string, path: string): 'business-profile' | 'business-portfolio' | null {
  return profileImagePath(id, path) ? 'business-profile' : imagePath(id, path) ? 'business-portfolio' : null;
}
