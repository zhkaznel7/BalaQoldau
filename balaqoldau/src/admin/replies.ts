export type InboxKind='contact-messages'|'reports';
export interface Reply {id:string;adminId:string;text:string;deliveryStatus:'account'|'saved_not_delivered'|'email_accepted';createdAt:string;deliveredAt:string|null}
export function parseReply(value:unknown):Reply {
 if(!value||typeof value!=='object')throw new Error('m041');
 const p=value as Record<string,unknown>,uuid=/^[a-f0-9-]{36}$/i;
 if(!uuid.test(String(p.id))||!uuid.test(String(p.adminId))||typeof p.text!=='string'||p.text.length>4000||!['account','saved_not_delivered','email_accepted'].includes(String(p.deliveryStatus))||!Number.isFinite(Date.parse(String(p.createdAt)))||!(p.deliveredAt===null||Number.isFinite(Date.parse(String(p.deliveredAt)))))throw new Error('m041');
 return p as unknown as Reply;
}
export const deliveryLabel={account:'m489',saved_not_delivered:'m490',email_accepted:'m491'};
