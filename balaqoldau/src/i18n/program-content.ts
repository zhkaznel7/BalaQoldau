import type {Program} from '../api/client.ts';
import {currentLanguage} from './ui.ts';
import type {Language} from './ui.ts';

export function programContent(program: Pick<Program,'title'|'description'|'translationRu'>, language:Language=currentLanguage()) {
  const translation=language==='ru' ? program.translationRu : undefined;
  return {...(translation ?? {title:program.title,description:program.description}),
    fallback:language==='ru'&&!translation};
}

export function programExcerpt(description:string) {
  const first=description.trim().split(/\r?\n/)[0] ?? '';
  return first.length>180 ? first.slice(0,180).trimEnd()+'…' : first;
}
