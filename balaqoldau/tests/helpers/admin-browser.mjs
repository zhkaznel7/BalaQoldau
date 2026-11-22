import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function adminBrowser(cwd) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const profile = await mkdtemp(path.join(cwd, 'node_modules/.cache/admin-chrome-'));
  const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless', '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let address;
  for (let i = 0; i < 100; i++) {
    try { const lines = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); address = `ws://127.0.0.1:${lines[0]}${lines[1]}`; break; } catch { await delay(100); }
  }
  if (!address) { chrome.kill(); throw new Error('Owned Chrome unavailable'); }
  const socket = new WebSocket(address), pending = new Map(), errors = [], listeners = [];
  const keepAlive = setInterval(() => {}, 1000);
  let seq = 0, session;
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    for (const listener of listeners) listener(message);
    if (message.id) { const task = pending.get(message.id); if (!task) return; pending.delete(message.id); clearTimeout(task.timer); message.error ? task.reject(new Error('CDP request failed')) : task.resolve(message.result); }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  });
  socket.addEventListener('close', () => { for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error('Owned browser closed')); } pending.clear(); });
  const send = (method, params = {}, target = session) => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 10000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error('Browser evaluation failed'); return result.result.value; };
  const until = async expression => { for (let i = 0; i < 120; i++) { if (await evaluate(expression)) return; await delay(50); } throw new Error('Browser condition timed out: ' + expression.slice(0,140)); };
  const setValue = async (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const button = async label => { assert.equal(await evaluate(`(()=>{const el=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!el||el.disabled)return false;el.click();return true;})()`), true, 'Enabled button: ' + label); };
  return { send, evaluate, until, setValue, button, errors, profile, onEvent: listener => listeners.push(listener),
    navigate: url => send('Page.navigate', { url }),
    close: async () => { try { await send('Browser.close', {}, null); } catch { /* Owned browser closes its socket. */ } socket.close(); clearInterval(keepAlive); chrome.kill(); },
  };
}
