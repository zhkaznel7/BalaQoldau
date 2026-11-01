import { useEffect } from 'react';

/** Progressive enhancement: unsupported browsers and reduced motion keep content visible. */
export function useScrollReveal(route: string) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches || !('IntersectionObserver' in window)) return;
    const elements = document.querySelectorAll<HTMLElement>('.section, .bottom-cta, .program-card, .search-form, .page-intro');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-pending');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    elements.forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add('reveal-pending');
        observer.observe(element);
      }
    });
    function showAll() { elements.forEach(element => element.classList.remove('reveal-pending')); observer.disconnect(); }
    media.addEventListener('change', showAll);
    return () => { showAll(); media.removeEventListener('change', showAll); };
  }, [route]);
}
