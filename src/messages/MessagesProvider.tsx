import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { messagesRepository } from './repository';
import type { MessageRepository } from './repository';
const Context = createContext<MessageRepository | null>(null);
export function MessagesProvider({ children, repository = messagesRepository }: { children: ReactNode; repository?: MessageRepository | null }) {
  return <Context.Provider value={repository}>{children}</Context.Provider>;
}
export const useMessages = () => useContext(Context);
