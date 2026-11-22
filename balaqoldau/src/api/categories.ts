import {tr} from '../i18n/ui.ts';
import {currentLanguage} from '../i18n/ui.ts';
import type {Language} from '../i18n/ui.ts';
// Backend taxonomy slugs established by additive migration 012; labels are UI copy.
export const categorySlugs=['benefits','free-courses','grants','clubs'] as const;
const labels={benefits:'m418','free-courses':'m419',grants:'m420',clubs:'m421'} as const;
export function isPublicCategory(slug:unknown):slug is typeof categorySlugs[number] {
  return typeof slug==='string' && Object.hasOwn(labels,slug);
}
export function categoryName(slug:string,fallback=slug,language:Language=currentLanguage()):string {
  return isPublicCategory(slug)?tr(labels[slug],{},language):fallback;
}
export const catalogCategories=()=>categorySlugs.map(slug=>({id:slug,slug,name:categoryName(slug)}));
