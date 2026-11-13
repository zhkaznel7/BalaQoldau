import {useLocation} from 'react-router-dom';
import {authText} from '../account/translations';
export default function ContentLanguageNotice(){
  const language=new URLSearchParams(useLocation().search).get('lang')==='ru'?'ru':'kk';
  return <p className="field-hint content-language-note">{authText[language].contentFallback}</p>;
}
