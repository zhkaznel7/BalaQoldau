import type { Database } from '../api/repository.ts';
import { HttpError } from '../middleware/errors.ts';
import { hasPermission } from './authorization.ts';
import type { Permission, Role } from './authorization.ts';
import { tokenHash } from './repository.ts';
import {adminFilters,expiredSql,recheckSql} from './verification-repository.ts';
import type {z} from 'zod';
import type {programListInput} from './program-schemas.ts';
import {matchingToday} from '../matching/engine.ts';
import type { Action, CreateProgram, UpdateProgram,ReviewDecision } from './program-schemas.ts';

import type {Status} from './verification-policy.ts';
export interface AdminProgram extends CreateProgram {
  expiresOn?:string|null;sourceNeedsRecheck?:boolean;id: string; status: Status; version: number; createdBy: string | null; submittedBy: string | null;
  reviewedBy: string | null; verifiedAt: Date | null;
}
const select = `SELECT p.id,p.slug,c.slug AS category,p.title,p.description,p.status,p.version,p.is_demo AS "isDemo",
  p.expires_on::text AS "expiresOn",p.source_needs_recheck AS "sourceNeedsRecheck",p.source_url AS "sourceUrl",p.source_name AS "sourceName",p.apply_url AS "applyUrl",p.verified_at AS "verifiedAt",
  p.eligibility_complete AS "eligibilityComplete",p.age_min AS "ageMin",p.age_max AS "ageMax",p.deadline::text,p.created_by AS "createdBy",p.submitted_by AS "submittedBy",
  p.reviewed_by AS "reviewedBy",p.created_at AS "createdAt",p.updated_at AS "updatedAt",
  ARRAY(SELECT r.slug FROM balaqoldau.program_regions pr JOIN balaqoldau.regions r ON r.id=pr.region_id WHERE pr.program_id=p.id ORDER BY r.slug) AS regions,
  ARRAY(SELECT f.slug FROM balaqoldau.program_family_categories pf JOIN balaqoldau.family_categories f ON f.id=pf.family_category_id WHERE pf.program_id=p.id ORDER BY f.slug) AS "familyCategories"
  FROM balaqoldau.programs p JOIN balaqoldau.categories c ON c.id=p.category_id`;
const bad = () => new HttpError(400, 'VALIDATION_ERROR', 'Invalid program input or taxonomy.');
const forbidden = () => new HttpError(403, 'FORBIDDEN', 'Permission denied.');
const conflict = () => new HttpError(409, 'PROGRAM_CONFLICT', 'Program changed or transition is not allowed.');

export async function programActor(db: Database, token: string, permission: Permission) {
  const actor = (await db.query<{ id: string; role: Role }>(`SELECT u.id,u.role FROM balaqoldau.admin_users u
    JOIN balaqoldau.admin_sessions s ON s.admin_id=u.id WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp()
    AND NOT u.disabled AND s.credential_version=u.credential_version FOR SHARE OF u`, [tokenHash(token)])).rows[0];
  if (!actor) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required.');
  if (!hasPermission(actor.role, permission)) throw forbidden();
  return actor;
}
export async function getAdminProgram(db: Database, id: string, lock = false): Promise<AdminProgram> {
  // Read relation arrays in a fresh snapshot after obtaining the program lock.
  if (lock) await db.query('SELECT id FROM balaqoldau.programs WHERE id=$1 FOR UPDATE', [id]);
  const row = (await db.query<AdminProgram>(select + ' WHERE p.id=$1', [id])).rows[0];
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  return row;
}
export async function listAdminPrograms(db:Database,filters:z.infer<typeof programListInput>,days=180){
 const f=adminFilters(filters,days);
 const total=(await db.query<{total:number}>('SELECT count(*)::int AS total FROM balaqoldau.programs p JOIN balaqoldau.categories c ON c.id=p.category_id'+f.sql,f.params)).rows[0]?.total??0;
 const rows=(await db.query<AdminProgram>(select.replace('SELECT p.id,','SELECT '+expiredSql+' AS "expired",'+recheckSql+' AS "needsReverification",p.id,')+f.sql+' ORDER BY p.updated_at DESC,p.id LIMIT $10 OFFSET $11',[...f.params,filters.limit,(filters.page-1)*filters.limit])).rows;
 return {data:rows,pagination:{page:filters.page,limit:filters.limit,total,totalPages:Math.ceil(total/filters.limit)}};
}
export async function adminProgramTaxonomy(db: Database) {
  const categories = (await db.query<{ slug: string; name: string }>('SELECT slug,name FROM balaqoldau.categories ORDER BY name,slug LIMIT 1001')).rows;
  const regions = (await db.query<{ slug: string; name: string }>('SELECT slug,name FROM balaqoldau.regions ORDER BY name,slug LIMIT 1001')).rows;
  const familyCategories = (await db.query<{ slug: string; name: string }>('SELECT slug,name FROM balaqoldau.family_categories ORDER BY name,slug LIMIT 1001')).rows;
  if ([categories, regions, familyCategories].some(items => items.length > 1000)) throw new HttpError(503, 'ADMIN_UNAVAILABLE', 'Taxonomy limit exceeded.');
  return { categories, regions, familyCategories };
}
async function taxonomy(db: Database, input: CreateProgram) {
  const realReference=" AND ($2::boolean OR (slug !~* '^demo(-|$)' AND name !~* '^DEMO'))";
  const category = (await db.query<{ id: string }>('SELECT id FROM balaqoldau.categories WHERE slug=$1'+realReference, [input.category,input.isDemo])).rows[0];
  const regions = (await db.query<{ id: string }>('SELECT id FROM balaqoldau.regions WHERE slug=ANY($1::text[])'+realReference+' ORDER BY id', [input.regions,input.isDemo])).rows;
  const families = (await db.query<{ id: string }>('SELECT id FROM balaqoldau.family_categories WHERE slug=ANY($1::text[])'+realReference+' ORDER BY id', [input.familyCategories,input.isDemo])).rows;
  if (!category || regions.length !== input.regions.length || families.length !== input.familyCategories.length) throw bad();
  return { category: category.id, regions: regions.map(row => row.id), families: families.map(row => row.id) };
}
async function links(db: Database, id: string, refs: Awaited<ReturnType<typeof taxonomy>>, replace: boolean) {
  if (replace) {
    await db.query('DELETE FROM balaqoldau.program_regions WHERE program_id=$1', [id]);
    await db.query('DELETE FROM balaqoldau.program_family_categories WHERE program_id=$1', [id]);
  }
  await db.query('INSERT INTO balaqoldau.program_regions(program_id,region_id) SELECT $1,unnest($2::bigint[])', [id, refs.regions]);
  await db.query('INSERT INTO balaqoldau.program_family_categories(program_id,family_category_id) SELECT $1,unnest($2::bigint[])', [id, refs.families]);
}
async function log(db: Database, event: string, actor: string, id: string, permission: Permission, previous: Status | null, next: Status) {
  await db.query(`INSERT INTO balaqoldau.admin_audit_log(event,actor_id,target_id,permission,previous_status,new_status)
    VALUES($1,$2,$3,$4,$5,$6)`, [event, actor, id, permission, previous, next]);
}
export async function createAdminProgram(db: Database, actor: string, input: CreateProgram) {
  const refs = await taxonomy(db, input);
  const row = (await db.query<{ id: string }>(`INSERT INTO balaqoldau.programs(slug,category_id,title,description,is_demo,source_url,source_name,
    apply_url,age_min,age_max,deadline,created_by,status,eligibility_complete,expires_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13,$14) RETURNING id`,
  [input.slug, refs.category, input.title, input.description, input.isDemo, input.sourceUrl, input.sourceName,
    input.applyUrl, input.ageMin, input.ageMax, input.deadline, actor, input.eligibilityComplete??false,input.expiresOn??null])).rows[0]!;
  await links(db, row.id, refs, false);
  await log(db, 'program.created', actor, row.id, 'programs:draft:write', null, 'draft');
  return getAdminProgram(db, row.id);
}
export async function updateAdminProgram(db: Database, actor: { id: string; role: Role }, id: string, input: UpdateProgram) {
  const current = await getAdminProgram(db, id, true);
  if (actor.role !== 'admin' && current.createdBy !== actor.id) throw forbidden();
  if (current.status !== 'draft' || current.version !== input.version) throw conflict();
  const merged: CreateProgram = {
    expiresOn:input.expiresOn===undefined?current.expiresOn??null:input.expiresOn,slug: input.slug ?? current.slug, category: input.category ?? current.category,
    title: input.title ?? current.title, description: input.description ?? current.description,
    eligibilityComplete:input.eligibilityComplete??current.eligibilityComplete??false, isDemo: current.isDemo, ageMin: input.ageMin ?? current.ageMin, ageMax: input.ageMax ?? current.ageMax,
    sourceUrl: input.sourceUrl === undefined ? current.sourceUrl : input.sourceUrl,
    sourceName: input.sourceName === undefined ? current.sourceName : input.sourceName,
    applyUrl: input.applyUrl === undefined ? current.applyUrl : input.applyUrl,
    deadline: input.deadline === undefined ? current.deadline : input.deadline,
    regions: input.regions ?? current.regions, familyCategories: input.familyCategories ?? current.familyCategories,
  };
  if (merged.ageMin > merged.ageMax) throw bad();
  const refs = await taxonomy(db, merged);
  await db.query(`UPDATE balaqoldau.programs SET slug=$2,category_id=$3,title=$4,description=$5,source_url=$6,source_name=$7,
    apply_url=$8,age_min=$9,age_max=$10,deadline=$11,submitted_by=NULL,reviewed_by=NULL,verified_at=NULL,
    eligibility_complete=$12,expires_on=$13,updated_at=clock_timestamp(),version=version+1 WHERE id=$1`, [id, merged.slug, refs.category, merged.title, merged.description,
    merged.sourceUrl, merged.sourceName, merged.applyUrl, merged.ageMin, merged.ageMax, merged.deadline, merged.eligibilityComplete,merged.expiresOn]);
  await links(db, id, refs, true);
  if(current.ageMin!==merged.ageMin||current.ageMax!==merged.ageMax||JSON.stringify(current.regions)!==JSON.stringify([...merged.regions].sort())||JSON.stringify(current.familyCategories)!==JSON.stringify([...merged.familyCategories].sort())||current.eligibilityComplete!==merged.eligibilityComplete)await log(db,'program.eligibility_changed',actor.id,id,'programs:draft:write','draft','draft');
  await log(db, 'program.updated', actor.id, id, 'programs:draft:write', 'draft', 'draft');
  return getAdminProgram(db, id);
}
export async function transitionAdminProgram(db:Database,actor:{id:string;role:Role},id:string,action:Action,version:number,decision:ReviewDecision={},reviewDays=180){
  const permission:Permission=action==='submit'||action==='reopen'?'programs:draft:write':
    ['approve','reject'].includes(action)?'programs:review':'programs:publish';
  if(!hasPermission(actor.role,permission))throw forbidden();
  const p=await getAdminProgram(db,id,true);if(p.version!==version)throw conflict();
  const own=p.createdBy===actor.id||p.submittedBy===actor.id;
  const expired=!!((p.deadline&&p.deadline<matchingToday())||(p.expiresOn&&p.expiresOn<matchingToday()));
  let state:Status=p.status,event:string;
  if(action==='submit'){
    if(actor.role!=='admin'&&p.createdBy!==actor.id)throw forbidden();
    if(p.status!=='draft'||p.isDemo||!p.sourceUrl||!p.sourceName)throw conflict();
    state='review';event='program.submitted';
  }else if(action==='approve'){
    if(own)throw forbidden();if(p.status!=='review'||p.isDemo||expired||!p.sourceUrl||!p.sourceName||!p.title.trim()||!p.description.trim()||!p.regions.length)throw conflict();
    await taxonomy(db,p); // Legacy DEMO references cannot be certified as real eligibility.
    if(!decision.sourceReviewed||!decision.informationReviewed||!decision.eligibilityReviewed)throw bad();
    state='verified';event='program.approved';
  }else if(action==='reject'){
    if(own&&actor.role!=='admin')throw forbidden();
    if(p.status!=='review'&&!(actor.role==='admin'&&p.status==='verified'))throw conflict();
    if(!decision.notes?.trim())throw bad();state='rejected';event='program.rejected';
  }else if(action==='publish'){
    if(actor.role!=='admin')throw forbidden();
    if(p.status!=='verified'||p.isDemo||!p.reviewedBy||!p.verifiedAt||p.sourceNeedsRecheck||expired||new Date(p.verifiedAt).getTime()<=Date.now()-reviewDays*86400000)throw conflict();
    // An older status alone is not a completed Stage 16 source review.
    if(!(await db.query(`SELECT 1 FROM balaqoldau.program_verifications WHERE program_id=$1 AND decision='approve'
      AND program_version=$2 AND source_reviewed AND information_reviewed AND eligibility_reviewed`,[id,p.version])).rows.length)throw conflict();
    state='published';event='program.published';
  }else if(action==='unpublish'){
    if(actor.role!=='admin')throw forbidden();if(p.status!=='published')throw conflict();state='draft';event='program.unpublished';
  }else if(action==='archive'){
    if(actor.role!=='admin')throw forbidden();if(p.status==='archived')throw conflict();state='archived';event='program.archived';
  }else if(action==='reopen'){
    if(actor.role!=='admin'&&(p.createdBy!==actor.id||p.status==='archived'))throw forbidden();
    if(!['rejected','archived'].includes(p.status))throw conflict();state='draft';event='program.reopened';
  }else{
    if(!['verified','published'].includes(p.status)||!decision.notes?.trim())throw conflict();event='program.recheck_requested';
  }
  if(['approve','reject','request-recheck'].includes(action))await db.query(`INSERT INTO balaqoldau.program_verifications
    (program_id,actor_id,program_version,decision,source_reviewed,information_reviewed,eligibility_reviewed,notes,source_url,source_name)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,actor.id,p.version+1,action==='request-recheck'?'recheck':action,
    decision.sourceReviewed??false,decision.informationReviewed??false,decision.eligibilityReviewed??false,decision.notes??'',p.sourceUrl,p.sourceName]);
  await db.query(`UPDATE balaqoldau.programs SET status=$2::text,version=version+1,updated_at=clock_timestamp(),
    source_needs_recheck=CASE WHEN $3='request-recheck' THEN true WHEN $3='approve' THEN false ELSE source_needs_recheck END,
    submitted_by=CASE WHEN $3='submit' THEN $4::uuid WHEN $2='draft' THEN NULL ELSE submitted_by END,
    reviewed_by=CASE WHEN $3 IN('approve','reject') THEN $4::uuid WHEN $2='draft' THEN NULL ELSE reviewed_by END,
    verified_at=CASE WHEN $3='approve' THEN clock_timestamp() WHEN $2 IN('draft','review','rejected') THEN NULL ELSE verified_at END WHERE id=$1`,[id,state,action,actor.id]);
  await log(db,event,actor.id,id,permission,p.status,state);return getAdminProgram(db,id);
}
