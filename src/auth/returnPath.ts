export function safeReturnPath(value: string | null) {
  return value && ['/conta', '/conta/dados', '/conta/profissional', '/conta/profissional/cadastro'].includes(value) ? value : '/conta';
}
