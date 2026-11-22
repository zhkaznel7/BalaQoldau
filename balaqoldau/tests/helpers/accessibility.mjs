// WCAG relative luminance calculation; inputs are opaque sRGB channel values.
export function contrastRatio(foreground, background) {
  const luminance = channels => channels.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

// Runs inside the isolated browser. Scope: computed text colors on solid backgrounds,
// labels, headings and landmarks. It is not an axe audit or full WCAG certification.
export function inspectAccessibility(contrast) {
  const failures = [], skipped = [], ratios = [];
  const rgba = value => {
    const values = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
    return [values[0], values[1], values[2], values[3] ?? 1];
  };
  const blend = (front, back) => front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3]));
  for (const element of document.body.querySelectorAll('*')) {
    if (!(element instanceof HTMLElement) || element.closest('[aria-hidden=true], .sr-only, .logo') || element.matches(':disabled')) continue;
    if (![...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) continue;
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    if (!rect.width || !rect.height || style.visibility !== 'visible' || Number(style.opacity) === 0 || element.tagName === 'OPTION') continue;
    const ancestors = []; let cursor = element;
    while (cursor) { ancestors.unshift(cursor); cursor = cursor.parentElement; }
    if (ancestors.some(node => getComputedStyle(node).backgroundImage !== 'none')) { skipped.push(element.tagName); continue; }
    const background = ancestors.reduce((color, node) => blend(rgba(getComputedStyle(node).backgroundColor), color), [255, 255, 255]);
    const foreground = blend(rgba(style.color), background);
    const ratio = contrast(foreground, background);
    const required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.6667 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
    ratios.push(ratio);
    if (ratio + 0.001 < required) failures.push({ text: element.textContent.trim().slice(0, 60), ratio: +ratio.toFixed(2), required, color: style.color, background: background.map(Math.round) });
  }
  const unlabelled = [...document.querySelectorAll('input,select,textarea')].filter(element => element.type !== 'hidden' && !element.labels?.length && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')).map(element => element.name);
  return { failures, skipped, checkedText: ratios.length, minimumContrast: Math.min(...ratios), unlabelled,
    h1Count: document.querySelectorAll('h1').length, mainCount: document.querySelectorAll('main').length,
    language: document.documentElement.lang };
}
