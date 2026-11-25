import type { ProfessionalCatalog, RegistrationInput } from './types';

export const emptyRegistration: RegistrationInput = {
  type: 'autonomo', name: '', categoryId: '', additionalCategoryIds: [], description: '', cityId: '', areaCityIds: [],
  whatsapp: '', instagram: '', legalName: '', taxId: '',
};
export function normalizeRegistration(input: RegistrationInput): RegistrationInput {
  return { ...input, name: input.name.trim(), description: input.description.trim(),
    whatsapp: input.whatsapp.replace(/\D/g, ''), instagram: input.instagram.trim().replace(/^@/, ''),
    legalName: input.type === 'empresa' ? input.legalName.trim() : '',
    taxId: input.type === 'empresa' ? input.taxId.replace(/\D/g, '') : '',
    additionalCategoryIds: [...new Set(input.additionalCategoryIds ?? [])].filter(id => id !== input.categoryId),
    areaCityIds: Array.from(new Set([input.cityId, ...input.areaCityIds].filter(Boolean))),
  };
}
export function validateRegistration(input: RegistrationInput, catalog: ProfessionalCatalog, step: number): string | null {
  const data = normalizeRegistration(input);
  if (!['autonomo', 'empresa'].includes(data.type)) return 'Escolha o tipo de prestador.';
  if (step < 2) return null;
  if (data.name.length < 2 || data.name.length > 120) return 'Informe um nome profissional entre 2 e 120 caracteres.';
  if (!catalog.categories.some((item) => item.id === data.categoryId)) return 'Selecione uma categoria principal.';
  if (data.additionalCategoryIds.some(id => !catalog.categories.some(category => category.id === id))) return 'Remova as especialidades indisponíveis e selecione apenas categorias ativas.';
  if (catalog.specialtiesAvailable === false && data.additionalCategoryIds.length) return 'As especialidades adicionais aguardam uma atualização do banco.';
  if (!catalog.cities.some((item) => item.id === data.cityId)) return 'Selecione uma cidade disponível.';
  if (data.areaCityIds.some((id) => !catalog.cities.some((city) => city.id === id))) return 'Selecione apenas cidades disponíveis para atendimento.';
  if (data.description.length > 3000) return 'A descrição deve ter até 3000 caracteres.';
  if (step < 3) return null;
  if (input.whatsapp.trim() && !/^[1-9][0-9]{9,14}$/.test(data.whatsapp)) return 'Informe o WhatsApp com código do país e DDD (ex.: 55…).';
  if (data.instagram && !/^[A-Za-z0-9._]{1,30}$/.test(data.instagram)) return 'Informe apenas o usuário do Instagram, sem o endereço do site.';
  if (data.legalName.length > 200) return 'A razão social deve ter até 200 caracteres.';
  if (input.type === 'empresa' && input.taxId.trim() && !/^\d{14}$/.test(data.taxId)) return 'O CNPJ deve conter 14 números, conforme o formato aceito neste cadastro.';
  return null;
}
export function createRegistrationSlug(name: string, suffix: string = crypto.randomUUID()) {
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '') || 'profissional';
  return `${base}-${suffix}`;
}
export function professionalError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if(message.includes('EMAIL_CONFIRMATION_REQUIRED'))return 'Confirme seu e-mail antes de publicar.';
  if(message.includes('PROFILE_INCOMPLETE'))return 'Preencha bio, WhatsApp, categoria, cidade e locais de atendimento antes de publicar.';
  if(message.includes('PUBLICATION_RATE_LIMIT'))return 'Limite de publicações atingido. Aguarde antes de tentar novamente.';
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (['SETUP_REQUIRED','PGRST202','PGRST205','42P01'].includes(code)) return 'O cadastro profissional aguarda uma atualização do banco. Você pode continuar navegando.';
  if (code === '40001') return 'Outro responsável alterou as especialidades. Recarregue o perfil antes de salvar novamente.';
  if (code === '23514') return 'As categorias disponíveis mudaram. Revise a principal e as especialidades adicionais.';
  if (code === '23505') return 'Este identificador já está em uso. Tente novamente para gerar outro.';
  if (code === '42501' || code === 'NOT_MANAGER') return 'Sua conta não tem permissão para editar este perfil. Entre com a conta responsável.';
  if (code === 'NOT_FOUND') return 'Perfil não encontrado ou sem acesso para esta conta.';
  if (code === 'AUTH_REQUIRED') return 'Sua sessão expirou. Entre novamente para continuar.';
  if (code === 'INVALID_INPUT') return 'Revise as informações e as cidades/categorias disponíveis. Recarregue a página se o catálogo mudou.';
  return 'Não foi possível salvar todas as informações. Seu rascunho, se criado, continua na sua conta. Tente novamente.';
}
