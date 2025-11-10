import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ThemeToggle from '@/components/UI/ThemeToggle';
import LanguageToggle from '@/components/UI/LanguageToggle';

export default function Login() {
  const { login, loginWithBackupCode, register } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'backup'>('login');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    totpCode: '',
    backupCode: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateLoginForm = () => {
    const newErrors: string[] = [];

    if (!formData.username.trim()) {
      newErrors.push('Username is required');
    }

    if (!formData.password) {
      newErrors.push('Password is required');
    }

    if (!formData.totpCode && mode !== 'backup') {
      newErrors.push('Authentication code is required');
    }

    if (mode === 'backup' && !formData.backupCode) {
      newErrors.push('Backup code is required');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const validateRegisterForm = () => {
    const newErrors: string[] = [];

    if (!formData.username.trim()) {
      newErrors.push('Username is required');
    } else if (formData.username.trim().length < 3) {
      newErrors.push('Username must be at least 3 characters');
    } else if (formData.username.trim().length > 20) {
      newErrors.push('Username must be less than 20 characters');
    }

    if (!formData.email.trim()) {
      newErrors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.push('Invalid email format');
    }

    if (!formData.password) {
      newErrors.push('Password is required');
    } else if (formData.password.length < 8) {
      newErrors.push('Password must be at least 8 characters');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.push('Passwords do not match');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateLoginForm()) {
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      let success = false;

      if (mode === 'backup') {
        success = await loginWithBackupCode(
          formData.username.trim(),
          formData.password,
          formData.backupCode
        );
      } else {
        success = await login(
          formData.username.trim(),
          formData.password,
          formData.totpCode
        );
      }

      if (success) {
        router.push('/');
      }
    } catch (error) {
      setErrors(['Login failed. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateRegisterForm()) {
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const success = await register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim() || undefined,
      });

      if (success) {
        // Registration successful, user will need to set up TOTP
        // For now, redirect to login (in real app, show TOTP setup)
        setMode('login');
        setFormData(prev => ({ ...prev, totpCode: '' }));
      }
    } catch (error) {
      setErrors(['Registration failed. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center theme-bg-primary px-4 ${theme}`} data-theme={theme}>
      {/* Theme and Language Toggles */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 theme-blue-primary rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold theme-text-primary">ChatHub</h1>
          <p className="theme-text-secondary mt-1">
            Secure chat with TOTP authentication
          </p>
        </div>

        {/* Login Form */}
        {mode === 'login' && (
          <div className="card">
            <h2 className="text-xl font-semibold theme-text-primary mb-6">Sign In</h2>

            {errors.length > 0 && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
                <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium theme-text-primary mb-1">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="Enter your username"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium theme-text-primary mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="Enter your password"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="totpCode" className="block text-sm font-medium theme-text-primary mb-1">
                  Authentication Code
                </label>
                <input
                  type="text"
                  id="totpCode"
                  name="totpCode"
                  value={formData.totpCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="6-digit code from your authenticator app"
                  maxLength={6}
                  disabled={loading}
                  required
                />
                <p className="text-xs theme-text-muted mt-1">
                  Enter the 6-digit code from Google Authenticator, Microsoft Authenticator, or similar app.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Sign In'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('backup')}
                  className="text-sm theme-text-blue hover:underline"
                >
                  Use backup code instead
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm theme-text-secondary">
                Don't have an account?{' '}
                <button
                  onClick={() => setMode('register')}
                  className="theme-text-blue hover:underline font-semibold"
                >
                  Sign up
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Backup Code Login */}
        {mode === 'backup' && (
          <div className="card">
            <h2 className="text-xl font-semibold theme-text-primary mb-6">Sign In with Backup Code</h2>

            {errors.length > 0 && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
                <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium theme-text-primary mb-1">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="Enter your username"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium theme-text-primary mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="Enter your password"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="backupCode" className="block text-sm font-medium theme-text-primary mb-1">
                  Backup Code
                </label>
                <input
                  type="text"
                  id="backupCode"
                  name="backupCode"
                  value={formData.backupCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="8-digit backup code"
                  maxLength={8}
                  disabled={loading}
                  required
                />
                <p className="text-xs theme-text-muted mt-1">
                  Enter one of your 8-digit backup codes. Each code can only be used once.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Sign In'}
              </button>

              <div className="text-center space-x-4">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm theme-text-blue hover:underline"
                >
                  Use authenticator code
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm theme-text-secondary">
                Don't have an account?{' '}
                <button
                  onClick={() => setMode('register')}
                  className="theme-text-blue hover:underline font-semibold"
                >
                  Sign up
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Register Form */}
        {mode === 'register' && (
          <div className="card">
            <h2 className="text-xl font-semibold theme-text-primary mb-6">Create Account</h2>

            {errors.length > 0 && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
                <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium theme-text-primary mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="Choose a username"
                  disabled={loading}
                  required
                />
                <p className="text-xs theme-text-muted mt-1">
                  3-20 characters, letters, numbers, underscores, and hyphens only.
                </p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium theme-text-primary mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="Enter your email"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium theme-text-primary mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="For account recovery"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium theme-text-primary mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="Create a strong password"
                  disabled={loading}
                  required
                />
                <p className="text-xs theme-text-muted mt-1">
                  Minimum 8 characters. Include uppercase, lowercase, numbers, and symbols.
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium theme-text-primary mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
                  placeholder="Confirm your password"
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Create Account'}
              </button>

              <div className="text-sm theme-text-secondary text-center">
                <p>After registration, you'll need to set up two-factor authentication using an authenticator app.</p>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm theme-text-secondary">
                Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="theme-text-blue hover:underline font-semibold"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm theme-text-muted">
            <Link href="/recovery" className="theme-text-blue hover:underline">
              Forgot your password? Recover your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}