import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  email?: string;
  isAdmin?: boolean;
}

interface Team {
  id: number;
  name: string;
  abbreviation: string | null;
  league: string;
  gold: number;
  diamond: number;
  fan_count: number;
  logo_url: string | null;
  free_contracts_used: number;
}

interface AuthContextType {
  user: User | null;
  team: Team | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<{ needsTeam: boolean }>;
  logout: () => void;
  loading: boolean;
  fetchUserInfo: () => Promise<void>;
  refreshTeam: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
      setTeam(response.data.team);
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await axios.post('/api/auth/login', { username, password });
    const { token: newToken } = response.data;
    setToken(newToken);
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    await fetchUserInfo();
  };

  const register = async (username: string, password: string, email?: string) => {
    const response = await axios.post('/api/auth/register', { username, password, email });
    const { token: newToken } = response.data;
    setToken(newToken);
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    await fetchUserInfo();
  };

  const googleLogin = async (credential: string) => {
    const response = await axios.post('/api/auth/google', { credential });
    const { token: newToken, needsTeam } = response.data;
    setToken(newToken);
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    await fetchUserInfo();
    return { needsTeam };
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setTeam(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const refreshTeam = async () => {
    await fetchUserInfo();
  };

  return (
    <AuthContext.Provider value={{ user, team, token, login, register, googleLogin, logout, loading, fetchUserInfo, refreshTeam }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

