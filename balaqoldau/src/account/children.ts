import {validFamilyContext} from './family.ts';
import type {FamilyContext} from './family.ts';
export const childInterests=['education','creativity','sports'] as const;
export type ChildInterest=typeof childInterests[number];
export interface ChildDetails {fullName?:string|null;gender?:'female'|'male'|null;interests?:ChildInterest[]}
export const interestLabels={education:'m500',creativity:'m501',sports:'m502'};
function details(value:{fullName?:unknown;gender?:unknown;interests?:unknown}):ChildDetails|null {
 const result:ChildDetails={};
 if(value.fullName!==undefined){
  if(value.fullName===null)result.fullName=null;
  else{if(typeof value.fullName!=='string'||value.fullName.length>200||/\p{Cc}/u.test(value.fullName))return null;
   const name=value.fullName.normalize('NFC').trim().replace(/\s+/gu,' ');
   if([...name].length>100||(name&&!/^[\p{L}\p{M} .\u2019'-]+$/u.test(name)))return null;result.fullName=name||null;}
 }
 if(value.gender!==undefined){if(value.gender!==null&&value.gender!=='female'&&value.gender!=='male')return null;result.gender=value.gender;}
 if(value.interests!==undefined){if(!Array.isArray(value.interests)||value.interests.length>3||new Set(value.interests).size!==value.interests.length||!value.interests.every(v=>childInterests.includes(v)))return null;result.interests=[...value.interests].sort() as ChildInterest[];}
 return result;
}
export interface ChildInput extends ChildDetails {nickname:string|null;age:number;region:string;preferences:string[];familyContext?:FamilyContext|null}
export interface Child extends ChildInput {id:string;version:number}
export interface ChildOptions {regions:{slug:string;name:string}[];categories:{slug:string;name:string}[]}
const slug=(value:unknown):value is string=>typeof value==='string'&&value.length<=80&&/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
export function normalizeChild(value:{nickname:string;age:string;region:string;preferences:string[];familyContext?:FamilyContext|null}&ChildDetails):ChildInput|null{
  const extra=details(value);if(!extra)return null;
  if(value.familyContext!==undefined&&!validFamilyContext(value.familyContext,false))return null;
  if(value.nickname.length>100||[...value.nickname].some(c=>{const n=c.charCodeAt(0);return n<32||(n>=127&&n<=159);}))return null;
  const nickname=value.nickname.normalize('NFC').trim().replace(/\s+/gu,' ');
  if([...nickname].length>30||(nickname&&!/^[\p{L}\p{M}\p{N} ._-]+$/u.test(nickname))||/\d{8}/u.test(nickname)||!/^\d+$/.test(value.age)||Number(value.age)>17||!slug(value.region)||value.preferences.length>10||new Set(value.preferences).size!==value.preferences.length||!value.preferences.every(slug))return null;
  return {...extra,nickname:nickname||null,age:Number(value.age),region:value.region,preferences:[...value.preferences].sort(),...(value.familyContext===undefined?{}:{familyContext:value.familyContext})};
}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid child response');return value as Record<string,unknown>;}
export function parseChild(value:unknown):Child{
  const c=record(value),extra=details(c);if(!extra)throw new Error('Invalid child response');
  if(typeof c.id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(c.id)||!Number.isSafeInteger(c.version)||Number(c.version)<1||Number(c.version)>2147483647||!Number.isInteger(c.age)||!slug(c.region)||!(c.nickname===null||typeof c.nickname==='string')||!Array.isArray(c.preferences)||!c.preferences.every(slug)||!normalizeChild({nickname:String(c.nickname??''),age:String(c.age),region:c.region,preferences:c.preferences}))throw new Error('Invalid child response');
  if(c.familyContext!==undefined&&!validFamilyContext(c.familyContext,false))throw new Error('Invalid child response');
  return {...extra,id:c.id,version:Number(c.version),nickname:c.nickname as string|null,age:Number(c.age),region:c.region,preferences:c.preferences,...(c.familyContext===undefined?{}:{familyContext:c.familyContext as FamilyContext|null})};
}
export function parseChildOptions(value:unknown):ChildOptions{
  const result=record(value),parse=(value:unknown)=>{
    if(!Array.isArray(value)||value.length>1000)throw new Error('Invalid child options');
    return value.map(item=>{const row=record(item);if(!slug(row.slug)||typeof row.name!=='string'||!row.name.trim()||row.name.length>160)throw new Error('Invalid child options');return {slug:row.slug,name:row.name};});
  };
  return {regions:parse(result.regions),categories:parse(result.categories)};
}
