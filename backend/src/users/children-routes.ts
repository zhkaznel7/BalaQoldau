import type {Request,Response} from 'express';
import type {Database} from '../api/repository.ts';
import {HttpError} from '../middleware/errors.ts';
import {validate,programParams,paginationQuery,emptyInput} from '../api/schemas.ts';
import {findMatches} from '../matching/repository.ts';
import {childInput,childUpdate,childDelete} from './children-schemas.ts';
import {childrenRepository} from './children-repository.ts';
const denied=()=>new HttpError(401,'UNAUTHENTICATED','Authentication required.');
const missing=()=>new HttpError(404,'NOT_FOUND','Resource unavailable.');
const stale=()=>new HttpError(409,'CHILD_CONFLICT','Profile changed; refresh before retrying.');
export async function handleChildren(req:Request,res:Response,db:Database,token:string,csrf:()=>void){
  const repo=childrenRepository(db);res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method==='GET'&&req.path==='/children/options'){
    const result=await repo.options(token);if(!result?.authorized)throw denied();
    if(result.regions.length>1000||result.categories.length>1000)throw new HttpError(503,'AUTH_UNAVAILABLE','Service unavailable.');
    res.json({data:{regions:result.regions,categories:result.categories}});return;
  }
  if(req.method==='GET'&&req.path==='/children'){
    const result=await repo.list(token);if(!result?.authorized)throw denied();res.json({data:result.data});return;
  }
  const match=/^\/children\/([^/]+)(\/recommendations)?$/.exec(req.path);
  const id=match?validate(programParams,{id:match[1]}).id:undefined;
  if(req.method==='GET'&&id){
    const before=await repo.one(token,id);if(!before?.authorized)throw denied();if(!before.data)throw missing();
    if(!match?.[2]){res.json({data:before.data});return;}
    const page=validate(paginationQuery,req.query),child=before.data;
    // Preferences are program categories, never inferred medical/disability/family status.
    const result=await findMatches(db,{...page,age:child.age,region:child.region},undefined,child.preferences);
    const after=await repo.one(token,id);if(!after?.authorized)throw denied();if(!after.data)throw missing();
    if(after.data.version!==child.version)throw stale();res.json(result);return;
  }
  if(req.method==='POST'&&req.path==='/children'){
    csrf();const input=validate(childInput,req.body),result=await repo.write(token,input);
    if(!result?.authorized)throw denied();if(!result.valid)throw new HttpError(400,'VALIDATION_ERROR','Unsupported selection.');
    if(!result.data)throw new HttpError(409,'CHILD_LIMIT','Cannot create profile; refresh and check the profile limit.');
    res.status(201).json({data:result.data});return;
  }
  if(req.method==='PATCH'&&id&&!match?.[2]){
    csrf();const input=validate(childUpdate,req.body),result=await repo.write(token,input,id,input.version);
    if(!result?.authorized)throw denied();if(!result.owned)throw missing();
    if(!result.valid)throw new HttpError(400,'VALIDATION_ERROR','Unsupported selection.');if(!result.data)throw stale();
    res.json({data:result.data});return;
  }
  if(req.method==='DELETE'&&id&&!match?.[2]){
    csrf();const {version}=validate(childDelete,req.body),result=await repo.remove(token,id,version);
    if(!result?.authorized)throw denied();if(!result.owned)throw missing();if(!result.removed)throw stale();res.status(204).end();return;
  }
  validate(emptyInput,req.query);throw new HttpError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
}
