import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import TOTPInput from '@/components/Auth/TOTPInput';
import LanguageToggle from '@/components/UI/LanguageToggle';
import ThemeToggle from '@/components/UI/ThemeToggle';

const LoginPage: React.FC = () => {
  const { t } = useLanguage();
  const { login, loginWithBackupCode } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  
  // Check passkey support on client-side only to prevent hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPasskeySupported(
        window.PublicKeyCredential !== undefined &&
        typeof window.PublicKeyCredential === 'function'
      );
    }
  }, []);

  const handleIdentifierSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) {
      toast.error(t('errors.requiredField'));
      return;
    }

    setShowCodeInput(true);
  };

  const handleTOTPLogin = async (code: string) => {
    setLoading(true);

    try {
      const success = await login(identifier, code);
      if (!success) {
        setTotpCode('');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(t('errors.network'));
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleBackupCodeLogin = async () => {
    if (!backupCode || backupCode.length !== 8) {
      toast.error(t('errors.invalidBackupCode'));
      return;
    }

    setLoading(true);

    try {
      const success = await loginWithBackupCode(identifier, backupCode);
      if (!success) {
        setBackupCode('');
      }
    } catch (error) {
      console.error('Backup code login error:', error);
      toast.error(t('errors.network'));
      setBackupCode('');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!passkeySupported) {
      toast.error(t('errors.passkeyNotSupported'));
      return;
    }

    setLoading(true);

    try {
      // Step 1: Get authentication options from server
      const optionsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/passkey/auth-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier || undefined,
        }),
      });

      const optionsResult = await optionsResponse.json();

      if (!optionsResponse.ok || !optionsResult.success) {
        toast.error(optionsResult.error || t('errors.generic'));
        return;
      }

      const options = optionsResult.options;

      // Convert base64url strings to ArrayBuffers
      const publicKeyOptions = {
        ...options,
        challenge: base64urlToArrayBuffer(options.challenge),
        allowCredentials: options.allowCredentials?.map((cred: any) => ({
          ...cred,
          id: base64urlToArrayBuffer(cred.id),
        })) || [],
      };

      // Step 2: Get credential using WebAuthn API
      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        toast.error(t('errors.passkeyFailed'));
        return;
      }

      // Step 3: Prepare credential data for server
      const response = credential.response as AuthenticatorAssertionResponse;
      const credentialData = {
        id: credential.id,
        rawId: arrayBufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
          authenticatorData: arrayBufferToBase64url(response.authenticatorData),
          signature: arrayBufferToBase64url(response.signature),
          userHandle: response.userHandle ? arrayBufferToBase64url(response.userHandle) : null,
        },
      };

      // Step 4: Send credential to server for verification
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/passkey/auth-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: credentialData,
          identifier: identifier || undefined,
        }),
        credentials: 'include',
      });

      const verifyResult = await verifyResponse.json();

      if (verifyResponse.ok && verifyResult.success) {
        login(verifyResult.user, verifyResult.token);
        toast.success(t('success.loginSuccess'));
        router.push('/');
      } else {
        toast.error(verifyResult.error || t('errors.passkeyFailed'));
      }
    } catch (error: any) {
      console.error('Passkey login error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error(t('errors.passkeyUserCancelled'));
      } else {
        toast.error(t('errors.passkeyFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for base64url conversion
  const base64urlToArrayBuffer = (base64url: string): ArrayBuffer => {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const arrayBufferToBase64url = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  return (
    <>
      <Head>
        <title>{`${t('login.title')} - ${t('common.appName')}`}</title>
        <meta name="description" content={t('login.subtitle')} />
        <link rel="icon" type="image/png" href="https://i.postimg.cc/52jHqBD9/chat.png" />
      </Head>

      <div className="min-h-screen theme-bg-primary flex items-center justify-center p-4">
        {/* Fixed Header with Controls */}
        <div className="fixed top-0 left-0 right-0 z-50 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <img
                src="https://i.postimg.cc/52jHqBD9/chat.png"
                alt="TopicsFlow Logo"
                className="h-10 w-10"
              />
              <span className="text-xl font-bold theme-text-primary">
                {t('common.appName')}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-md">
          <div className="theme-bg-secondary rounded-2xl shadow-xl p-8 border theme-border">
            {/* Header */}
            <div className="text-center mb-8">
              <img
                src="https://i.postimg.cc/52jHqBD9/chat.png"
                alt="TopicsFlow Logo"
                className="h-16 w-16 mx-auto mb-4"
              />
              <h1 className="text-3xl font-bold theme-text-primary mb-2">
                {t('login.title')}
              </h1>
              <p className="theme-text-secondary">
                {t('login.subtitle')}
              </p>
            </div>

            {/* Passkey Login Button */}
            {passkeySupported && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400
                    text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>{t('common.loading')}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>{t('login.loginWithPasskey')}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Divider */}
            {passkeySupported && (
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t theme-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 theme-bg-secondary theme-text-secondary">
                    {t('login.orLoginWith')}
                  </span>
                </div>
              </div>
            )}

            {/* TOTP Login Form */}
            <form onSubmit={handleIdentifierSubmit} className="space-y-6">
              {/* Username/Email Input */}
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium theme-text-primary mb-2">
                  {t('login.usernameOrEmail')}
                </label>
                <input
                  type="text"
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg theme-bg-primary theme-text-primary border-2 theme-border
                    focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder={t('login.usernameOrEmail')}
                  disabled={loading || showCodeInput}
                  autoFocus={!showCodeInput}
                />
              </div>

              {/* TOTP Code Input */}
              {showCodeInput && !useBackupCode && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium theme-text-primary text-center">
                    {t('auth.authenticatorCode')}
                  </label>
                  <TOTPInput
                    length={6}
                    onComplete={handleTOTPLogin}
                    disabled={loading}
                    autoFocus={true}
                  />
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setUseBackupCode(true)}
                      className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {t('login.useBackupCode')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCodeInput(false);
                        setTotpCode('');
                      }}
                      className="w-full text-sm theme-text-secondary hover:theme-text-primary"
                    >
                      {t('common.change')} {t('login.usernameOrEmail')}
                    </button>
                  </div>
                </div>
              )}

              {/* Backup Code Input */}
              {showCodeInput && useBackupCode && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium theme-text-primary text-center">
                    {t('login.backupCode')}
                  </label>
                  <input
                    type="text"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                    maxLength={8}
                    className="w-full px-4 py-3 rounded-lg theme-bg-primary theme-text-primary border-2 theme-border
                      focus:outline-none focus:border-blue-500 transition-colors text-center text-xl font-mono tracking-widest"
                    placeholder="XXXXXXXX"
                    disabled={loading}
                    autoFocus={true}
                  />
                  <button
                    type="button"
                    onClick={handleBackupCodeLogin}
                    disabled={loading || backupCode.length !== 8}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                      text-white font-medium rounded-lg transition-colors"
                  >
                    {loading ? t('common.loading') : t('common.login')}
                  </button>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUseBackupCode(false);
                        setBackupCode('');
                      }}
                      className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {t('login.useTOTPInstead')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCodeInput(false);
                        setUseBackupCode(false);
                        setTotpCode('');
                        setBackupCode('');
                      }}
                      className="w-full text-sm theme-text-secondary hover:theme-text-primary"
                    >
                      {t('common.change')} {t('login.usernameOrEmail')}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              {!showCodeInput && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                    text-white font-medium rounded-lg transition-colors"
                >
                  {loading ? t('common.loading') : t('common.next')}
                </button>
              )}
            </form>

            {/* Links */}
            <div className="mt-6 space-y-3 text-center text-sm">
              <div>
                <Link href="/recovery" className="text-blue-600 hover:text-blue-700 font-medium">
                  {t('login.forgotAccess')}
                </Link>
              </div>
              <div className="theme-text-secondary">
                {t('login.needAccount')}{' '}
                <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                  {t('auth.signUp')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
