import { describe, expect, it } from 'vitest';
import { mapService, servicePrice } from './foundationRepository';

describe('adaptação de serviços e preço', () => {
  it('preserva modalidades e centavos, sem inventar preço', () => {
    expect(servicePrice({ pricing_type: 'quote', price_amount_cents: null })).toEqual({ type: 'quote' });
    expect(servicePrice({ pricing_type: 'fixed', price_amount_cents: 12345 })).toEqual({ type: 'fixed', amountInCents: 12345, currency: 'BRL' });
    expect(servicePrice({ pricing_type: 'starting-at', price_amount_cents: 0 })).toEqual({ type: 'starting-at', amountInCents: 0, currency: 'BRL' });
  });
  it.each([
    { pricing_type: 'quote' as const, price_amount_cents: 10 },
    { pricing_type: 'fixed' as const, price_amount_cents: null },
    { pricing_type: 'starting-at' as const, price_amount_cents: -1 },
  ])('rejeita dados incompatíveis com as constraints', (row) => {
    expect(() => servicePrice(row)).toThrow('Invalid service price');
  });
  it('mapeia o serviço sem usar imagem oficial como trabalho do prestador', () => {
    const row = { id: 'test', business_id: 'business-test', category_id: 'eletrica', name: 'Teste', description: null,
      pricing_type: 'quote' as const, price_amount_cents: null, active: true, created_at: '', updated_at: '' };
    expect(mapService(row).image).toBeNull();
    expect(mapService(row).providerId).toBe('business-test');
    expect(() => mapService({ ...row, category_id: 'not-approved' })).toThrow();
  });
});
