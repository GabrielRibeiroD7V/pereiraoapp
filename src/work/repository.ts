import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PortfolioRow } from '../lib/database.types';
import type { WorkRepository } from './types';
import { priceInCents, validateService } from './validation';
import { imageBucket, profileImagePath } from '../lib/mediaPath';
import { MAX_UPLOAD_BYTES } from './images';
export const PORTFOLIO_BUCKET = 'business-portfolio';
function fail(code: string): never { throw { code }; }
export function createWorkRepository(client: SupabaseClient<Database>): WorkRepository {
  async function manager(businessId: string) {
    const { data: identity, error } = await client.auth.getUser();
    if (error || !identity.user) fail('AUTH_REQUIRED');
    const membership = await client.from('business_members').select('id').eq('business_id', businessId).eq('user_id', identity.user.id).in('role', ['owner', 'admin']).maybeSingle();
    if (membership.error) throw membership.error;
    if (!membership.data) fail('NOT_MANAGER');
    const readiness = await client.from('portfolio_items').select('media_state').limit(0);
    if (readiness.error) { if (['42703', 'PGRST204'].includes(readiness.error.code)) fail('SETUP_REQUIRED'); throw readiness.error; }
  }
  async function command(businessId: string, name: string, id?: string, extra: { target_service?: string | null; item_caption?: string; ordered_items?: string[] } = {}) {
    const { data, error } = await client.rpc('portfolio_command', { command: name, target_business: businessId, ...(id ? { target_item: id } : {}), ...extra });
    if (error) throw error;
    return data;
  }
  function prepared(value: unknown, businessId: string, id: string): PortfolioRow {
    if (!value || typeof value !== 'object' || !('id' in value) || value.id !== id || !('business_id' in value) || value.business_id !== businessId || !('storage_path' in value) || typeof value.storage_path !== 'string' || !value.storage_path.startsWith(`${businessId}/portfolio/`) || value.storage_path.split('/').length !== 3 || value.storage_path.includes('..') || value.storage_path.includes('\\') || !('media_state' in value)) fail('INVALID_RESPONSE');
    return value as PortfolioRow;
  }
  return {
    async list(businessId) {
      await manager(businessId);
      const [services, photos] = await Promise.all([client.from('services').select('*').eq('business_id', businessId).order('created_at'), client.from('portfolio_items').select('*').eq('business_id', businessId).order('sort_order').order('id')]);
      if (services.error) throw services.error; if (photos.error) throw photos.error;
      return { services: services.data ?? [], photos: photos.data ?? [] };
    },
    async saveService(businessId, id, input, create) {
      if (validateService(input)) fail('INVALID_INPUT');
      await manager(businessId);
      const values = { name: input.name.trim(), description: input.description.trim() || null, category_id: input.categoryId, pricing_type: input.pricingType, price_amount_cents: input.pricingType === 'quote' ? null : priceInCents(input.price), active: input.active };
      if (create) {
        const inserted = await client.from('services').insert({ ...values, id, business_id: businessId }).select('id').single();
        if (!inserted.error) return;
        const prior = await client.from('services').select('id').eq('id', id).eq('business_id', businessId).maybeSingle();
        if (prior.error || !prior.data) throw inserted.error;
      }
      const { data, error } = await client.from('services').update(values).eq('id', id).eq('business_id', businessId).select('id').single();
      if (error) throw error; if (!data) fail('NOT_MANAGER');
    },
    async setServiceActive(businessId, id, active) {
      await manager(businessId);
      const { data, error } = await client.from('services').update({ active }).eq('business_id', businessId).eq('id', id).select('id').single();
      if (error) throw error; if (!data) fail('NOT_MANAGER');
    },
    async deleteService(businessId, id) {
      await manager(businessId);
      const { error } = await client.rpc('delete_business_service', { target_business: businessId, target_service: id });
      if (error) throw error;
    },
    async uploadPhoto(businessId, id, file, caption, serviceId) {
      if (file.type !== 'image/webp' || !file.size || file.size > MAX_UPLOAD_BYTES || caption.trim().length > 500) fail('INVALID_INPUT');
      await manager(businessId);
      const item = prepared(await command(businessId, 'prepare', id, { target_service: serviceId, item_caption: caption.trim() }), businessId, id);
      if (item.storage_path !== `${businessId}/portfolio/${id}.webp`) fail('INVALID_RESPONSE');
      if (item.media_state === 'ready') return;
      try { await command(businessId, 'finalize', id); return; }
      catch (cause) { if (!(cause && typeof cause === 'object' && 'code' in cause && cause.code === '22023')) throw cause; }
      const upload = await client.storage.from(PORTFOLIO_BUCKET).upload(item.storage_path, file, { contentType: 'image/webp', upsert: false, cacheControl: '60' });
      if (upload.error) {
        // Pode ter havido resposta perdida após persistir o arquivo. Não apagar dados automaticamente.
        try { await command(businessId, 'finalize', id); return; } catch { throw upload.error; }
      }
      await command(businessId, 'finalize', id);
    },
    async finalizePhoto(businessId, id) { await manager(businessId); await command(businessId, 'finalize', id); },
    async savePhotoDetails(businessId, id, caption, serviceId) {
      if (caption.trim().length > 500) fail('INVALID_INPUT');
      await manager(businessId);
      const { data, error } = await client.from('portfolio_items').update({ caption: caption.trim() || null, service_id: serviceId }).eq('business_id', businessId).eq('id', id).select('id').single();
      if (error) throw error; if (!data) fail('NOT_MANAGER');
    },
    async deletePhoto(businessId, id) {
      await manager(businessId);
      const result = await command(businessId, 'begin_delete', id);
      if (result && typeof result === 'object' && 'deleted' in result && result.deleted) return;
      const item = prepared(result, businessId, id);
      // Se uma remoção anterior terminou mas a resposta se perdeu, concluir sem depender
      // do comportamento HTTP de remove() para um objeto já ausente.
      try { await command(businessId, 'finish_delete', id); return; }
      catch (cause) { if (!(cause && typeof cause === 'object' && 'code' in cause && cause.code === '55000')) throw cause; }
      const { error } = await client.storage.from(PORTFOLIO_BUCKET).remove([item.storage_path]);
      if (error) throw error;
      await command(businessId, 'finish_delete', id);
    },
    async reorderPhotos(businessId, ids) { await manager(businessId); await command(businessId, 'reorder', undefined, { ordered_items: ids }); },
    async uploadProfilePhoto(businessId, id, file, expectedPath) {
      if (file.type !== 'image/webp' || !file.size || file.size > MAX_UPLOAD_BYTES) fail('INVALID_INPUT');
      await manager(businessId);
      const path = `${businessId}/profile/${id}.webp`;
      if (!profileImagePath(businessId, path)) fail('INVALID_INPUT');
      const call = async (name: string) => {
        const { data, error } = await client.rpc('profile_photo_command', {
          command: name, target_business: businessId, target_photo: id, expected_avatar_path: expectedPath,
        });
        if (error) throw error;
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.storage_path !== path || data.business_id !== businessId || data.id !== id) fail('INVALID_RESPONSE');
        return data;
      };
      await call('prepare'); // Falta de migração falha antes de qualquer upload.
      try { await call('finalize'); return path; }
      catch (cause) { if (!(cause && typeof cause === 'object' && 'code' in cause && cause.code === '22023')) throw cause; }
      const uploaded = await client.storage.from('business-profile').upload(path, file, { contentType: 'image/webp', upsert: false, cacheControl: '60' });
      if (uploaded.error) {
        // O servidor pode ter recebido o arquivo apesar de uma resposta perdida.
        try { await call('finalize'); return path; } catch { throw uploaded.error; }
      }
      await call('finalize');
      return path;
    },
    async removeProfilePhoto(businessId, expectedPath) {
      await manager(businessId);
      const { error } = await client.rpc('profile_photo_command', { command: 'remove', target_business: businessId, expected_avatar_path: expectedPath });
      if (error) throw error;
    },
    async imageUrl(path) {
      const { data, error } = await client.storage.from(imageBucket(path.split('/')[0] ?? '', path) ?? fail('INVALID_INPUT')).createSignedUrl(path, 60);
      if (error) throw error; return data.signedUrl;
    },
  };
}
