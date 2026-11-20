export interface AuthSession {
  user: { id: string; email: string | null; displayName: string };
}
export type AuthListener = (session: AuthSession | null) => void;
export interface AuthGateway {
  getSession(): Promise<AuthSession | null>;
  subscribe(listener: AuthListener): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string, next?: string): Promise<{ confirmationRequired: boolean }>;
  requestReset(email: string, next?: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  completeCallback(code: string): Promise<void>;
}
