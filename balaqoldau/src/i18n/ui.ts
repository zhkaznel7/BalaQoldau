import {kk} from './kk.ts';
import {ru} from './ru.ts';
import {authText} from '../account/translations.ts';
export type Language='kk'|'ru';
export function currentLanguage():Language {return typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('lang')==='ru'?'ru':'kk';}
const dictionaries={kk,ru};
const reverse=new Map<string,string>();
for(const [key,value]of Object.entries(kk)){reverse.set(value,key);reverse.set(ru[key as keyof typeof ru],key);}
export function tr(value:string|undefined,params:Record<string,unknown>={},language:Language=currentLanguage()):string {
  if(value===undefined)return '';
  const key=(value in kk?value:reverse.get(value)) as keyof typeof kk|undefined;
  let text=key?dictionaries[language][key]:value;
  if(!key){for(const key of Object.keys(authText.kk)as (keyof typeof authText.kk)[]){if(value===authText.kk[key]||value===authText.ru[key]){text=authText[language][key];break;}}}
  return text.replace(/\{(\d+)\}/g,(token,index:string)=>Object.hasOwn(params,index)?String(params[index]??''):token);
}
export function dateLocale(){return currentLanguage()==='ru'?'ru-KZ':'kk-KZ';}
