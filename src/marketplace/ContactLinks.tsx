import { Camera, MessageCircle } from 'lucide-react';
import { instagramLink, whatsappLink } from './validation';
export function ContactLinks({ name, whatsapp, instagram }: { name: string; whatsapp: string | null; instagram?: string | null }) {
  const phone = whatsappLink(whatsapp, name), social = instagramLink(instagram ?? null);
  if (!phone && !social) return null;
  return <div className="public-contacts">
    {phone && <a className="button button--primary" href={phone} aria-label={`WhatsApp de ${name} (abre em nova guia)`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" />WhatsApp</a>}
    {social && <a className="button button--secondary" href={social} aria-label={`Instagram de ${name} (abre em nova guia)`} target="_blank" rel="noopener noreferrer"><Camera size={18} aria-hidden="true" />Instagram</a>}
  </div>;
}
