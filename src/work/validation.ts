import type { ServiceInput } from './types';
export const emptyService: ServiceInput = { name: '', description: '', categoryId: '', pricingType: 'quote', price: '', active: true };
export function priceInCents(value: string) {
  const clean = value.trim();
  if (!/^\d{1,7}([,.]\d{1,2})?$/.test(clean)) return null;
  const [units = '0', decimals = ''] = clean.replace(',', '.').split('.');
  const cents = Number(units) * 100 + Number(decimals.padEnd(2, '0'));
  return cents <= 999999999 ? cents : null;
}
export function validateService(input: ServiceInput) {
  if (input.name.trim().length < 2 || input.name.trim().length > 120) return 'Informe um nome entre 2 e 120 caracteres.';
  if (input.description.trim().length > 2000) return 'A descrição deve ter até 2000 caracteres.';
  if (!input.categoryId) return 'Selecione uma categoria.';
  if (!['fixed', 'starting-at', 'quote'].includes(input.pricingType)) return 'Selecione o tipo de preço.';
  if (input.pricingType !== 'quote' && priceInCents(input.price) === null) return 'Informe um preço válido, como 150,00 (máximo R$ 9.999.999,99).';
  return null;
}
export function workError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (['SETUP_REQUIRED', 'PGRST202', 'PGRST204', '42703'].includes(code)) return 'Este gerenciamento aguarda uma atualização do banco e das imagens. Continue explorando o PEREIRÃO.';
  if (['42501', 'NOT_MANAGER', 'AUTH_REQUIRED'].includes(code)) return 'Sua conta não tem acesso a este negócio. Entre com a conta responsável.';
  if (code === '23503') return 'O serviço selecionado não está disponível neste negócio. Atualize a lista.';
  if (code === '40001') return 'A lista mudou. Atualize antes de organizar novamente.';
  if (code === '22023') return 'O envio não foi concluído. Selecione novamente a imagem para retomar.';
  if (code === '55000') return 'Há uma exclusão pendente. Atualize a lista e tente concluir a exclusão.';
  return 'Não foi possível concluir. Atualize a lista e retome a operação pendente.';
}
export function formatPrice(type: ServiceInput['pricingType'], cents: number | null) {
  if (type === 'quote') return 'Sob orçamento';
  const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);
  return type === 'starting-at' ? `A partir de ${price}` : price;
}
