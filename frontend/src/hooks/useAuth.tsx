/**
 * Authentication state.
 *
 * The session lives in an httpOnly cookie that JavaScript cannot read, so the
 * client cannot inspect a token to decide whether it is signed in. Instead it
 * asks the server (`GET /api/auth/me`) and treats a 401 as "not signed in".
 *
 * That is the correct shape for cookie sessions: the server is the only
 * authority on whether a session is valid, which is also why a suspended
 * account stops working immediately rather than at token expiry.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api } from '../lib/api';
import type { User } from '../types/api';

interface AuthState {
  user: User | null;
  /** True until the first `me` check resolves. Guards against a redirect flash. */
  initialising: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: 'STARTUP' | 'INVESTOR';
  businessName?: string;
  investorName?: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialising, setInitialising] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const { user: me } = await api.get<{ user: User }>('/auth/me');
      setUser(me);
    } catch (err) {
      // 401 is the expected answer for an anonymous visitor, not an error.
      if (err instanceof ApiError && err.isAuth) setUser(null);
      else setUser(null);
    }
  }, []);

  useEffect(() => {
    void loadUser().finally(() => setInitialising(false));
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: me } = await api.post<{ user: User }>('/auth/login', { email, password });
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user: me } = await api.post<{ user: User }>('/auth/register', input);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Cleared even if the request failed: the user asked to sign out, and the
      // cookie may already be invalid.
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, initialising, login, register, logout, refresh: loadUser }),
    [user, initialising, login, register, logout, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
