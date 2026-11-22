import { spawn } from 'node:child_process';
import type { Config } from '../config/env.ts';

export type ResetDelivery = (email: string, resetUrl: string) => Promise<void>;
// Optional existing local MTA only; never execute a shell or print mail/token/process output.
export type ReplyDelivery=(email:string,text:string)=>Promise<void>;
function mailDelivery(config:Config,subject:string):ReplyDelivery|undefined {
  const command = config.USER_MAIL_COMMAND, from = config.USER_MAIL_FROM;
  if (!command || !from) return undefined;
  return (email, text) => new Promise<void>((resolve, reject) => {
    if (!/^[^\s@<>]+@[^\s@<>]+$/.test(email) || /[\r\n]/.test(from)) { reject(new Error('Mail delivery unavailable')); return; }
    const child = spawn(command, ['-i', '-t'], { shell: false, windowsHide: true, stdio: ['pipe','ignore','ignore'] });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Password reset delivery unavailable')); }, 5000);
    child.on('error', () => { clearTimeout(timer); reject(new Error('Password reset delivery unavailable')); });
    child.on('close', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error('Password reset delivery unavailable')); });
    child.stdin.on('error', () => { /* Exit/error handler reports only a safe category. */ });
    child.stdin.end(`From: ${from}\r\nTo: ${email}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n`);
  });
}

export function resetDelivery(config:Config):ResetDelivery|undefined {const send=mailDelivery(config,'BalaQoldau password reset');return send?(email,url)=>send(email,'BalaQoldau: '+url):undefined;}
export function replyDelivery(config:Config):ReplyDelivery|undefined {return mailDelivery(config,'BalaQoldau reply');}
