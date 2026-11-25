import {InstagramIcon,WhatsappIcon} from '../components/ContactBrandIcons';
import { instagramLink, whatsappLink } from './validation';
export function ContactLinks({ name, whatsapp, instagram, compact = false }: { name: string; whatsapp: string | null; instagram?: string | null; compact?: boolean }) {
  const phone = whatsappLink(whatsapp, name), social = instagramLink(instagram ?? null);
  if (!phone && !social) return null;
  return <div className={compact ? "public-contacts public-contacts--compact" : "public-contacts"}>
    {phone && <a className={compact ? "contact-circle contact-circle--whatsapp" : "button button--primary"} href={phone} aria-label={`WhatsApp de ${name} (abre em nova guia)`} target="_blank" rel="noopener noreferrer"><WhatsappIcon />{!compact && 'WhatsApp'}</a>}
    {social && <a className={compact ? "contact-circle contact-circle--instagram" : "button button--secondary"} href={social} aria-label={`Instagram de ${name} (abre em nova guia)`} target="_blank" rel="noopener noreferrer"><InstagramIcon />{!compact && 'Instagram'}</a>}
  </div>;
}
