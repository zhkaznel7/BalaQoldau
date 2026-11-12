import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

const prefix = '$argon2id$v=19$m=19456,t=2,p=1$';
let active = 0;
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (active >= 2) throw new Error('Password service busy');
  active++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      argon2('argon2id', { message: password, nonce: salt, parallelism: 1, tagLength: 32, memory: 19456, passes: 2 },
        (error, tag) => error ? reject(new Error('Password service failed')) : resolve(tag));
    });
  } finally { active--; }
}
export async function hashPassword(password: string): Promise<string> {
  if ([...password].length < 15 || Buffer.byteLength(password) > 256) throw new Error('Invalid password');
  const salt = randomBytes(16);
  return prefix + salt.toString('base64') + '$' + (await derive(password, salt)).toString('base64');
}
export async function verifyPassword(hash: string | undefined, password: string): Promise<boolean> {
  const parts = hash?.startsWith(prefix) ? hash.slice(prefix.length).split('$') : [];
  const valid = parts.length === 2 && /^[A-Za-z0-9+/]{22}==$/.test(parts[0] ?? '') && /^[A-Za-z0-9+/]{43}=$/.test(parts[1] ?? '');
  // Unknown/disabled accounts still pay the same KDF cost, without a default password.
  const salt = valid ? Buffer.from(parts[0]!, 'base64') : Buffer.alloc(16);
  const expected = valid ? Buffer.from(parts[1]!, 'base64') : Buffer.alloc(32);
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected) && valid;
}
