import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import { emptyPresentation, normalizePresentation, validatePresentation } from './model';
import type { Presentation, PresentationRepository } from './model';
const legacyColumns = 'headline,experience,education,certifications,professional_registration';
export function createPresentationRepository(client: SupabaseClient<Database>, publicClient: SupabaseClient<Database>): PresentationRepository {
  let identityAvailable = true;
  return {
    async get(id, publicOnly) {
      const source = publicOnly ? publicClient : client;
      const read = (columns: string) => source.from('business_presentations').select(columns).eq('business_id',id).maybeSingle().overrideTypes<Presentation | null, { merge: false }>();
      let result = await read(legacyColumns + ',profession,linkedin_url');
      identityAvailable = true;
      if (result.error && ['42703','PGRST204'].includes(result.error.code) && /profession|linkedin_url/.test(result.error.message)) {
        identityAvailable = false; result = await read(legacyColumns);
      }
      if (result.error && ['42P01','PGRST205'].includes(result.error.code)) return { available: false, identityAvailable: false, data: { ...emptyPresentation } };
      if (result.error) throw result.error;
      return { available: true, identityAvailable, data: { ...emptyPresentation, ...result.data } as typeof emptyPresentation };
    },
    async save(id, value) {
      const error = validatePresentation(value); if (error) throw new Error(error);
      const input = normalizePresentation(value);
      const args = { target_business:id, p_headline:input.headline, p_experience:input.experience, p_education:input.education, p_certifications:input.certifications, p_registration:input.professional_registration };
      if (!identityAvailable && (input.profession || input.linkedin_url)) throw new Error('Profissão e LinkedIn aguardam ativação autorizada.');
      const result = identityAvailable ? await client.rpc('save_business_presentation_identity', { ...args,p_profession:input.profession,p_linkedin_url:input.linkedin_url }) : await client.rpc('save_business_presentation',args);
      if (result.error) throw result.error; // Never silently downgrade a write after a new-field error.
    },
  };
}
