// Optional local QA against an owned Chrome debugging session on port 9228.
// Start Vite first. No browser packages or application dependencies are required.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const tabs = await (await fetch('http://127.0.0.1:9228/json')).json();
const tab = tabs.find(item => item.type === 'page');
assert.ok(tab, 'Chrome page is available');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}
async function navigate(path) {
  await send('Page.navigate', { url: `http://127.0.0.1:5173${path}` });
  await until('document.readyState === "complete" && !!document.querySelector("main")');
}
async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.mkdir('node_modules/.cache', { recursive: true });
  await fs.writeFile(`node_modules/.cache/qa-${name}.png`, Buffer.from(result.data, 'base64'));
}
try {
  await send('Page.enable');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 760 });
    await navigate('/');
    await new Promise(resolve => setTimeout(resolve, 800));
    const metrics = await evaluate('({ width: innerWidth, scroll: document.documentElement.scrollWidth })');
    assert.ok(metrics.scroll <= metrics.width, `No horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
    await screenshot(`home-${width}`);
    console.log(`Responsive layout: ${width}px passed`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 1100, deviceScaleFactor: 1, mobile: true });
  await navigate('/');
  await evaluate('document.querySelector(".mobile-toggle").click()');
  assert.equal(await evaluate('document.querySelector(".mobile-toggle").getAttribute("aria-expanded")'), 'true');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await until('document.querySelector(".mobile-toggle").getAttribute("aria-expanded") === "false"');
  console.log('Mobile menu opens and Escape closes it');
  await evaluate(`(() => { const select = document.querySelector('.hero-finder select[name="region"]'); select.selectedIndex = 1; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await evaluate('document.querySelector(".hero-finder").requestSubmit()');
  await until('location.pathname === "/results" && !!document.querySelector(".program-card")');
  assert.equal(await evaluate('new URLSearchParams(location.search).get("region")'), 'Алматы');
  assert.equal(await evaluate('document.querySelectorAll(".program-card").length'), 2);
  await evaluate('document.querySelector(".save-button").click()');
  await until('document.querySelector(".save-button").getAttribute("aria-pressed") === "true"');
  await navigate('/favorites');
  await until('!!document.querySelector(".program-card")');
  assert.equal(await evaluate('document.querySelectorAll(".program-card").length'), 1);
  await evaluate('document.querySelector(".save-button").click()');
  await until('!!document.querySelector(".empty")');
  console.log('Hero search, favorites persistence and removal passed');
  await navigate('/results?q=табылмайтын');
  await until('!!document.querySelector(".empty-results")');
  await evaluate('document.querySelector(".reset-filters").click()');
  await until('document.querySelectorAll(".program-card").length === 6');
  await screenshot('results-mobile');
  console.log('Empty state and clear filters passed');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('/');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".hero-copy")).animationName'), 'none');
  console.log('Reduced motion passed');
} finally {
  await send('Browser.close').catch(() => {});
  socket.close();
}
