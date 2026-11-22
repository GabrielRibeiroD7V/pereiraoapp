export function safeReturnPath(value: string | null) {
  const edit =
    /^\/conta\/profissional\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(editar|previa|servicos|trabalhos|publicacoes|assinatura)$/i;
  const chat = /^\/mensagens\/(?:iniciar\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return value &&
    ([
      "/admin",
      "/conta",
      "/conta/assinaturas",
      "/conta/dados",
      "/conta/seguranca",
      "/conta/profissional",
      "/conta/profissional/cadastro",
      "/mensagens",
    ].includes(value) ||
      edit.test(value) || chat.test(value))
    ? value
    : "/conta";
}
