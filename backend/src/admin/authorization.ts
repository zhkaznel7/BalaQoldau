export type Role = 'editor' | 'reviewer' | 'admin';
export type Permission = 'programs:read' | 'programs:draft:write' | 'programs:review' | 'programs:publish'
  | 'taxonomy:manage' | 'users:roles:manage' | 'audit:read';
const policy: Record<Role, readonly Permission[]> = {
  editor: ['programs:read', 'programs:draft:write'],
  reviewer: ['programs:read', 'programs:review'],
  admin: ['programs:read', 'programs:draft:write', 'programs:review', 'programs:publish', 'taxonomy:manage', 'users:roles:manage', 'audit:read'],
};
export function permissionsFor(role: unknown): readonly Permission[] {
  return role === 'editor' || role === 'reviewer' || role === 'admin' ? [...policy[role]] : [];
}
export function hasPermission(role: unknown, permission: string): boolean {
  return permissionsFor(role).some(value => value === permission);
}
