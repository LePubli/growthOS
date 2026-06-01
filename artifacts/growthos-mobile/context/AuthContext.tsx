import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { setAuthToken } from '@/lib/api';
import { api } from '@/lib/api';

interface User { id: string; firstName: string; lastName: string; email: string; tenantId: string; }
interface AuthState { user: User | null; token: string | null; isLoading: boolean; }

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, isLoading: true });

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('growthos_token');
        const userJson = await AsyncStorage.getItem('growthos_user');
        if (token && userJson) {
          const user = JSON.parse(userJson);
          setAuthToken(token);
          setState({ user, token, isLoading: false });
        } else {
          setState(s => ({ ...s, isLoading: false }));
        }
      } catch {
        setState(s => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  const persist = async (token: string, user: User) => {
    await AsyncStorage.setItem('growthos_token', token);
    await AsyncStorage.setItem('growthos_user', JSON.stringify(user));
    setAuthToken(token);
    setState({ user, token, isLoading: false });
  };

  const login = async (email: string, password: string) => {
    const data = await api.post<{ accessToken: string; user: User }>('/auth/login', { email, password });
    await persist(data.accessToken, data.user);
  };

  const demoLogin = async () => {
    const demoUser: User = { id: 'demo', firstName: 'Demo', lastName: 'User', email: 'demo@growthos.fr', tenantId: 'demo' };
    await persist('demo-token', demoUser);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('growthos_token');
    await AsyncStorage.removeItem('growthos_user');
    setAuthToken(null);
    setState({ user: null, token: null, isLoading: false });
  };

  return <AuthContext.Provider value={{ ...state, login, demoLogin, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
