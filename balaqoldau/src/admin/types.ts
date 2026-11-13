import {tr} from '../i18n/ui.ts';
export type Role = 'editor' | 'reviewer' | 'admin';
export type Status = 'draft' | 'review' | 'verified' | 'published' | 'rejected' | 'archived';
export type Action = 'submit' | 'approve' | 'reject' | 'publish' | 'unpublish' | 'archive' | 'reopen' | 'request-recheck';
export interface Access { id: string; role: Role; permissions: string[] }
export interface Session { authenticated: boolean; admin: { id: string } | null; csrfToken: string }
export interface Program {
  expiresOn?:string|null;sourceNeedsRecheck?:boolean;expired?:boolean;needsReverification?:boolean;eligibilityComplete?:boolean; id: string; slug: string; category: string; title: string; description: string; status: Status; version: number; isDemo: boolean;
  sourceUrl: string | null; sourceName: string | null; applyUrl: string | null; deadline: string | null; verifiedAt: string | null;
  ageMin: number; ageMax: number; regions: string[]; familyCategories: string[];
  createdBy: string | null; submittedBy: string | null; reviewedBy: string | null;
}
export type ProgramInput = Pick<Program, 'slug' | 'category' | 'title' | 'description' | 'isDemo' | 'sourceUrl' | 'sourceName'
  | 'expiresOn' | 'eligibilityComplete' | 'applyUrl' | 'deadline' | 'ageMin' | 'ageMax' | 'regions' | 'familyCategories'>;
export interface Taxonomy { categories: { slug: string; name: string }[]; regions: { slug: string; name: string }[]; familyCategories: { slug: string; name: string }[] }
export interface VerificationEntry {id:string;actorId:string;programVersion:number;decision:'approve'|'reject'|'recheck';notes:string;createdAt:string;sourceReviewed:boolean;informationReviewed:boolean;eligibilityReviewed:boolean}
export type ReportStatus='open'|'reviewed'|'resolved'|'dismissed';
export interface Report {id:string;programId:string;programTitle:string;reason:'incorrect'|'outdated'|'source_broken'|'other';explanation:string|null;status:ReportStatus;version:number;createdAt:string}
export interface AdminDashboard {counts:Record<Status|'total'|'needsReverification'|'expired',number>;recent:{id:string;title:string;status:Status;version:number;updatedAt:string}[];reviewPeriodDays:number}
export const statuses: Record<Status, string> = { draft: tr("m133"), review: tr("m134"), verified: tr("m135"), published: tr("m136"),rejected:tr("m363"),archived:tr("m364") };
export const roles: Record<Role, string> = { editor: tr("m137"), reviewer: tr("m138"), admin: tr("m139") };
export const actions: Record<Action, string> = { submit: tr("m140"), approve: tr("m141"), reject: tr("m142"), publish: tr("m143"), unpublish: tr("m144"),archive:tr("m365"),reopen:tr("m366"),'request-recheck':tr("m367") };
export function canEdit(access: Access, program: Program) {
  return access.permissions.includes('programs:draft:write') && program.status === 'draft' && (access.role === 'admin' || program.createdBy === access.id);
}
export function permittedActions(access: Access, program: Program): Action[] {
  const result: Action[] = [];
  if (canEdit(access, program) && !program.isDemo && program.sourceUrl && program.sourceName) result.push('submit');
  if (access.permissions.includes('programs:review')) {
    const own = program.createdBy === access.id || program.submittedBy === access.id;
    if (program.status === 'review' && !own) result.push('approve');
    if ((program.status === 'review' && (!own || access.role === 'admin')) || (program.status === 'verified' && access.role === 'admin')) result.push('reject');
  }
  if(access.permissions.includes('programs:draft:write')&&program.status==='rejected'&&(access.role==='admin'||program.createdBy===access.id))result.push('reopen');
  if (access.role === 'admin' && access.permissions.includes('programs:publish')) {
    if(['verified','published'].includes(program.status))result.push('request-recheck');
    if(program.status!=='archived')result.push('archive');else result.push('reopen');
    if (program.status === 'verified' && !program.isDemo && !program.expired&&!program.needsReverification&&!program.sourceNeedsRecheck&&program.reviewedBy && program.verifiedAt) result.push('publish');
    if (program.status === 'published') result.push('unpublish');
  }
  return result;
}
