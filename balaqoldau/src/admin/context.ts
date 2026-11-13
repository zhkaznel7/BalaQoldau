import { createContext, useContext } from 'react';
import type { AdminApi } from './api';
import type { Access } from './types';
export interface AdminContextValue { api: AdminApi; access: Access; refresh: () => Promise<void> }
export const AdminContext = createContext<AdminContextValue | null>(null);
export function useAdmin() { const value = useContext(AdminContext); if (!value) throw new Error('Admin context missing'); return value; }
