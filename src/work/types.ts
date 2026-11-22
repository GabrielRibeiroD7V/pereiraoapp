import type { PortfolioRow, ServiceRow } from '../lib/database.types';
export interface ServiceInput { name: string; description: string; categoryId: string; pricingType: ServiceRow['pricing_type']; price: string; active: boolean }
export interface WorkRepository {
  list(businessId: string): Promise<{ services: ServiceRow[]; photos: PortfolioRow[] }>;
  saveService(businessId: string, id: string, input: ServiceInput, create: boolean): Promise<void>;
  setServiceActive(businessId: string, id: string, active: boolean): Promise<void>;
  deleteService(businessId: string, id: string): Promise<void>;
  uploadPhoto(businessId: string, id: string, file: Blob, caption: string, serviceId: string | null): Promise<void>;
  finalizePhoto(businessId: string, id: string): Promise<void>;
  savePhotoDetails(businessId: string, id: string, caption: string, serviceId: string | null): Promise<void>;
  deletePhoto(businessId: string, id: string): Promise<void>;
  reorderPhotos(businessId: string, ids: string[]): Promise<void>;
  uploadProfilePhoto(businessId: string, id: string, file: Blob, expectedPath: string | null): Promise<string>;
  removeProfilePhoto(businessId: string, expectedPath: string | null): Promise<void>;
  imageUrl(path: string): Promise<string>;
}
