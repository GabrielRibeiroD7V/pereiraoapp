import {useReturnRevision} from '../hooks/useReturnRevision';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import { useWorkRepository } from './WorkProvider';
import { workError } from './validation';
import type { BusinessRow, PortfolioRow, ServiceRow } from '../lib/database.types';
import type { ProfessionalCatalog } from '../professional/types';
export interface BusinessWork { business: BusinessRow; catalog: ProfessionalCatalog; services: ServiceRow[]; photos: PortfolioRow[]; authUid: string }
export function useBusinessWork() {
  const resume=useReturnRevision();
  const { businessId = '' } = useParams();
  const { session } = useAuth();
  const professional = useProfessionalRepository();
  const repository = useWorkRepository();
  const [data, setData] = useState<BusinessWork | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    setData((current) => current?.business.id === businessId && current.authUid === session?.user.id ? current : null);
    if (!professional || !repository) { setLoading(false); setError('Este gerenciamento ainda está sendo preparado.'); return; }
    void Promise.all([professional.getEditable(businessId), professional.getCatalog(), repository.list(businessId)]).then(([editable, catalog, work]) => {
      if (live) setData({ business: editable.business, catalog, ...work, authUid: session?.user.id ?? '' });
    }).catch((cause: unknown) => { if (live) setError(workError(cause)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [businessId, session?.user.id, professional, repository, version,resume]);
  return { businessId, repository, data: data?.business.id === businessId && data.authUid === session?.user.id ? data : null, loading, error, refresh: () => setVersion((value) => value + 1) };
}
