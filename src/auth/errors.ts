export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
    weak_password: 'Escolha uma senha mais forte, com pelo menos 8 caracteres.',
    over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    over_email_send_rate_limit: 'Aguarde alguns minutos antes de solicitar outro e-mail.',
    same_password: 'Escolha uma senha diferente da anterior.',
    otp_expired: 'Este link expirou. Solicite um novo e-mail.',
    flow_state_not_found: 'Abra o link no mesmo navegador usado para iniciar a solicitação ou solicite um novo link.',
    flow_state_expired: 'Este link expirou. Solicite um novo e-mail.',
  };
  // Não expor payloads, tokens, mensagens SQL ou detalhes técnicos ao usuário.
  return messages[code] ?? 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
}
