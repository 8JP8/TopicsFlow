import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { api, API_ENDPOINTS } from '@/utils/api';

interface User {
  id: string;
  username: string;
  email: string;
  preferences: {
    theme: 'dark' | 'light';
    language: 'en' | 'pt';
    anonymous_mode: boolean;
  };
  totp_enabled: boolean;
  created_at: string;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, totpCode: string) => Promise<boolean>;
  loginWithBackupCode: (username: string, password: string, backupCode: string) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => void;
  updatePreferences: (preferences: Partial<User['preferences']>) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  regenerateBackupCodes: () => Promise<string[]>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  phone?: string;
  security_questions?: Array<{
    question: string;
    answer: string;
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During SSR, return a safe default instead of throwing
    if (typeof window === 'undefined') {
      return {
        user: null,
        loading: true,
        login: async () => false,
        loginWithBackupCode: async () => false,
        register: async () => false,
        logout: () => {},
        updatePreferences: async () => false,
        changePassword: async () => false,
        regenerateBackupCodes: async () => [],
        refreshUser: async () => {},
      } as AuthContextType;
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.AUTH.ME);
      if (response.data.success) {
        setUser(response.data.user);
        // Apply user's theme preference
        if (response.data.user.preferences.theme) {
          document.documentElement.setAttribute('data-theme', response.data.user.preferences.theme);
        }
      }
    } catch (error) {
      // User is not authenticated
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string, totpCode: string): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, {
        username: username.trim(),
        password,
        totp_code: totpCode,
      });

      if (response.data.success) {
        setUser(response.data.user);

        // Apply user's theme preference
        if (response.data.user.preferences.theme) {
          document.documentElement.setAttribute('data-theme', response.data.user.preferences.theme);
        }

        toast.success('Login successful!');
        router.push('/');
        return true;
      } else {
        toast.error(response.data.errors?.join(', ') || 'Login failed');
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.join(', ') || 'Login failed';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loginWithBackupCode = async (username: string, password: string, backupCode: string): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await api.post(API_ENDPOINTS.AUTH.LOGIN_BACKUP, {
        username: username.trim(),
        password,
        backup_code: backupCode,
      });

      if (response.data.success) {
        setUser(response.data.user);

        // Apply user's theme preference
        if (response.data.user.preferences.theme) {
          document.documentElement.setAttribute('data-theme', response.data.user.preferences.theme);
        }

        toast.success('Login successful! Consider regenerating your backup codes.');
        if (response.data.warning) {
          toast(response.data.warning, { icon: '⚠️' });
        }

        router.push('/');
        return true;
      } else {
        toast.error(response.data.errors?.join(', ') || 'Login failed');
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.join(', ') || 'Login failed';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await api.post(API_ENDPOINTS.AUTH.REGISTER, userData);

      if (response.data.success) {
        toast.success('Registration successful! Please set up your authenticator app.');
        return true;
      } else {
        toast.error(response.data.errors?.join(', ') || 'Registration failed');
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.join(', ') || 'Registration failed';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      // Even if logout fails on server, clear local state
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      router.push('/login');
      toast.success('Logged out successfully');
    }
  };

  const updatePreferences = async (preferences: Partial<User['preferences']>): Promise<boolean> => {
    try {
      const response = await api.put(API_ENDPOINTS.AUTH.PREFERENCES, { preferences });

      if (response.data.success) {
        // Update local user state
        if (user) {
          const updatedUser = {
            ...user,
            preferences: { ...user.preferences, ...preferences }
          };
          setUser(updatedUser);

          // Apply theme change immediately
          if (preferences.theme) {
            document.documentElement.setAttribute('data-theme', preferences.theme);
          }
        }

        toast.success('Preferences updated successfully');
        return true;
      } else {
        toast.error(response.data.errors?.join(', ') || 'Failed to update preferences');
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.join(', ') || 'Failed to update preferences';
      toast.error(errorMessage);
      return false;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      const response = await api.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (response.data.success) {
        toast.success('Password changed successfully');
        return true;
      } else {
        toast.error(response.data.errors?.join(', ') || 'Failed to change password');
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.join(', ') || 'Failed to change password';
      toast.error(errorMessage);
      return false;
    }
  };

  const regenerateBackupCodes = async (): Promise<string[]> => {
    try {
      const response = await api.post(API_ENDPOINTS.AUTH.BACKUP_CODES);

      if (response.data.success) {
        toast.success('Backup codes regenerated successfully');
        return response.data.backup_codes;
      } else {
        toast.error(response.data.errors?.join(', ') || 'Failed to regenerate backup codes');
        return [];
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.join(', ') || 'Failed to regenerate backup codes';
      toast.error(errorMessage);
      return [];
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.AUTH.ME);
      if (response.data.success) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    loginWithBackupCode,
    register,
    logout,
    updatePreferences,
    changePassword,
    regenerateBackupCodes,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};