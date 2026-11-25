export function safeReturnPath(value: string | null) {
  const edit =
    /^\/conta\/profissional\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(perfil|editar|previa|servicos|trabalhos|publicacoes|assinatura)$/i;
  const post =
    /^\/conta\/profissional\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:previa\/)?publicacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const chat =
    /^\/mensagens\/(?:iniciar\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return value &&
    ([
      "/admin",
      "/conta",
      "/conta/publicacoes",
      "/conta/assinaturas",
      "/conta/dados",
      "/conta/seguranca",
      "/conta/profissional",
      "/conta/profissional/cadastro",
      "/mensagens",
    ].includes(value) ||
      /^\/(publicacoes|pessoas)\/[0-9a-f-]{36}$/i.test(value) ||
      edit.test(value) ||
      post.test(value) ||
      chat.test(value))
    ? value
    : "/conta";
}
