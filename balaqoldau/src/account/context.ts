import {createContext,useContext} from 'react';
import type {createUserApi,UserSession} from './api';
import type {AuthMessage} from './translations';
export interface UserState {session:UserSession|null;ready:boolean;error:AuthMessage|null}
export interface UserContext extends UserState {
  api:ReturnType<typeof createUserApi>;refresh:()=>Promise<void>;accept:(session:UserSession|null)=>void;
  revision:number;changed:()=>void;
}
export const UserContext=createContext<UserContext|null>(null);
export function useUser(){const value=useContext(UserContext);if(!value)throw new Error('User provider missing');return value;}
