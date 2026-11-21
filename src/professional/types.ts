import type { BusinessRow } from '../lib/database.types';
import type { CategoryId, ProviderType } from '../types/domain';

export interface RegistrationInput {
  type: ProviderType;
  name: string;
  categoryId: CategoryId | '';
  additionalCategoryIds: string[];
  expectedSpecialties?: { primaryId: string | null; additionalIds: string[] };
  description: string;
  cityId: string;
  areaCityIds: string[];
  whatsapp: string;
  instagram: string;
  legalName: string;
  taxId: string;
}
export interface ProfessionalCatalog {
  specialtiesAvailable?: boolean;
  cities: { id: string; name: string; state_code: string }[];
  categories: { id: CategoryId; name: string }[];
}
export interface EditableBusiness {
  business: BusinessRow;
  input: RegistrationInput;
}
export interface ProfessionalRepository {
  getCatalog(): Promise<ProfessionalCatalog>;
  listMine(): Promise<readonly BusinessRow[]>;
  getEditable(id: string): Promise<EditableBusiness>;
  createDraft(input: RegistrationInput, slug: string): Promise<string>;
  saveDraft(id: string, input: RegistrationInput): Promise<void>;
}
