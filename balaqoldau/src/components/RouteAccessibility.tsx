import {tr} from '../i18n/ui.ts';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function RouteAccessibility() {
  const { pathname,search } = useLocation();
  const previousPath = useRef(pathname);
  useEffect(() => {
    const titles: Record<string, string> = { '/': tr("m159"), '/find': tr("m180"), '/results': tr("m195"), '/favorites': tr("m164"), '/contact': tr("m162") };
    document.title = `${titles[pathname] || (pathname.startsWith('/program/') ? tr("m207") : tr("m020"))} — BalaQoldau`;
    if (previousPath.current !== pathname) {document.getElementById('main')?.focus({ preventScroll: true });window.scrollTo(0, 0);}
    previousPath.current = pathname;
  }, [pathname,search]);
  return null;
}
