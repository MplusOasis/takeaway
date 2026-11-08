import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest, getToken, onUnauthorized, setToken } from '../api/client';
import type { SessionUser } from '../api/types';

interface AuthContextValue {
  user: SessionUser | null;
  ready: boolean;
  login: (studentNo: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const data = await apiRequest<{ user: SessionUser }>('/auth/me');
        if (!cancelled) setUser(data.user);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      onUnauthorized(() => {
        setToken(null);
        setUser(null);
      }),
    [],
  );

  const login = useCallback(async (studentNo: string, name?: string) => {
    const data = await apiRequest<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: { studentNo, name },
    });
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' });
    } catch {
      // 网络失败也要清本地登录态，避免用户卡在已登录界面
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return context;
}
