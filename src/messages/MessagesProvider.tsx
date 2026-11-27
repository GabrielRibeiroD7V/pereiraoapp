import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useReturnRevision } from '../hooks/useReturnRevision';
import { messagesRepository } from './repository';
import type { MessageRepository } from './repository';
const Context = createContext<MessageRepository | null>(null);
const StatusContext = createContext({ unreadCount: 0, revision: 0, refresh: () => {} });
export function MessagesProvider({ children, repository = messagesRepository }: { children: ReactNode; repository?: MessageRepository | null }) {
  const {session}=useAuth();
  const ownerId=session?.user.id ?? null, resume=useReturnRevision();
  const [unread,setUnread]=useState<{ownerId:string|null;count:number}>({ownerId:null,count:0}),[revision,setRevision]=useState(0);
  const sequence=useRef(0);
  const refresh=useCallback(()=>{
    const request=++sequence.current;
    if(!ownerId||!repository?.unreadCount){setUnread({ownerId,count:0});return;}
    void repository.unreadCount().then(count=>{
      if(request===sequence.current) setUnread({ownerId,count});
    }).catch(()=>{});
  },[repository,ownerId]);
  useEffect(()=>{
    refresh();
    if(!ownerId||!repository)return;
    let live=true;
    const stop=repository.subscribe?.(ownerId,()=>{
      if(!live)return;
      setRevision(value=>value+1);
      refresh();
    });
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')refresh();},30_000);
    return()=>{live=false;sequence.current++;stop?.();window.clearInterval(timer);};
  },[repository,ownerId,refresh]);
  useEffect(()=>{if(resume)refresh();},[resume,refresh]);
  const unreadCount=unread.ownerId===ownerId?unread.count:0;
  return <Context.Provider value={repository}><StatusContext.Provider value={{unreadCount,revision,refresh}}>{children}</StatusContext.Provider></Context.Provider>;
}
export const useMessages = () => useContext(Context);
export const useMessageStatus=()=>useContext(StatusContext);
