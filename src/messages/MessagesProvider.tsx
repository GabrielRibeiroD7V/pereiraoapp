import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { messagesRepository } from './repository';
import type { MessageRepository } from './repository';
const Context = createContext<MessageRepository | null>(null);
const StatusContext = createContext({ unreadCount: 0, revision: 0, refresh: () => {} });
export function MessagesProvider({ children, repository = messagesRepository }: { children: ReactNode; repository?: MessageRepository | null }) {
  const {session}=useAuth();
  const [unreadCount,setUnreadCount]=useState(0),[revision,setRevision]=useState(0);
  const refresh=useCallback(()=>{
    if(!session||!repository?.unreadCount){setUnreadCount(0);return;}
    void repository.unreadCount().then(setUnreadCount).catch(()=>{});
  },[repository,session?.user.id]);
  useEffect(()=>{
    refresh();
    if(!session||!repository)return;
    const stop=repository.subscribe?.(session.user.id,()=>{
      setRevision(value=>value+1);
      refresh();
    });
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')refresh();},30_000);
    return()=>{stop?.();window.clearInterval(timer);};
  },[repository,session?.user.id,refresh]);
  return <Context.Provider value={repository}><StatusContext.Provider value={{unreadCount,revision,refresh}}>{children}</StatusContext.Provider></Context.Provider>;
}
export const useMessages = () => useContext(Context);
export const useMessageStatus=()=>useContext(StatusContext);
