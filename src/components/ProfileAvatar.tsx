import { useState } from 'react';
import { Building2, UserRound } from 'lucide-react';

export function ProfileAvatar({ src, business = false }: { src?: string | null; business?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const safeSrc = src?.startsWith('https://') && src !== failedSrc ? src : undefined;
  const Icon = business ? Building2 : UserRound;
  return <span className={`profile-avatar${business ? ' profile-avatar--business' : ''}`}>
    {safeSrc ? <img src={safeSrc} alt="" referrerPolicy="no-referrer" onError={() => setFailedSrc(safeSrc)} /> : <Icon size={30} strokeWidth={1.5} aria-hidden="true" />}
  </span>;
}
