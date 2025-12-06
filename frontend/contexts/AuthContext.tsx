import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { useLanguage } from './LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';

interface User {
  id: string;
  username: string;
  email: string;
  profile_picture?: string;
  is_admin?: boolean;
  preferences: {
    theme: 'dark' | 'light';
    language: 'en' | 'pt';
    anonymous_mode: boolean;
    notifications_enabled?: boolean;
    sound_enabled?: boolean;
  };
  totp_enabled: boolean;
  created_at: string;
  last_login?: string;
  active_warning?: {
    message: string;
    warned_at: string;
    dismissed_at?: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, totpCode: string) => Promise<boolean>; // Passwordless: username/email + TOTP code
  loginWithBackupCode: (identifier: string, backupCode: string) => Promise<boolean>; // Passwordless: username/email + backup code
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => void;
  updatePreferences: (preferences: Partial<User['preferences']>) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  regenerateBackupCodes: () => Promise<string[]>;
  refreshUser: () => Promise<void>;
  updateUser: (userData: User) => void;
}

interface RegisterData {
  username: string;
  email: string;
  // Passwordless authentication - no password needed
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
        login: async (_identifier: string, _totpCode: string) => false,
        loginWithBackupCode: async (_identifier: string, _backupCode: string) => false,
        register: async () => false,
        logout: () => {},
        updatePreferences: async () => false,
        changePassword: async () => false,
        regenerateBackupCodes: async () => [],
        refreshUser: async () => {},
        updateUser: () => {},
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
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check authentication status on mount (skip on auth pages)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      // Don't check auth on login/register pages to prevent infinite loops
      if (path === '/login' || path === '/register') {
        setLoading(false);
        return;
      }
    }
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

  const login = async (identifier: string, totpCode: string): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, {
        identifier: identifier.trim(), // Can be username or email
        totp_code: totpCode,
      });

      // Handle response - backend returns {success: true, user: {...}}
      if (response.data && response.data.success) {
        const userData = response.data.user;
        if (userData) {
          setUser(userData);

          // Apply user's theme preference
          if (userData.preferences?.theme) {
            document.documentElement.setAttribute('data-theme', userData.preferences.theme);
          }

          toast.success(t('toast.loginSuccessful'));
          router.push('/');
          return true;
        } else {
          toast.error(t('toast.loginFailedInvalidFormat'));
          return false;
        }
      } else {
        const errors = response.data?.errors || [t('toast.loginFailed')];
        toast.error(Array.isArray(errors) ? errors.join(', ') : errors);
        return false;
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.errors 
        ? (Array.isArray(error.response.data.errors) 
            ? error.response.data.errors.join(', ') 
            : error.response.data.errors)
        : error.response?.data?.message 
        ? error.response.data.message
        : error.message || t('toast.loginFailedTryAgain');
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loginWithBackupCode = async (identifier: string, backupCode: string): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await api.post(API_ENDPOINTS.AUTH.LOGIN_BACKUP, {
        identifier: identifier.trim(), // Can be username or email
        backup_code: backupCode,
      });

      // Handle response - backend returns {success: true, user: {...}}
      if (response.data && response.data.success) {
        const userData = response.data.user;
        if (userData) {
          setUser(userData);

          // Apply user's theme preference
          if (userData.preferences?.theme) {
            document.documentElement.setAttribute('data-theme', userData.preferences.theme);
          }

          toast.success(t('toast.loginSuccessfulRegenerateBackup'));
          if (response.data.warning) {
            toast(response.data.warning, { icon: '⚠️' });
          }

          router.push('/');
          return true;
        } else {
          toast.error(t('toast.loginFailedInvalidFormat'));
          return false;
        }
      } else {
        const errors = response.data?.errors || [t('toast.loginFailed')];
        toast.error(Array.isArray(errors) ? errors.join(', ') : errors);
        return false;
      }
    } catch (error: any) {
      console.error('Backup code login error:', error);
      const errorMessage = error.response?.data?.errors 
        ? (Array.isArray(error.response.data.errors) 
            ? error.response.data.errors.join(', ') 
            : error.response.data.errors)
        : error.response?.data?.message 
        ? error.response.data.message
        : error.message || t('toast.loginFailedTryAgain');
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
        toast.success(t('toast.registrationSuccessful'));
        return true;
      } else {
        toast.error(response.data.errors?.join(', ') || t('toast.registrationFailed'));
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.join(', ') || t('toast.registrationFailed');
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
      toast.success(t('toast.loggedOutSuccessfully'));
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

  const updateUser = (userData: User) => {
    setUser(userData);
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
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};