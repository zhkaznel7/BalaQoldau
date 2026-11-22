export function withoutLanguage(search:string):string {
  const params=new URLSearchParams(search);params.delete('lang');return params.toString();
}
export function carryLanguage(previousSearch:string,nextSearch:string):string {
  const previous=new URLSearchParams(previousSearch).get('lang'),next=new URLSearchParams(nextSearch);
  if(['kk','ru'].includes(next.get('lang')??'')||!['kk','ru'].includes(previous??''))return nextSearch;
  next.set('lang',previous!);return '?'+next.toString();
}
