import type { ContactInput } from './client.ts';
function hasControl(value: string, allowLines = false): boolean {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code === 127 || (code < 32 && !(allowLines && [9, 10, 13].includes(code)));
  });
}
export function validateContact(input: ContactInput): Partial<Record<keyof ContactInput, string>> {
  const errors: Partial<Record<keyof ContactInput, string>> = {};
  if (!input.senderName.trim() || [...input.senderName.trim()].length > 100 || hasControl(input.senderName)) errors.senderName = 'Атыңызды енгізіңіз (100 таңбаға дейін).';
  // Match the backend's pinned Zod email policy; a cross-layer test guards upgrades.
  if (input.email.length > 254 || !/^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/.test(input.email)) errors.email = 'Жарамды email енгізіңіз.';
  if (!input.message.trim() || [...input.message.trim()].length > 2000 || hasControl(input.message, true)) errors.message = 'Хабарлама 1–2000 таңба болуы керек.';
  return errors;
}
