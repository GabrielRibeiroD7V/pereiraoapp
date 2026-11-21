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
