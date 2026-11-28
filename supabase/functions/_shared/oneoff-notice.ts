// Portable projection shared by the Vercel receiver and the Sandbox Edge inbox.
// Notifications are hints, never authoritative payment snapshots.
export const oneoffUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export interface OneoffNotice {
 eventId: string; eventType: string; objectId: string;
 checkoutId: string | null; reference: string | null;
}
export function oneoffNotice(value: unknown): OneoffNotice | null {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
 const p = value as Record<string, unknown>, eventType = p.event;
 if (typeof p.id !== 'string' || !/^[A-Za-z0-9_&-]{3,200}$/.test(p.id) || typeof eventType !== 'string' || !/^(CHECKOUT_(CREATED|PAID|CANCELED|EXPIRED)|PAYMENT_(CREATED|UPDATED|CONFIRMED|RECEIVED|OVERDUE|DELETED|REFUNDED|PARTIALLY_REFUNDED|REFUND_IN_PROGRESS|CREDIT_CARD_CAPTURE_REFUSED|REPROVED_BY_RISK_ANALYSIS|AWAITING_RISK_ANALYSIS|CHARGEBACK_REQUESTED|CHARGEBACK_DISPUTE|AWAITING_CHARGEBACK_REVERSAL))$/.test(eventType)) return null;
 const checkout = eventType.startsWith('CHECKOUT_'), object = checkout ? p.checkout : p.payment;
 if (!object || typeof object !== 'object' || Array.isArray(object)) return null;
 const o = object as Record<string, unknown>;
 if (typeof o.id !== 'string' || !(checkout ? oneoffUuid(o.id) : /^pay_[A-Za-z0-9_-]{1,150}$/.test(o.id))) return null;
 const checkoutId = checkout ? o.id : o.checkoutSession;
 // Foreign references remain untrusted and cannot become internal identifiers.
 return {eventId: p.id, eventType, objectId: o.id, checkoutId: oneoffUuid(checkoutId) ? checkoutId : null, reference: oneoffUuid(o.externalReference) ? o.externalReference : null};
}
