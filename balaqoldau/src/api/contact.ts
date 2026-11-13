import {tr} from '../i18n/ui.ts';
import type { ContactInput } from './client.ts';
function hasControl(value: string, allowLines = false): boolean {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code === 127 || (code < 32 && !(allowLines && [9, 10, 13].includes(code)));
  });
}
export function validContactEmail(email: string): boolean {
  return email.length <= 254 && /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/.test(email);
}
export function validateContact(input: ContactInput): Partial<Record<keyof ContactInput, string>> {
  const errors: Partial<Record<keyof ContactInput, string>> = {};
  if (!input.senderName.trim() || [...input.senderName.trim()].length > 100 || hasControl(input.senderName)) errors.senderName = tr("m151");
  // Match the backend's pinned Zod email policy; a cross-layer test guards upgrades.
  if (!validContactEmail(input.email)) errors.email = tr("m152");
  if (!input.message.trim() || [...input.message.trim()].length > 2000 || hasControl(input.message, true)) errors.message = tr("m153");
  return errors;
}
