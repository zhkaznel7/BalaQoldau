import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function RouteAccessibility() {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  useEffect(() => {
    const titles: Record<string, string> = { '/': 'Басты бет', '/find': 'Қолдау іздеу', '/results': 'Іздеу нәтижелері', '/favorites': 'Таңдаулылар', '/contact': 'Байланыс' };
    document.title = `${titles[pathname] || (pathname.startsWith('/program/') ? 'Бағдарлама мәліметтері' : 'Бет табылмады')} — BalaQoldau`;
    if (previousPath.current !== pathname) document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    previousPath.current = pathname;
  }, [pathname]);
  return null;
}
