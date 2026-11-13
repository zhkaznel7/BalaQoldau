import {tr,currentLanguage} from '../i18n/ui.ts';
import type {Language} from '../i18n/ui.ts';
export const regionSlugs=['abay','akmola','aktobe','almaty-region','atyrau','west-kazakhstan','zhambyl','zhetisu','karaganda','kostanay','kyzylorda','mangystau','pavlodar','north-kazakhstan','turkistan','ulytau','east-kazakhstan','astana','almaty-city','shymkent'] as const;
const regionKeys=Object.fromEntries(regionSlugs.map((slug,index)=>[slug,'m'+(422+index)]));
const needs:Record<string,string>={'education-support':'m442','creative-development':'m443','sports-activities':'m444'};
export interface Reference {slug:string;name:string}
export const isDemoReference=(item:Reference)=>/^demo(?:-|$)/i.test(item.slug)||/^DEMO\b/i.test(item.name);
export function referenceName(kind:'regions'|'familyCategories',slug:string,fallback:string,language:Language=currentLanguage()):string {
  if(isDemoReference({slug,name:fallback}))return tr('m451',{},language);
  const labels=kind==='regions'?regionKeys:needs;
  return Object.hasOwn(labels,slug)?tr(labels[slug],{},language):fallback;
}
export function nationwideRegions(options:Reference[]):string[]{
  return regionSlugs.every(slug=>options.some(item=>item.slug===slug&&!isDemoReference(item)))?[...regionSlugs]:[];
}
