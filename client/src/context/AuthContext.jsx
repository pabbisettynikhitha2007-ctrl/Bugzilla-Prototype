import { createContext, useContext, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('bt_user');
    return stored ? JSON.parse(stored) : null;
  });

  async function login(email, password) {
    const { token, user } = await api.login(email, password);
    localStorage.setItem('bt_token', token);
    localStorage.setItem('bt_user', JSON.stringify(user));
    setUser(user);
  }

  async function register(payload) {
    const { token, user } = await api.register(payload);
    localStorage.setItem('bt_token', token);
    localStorage.setItem('bt_user', JSON.stringify(user));
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('bt_token');
    localStorage.removeItem('bt_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
