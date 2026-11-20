export function safeReturnPath(value: string | null) {
  const edit = /^\/conta\/profissional\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/editar$/i;
  return value && (['/conta', '/conta/dados', '/conta/profissional', '/conta/profissional/cadastro'].includes(value) || edit.test(value)) ? value : '/conta';
}
