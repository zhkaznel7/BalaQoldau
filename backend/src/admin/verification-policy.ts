export type Status='draft'|'review'|'verified'|'published'|'rejected'|'archived';
export function verificationFlags(p:{verifiedAt:Date|string|null;deadline:string|null;expiresOn?:string|null;sourceNeedsRecheck?:boolean},days:number,today:string,now=Date.now()){
  return {expired:!!((p.deadline&&p.deadline<today)||(p.expiresOn&&p.expiresOn<today)),
    needsReverification:!!p.sourceNeedsRecheck||!p.verifiedAt||new Date(p.verifiedAt).getTime()<=now-days*86400000};
}
