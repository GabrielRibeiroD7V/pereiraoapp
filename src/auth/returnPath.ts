export function safeReturnPath(value: string | null) {
  const edit =
    /^\/conta\/profissional\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(editar|servicos|trabalhos|publicacoes|assinatura)$/i;
  return value &&
    ([
      "/admin",
      "/conta",
      "/conta/assinaturas",
      "/conta/dados",
      "/conta/seguranca",
      "/conta/profissional",
      "/conta/profissional/cadastro",
    ].includes(value) ||
      edit.test(value))
    ? value
    : "/conta";
}
