// Só um recurso comprovadamente ausente permite compatibilidade com o banco anterior.
// Erros de autorização, rede e validação nunca são convertidos em sucesso.
export function missingSpecialties(error: unknown, resource = 'business_categories') {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = String(error.code);
  const message = 'message' in error ? String(error.message) : '';
  return ['42P01', 'PGRST200', 'PGRST202', 'PGRST205'].includes(code) && message.includes(resource);
}
