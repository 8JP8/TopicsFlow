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
import { api, API_ENDPOINTS } from '@/utils/api';

const LoginPage: React.FC = () => {
  const { t } = useLanguage();
  const auth = useAuth(); // Store auth object to avoid calling useAuth() conditionally
  const { login, loginWithBackupCode, refreshUser } = auth;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [_totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [showEmail2FA, setShowEmail2FA] = useState(false);
  const [email2FAUser, setEmail2FAUser] = useState('');

  const [emailCode, setEmailCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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
      // Call passwordless login endpoint
      const apiResponse = await api.post(API_ENDPOINTS.AUTH.LOGIN, {
        identifier: identifier,
        totp_code: code
      });

      if (apiResponse.data.require_email_2fa) {
        setEmail2FAUser(apiResponse.data.user_id);
        setShowEmail2FA(true);
        setTotpCode('');
        toast.success(apiResponse.data.message || 'Please check your email.');
        setLoading(false);
        return;
      }

      if (apiResponse.data.success) {
        await refreshUser(); // Update context
        toast.success(t('success.loginSuccess'));
        router.push('/');
      } else {
        toast.error(apiResponse.data.errors?.[0] || t('errors.loginFailed'));
        setTotpCode('');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.errors?.[0] || t('errors.network'));
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };



  const handleResendEmail2FA = async () => {
    if (resendCooldown > 0) return;

    try {
      const response = await api.post('/api/auth/resend-login-email-2fa', {
        user_id: email2FAUser
      });

      if (response.data.success) {
        toast.success(response.data.message || t('success.codeResent'));
        setResendCooldown(response.data.cooldown || 60);
      } else {
        if (response.data.retry_after) {
          setResendCooldown(response.data.retry_after);
          toast.error(`Please wait ${response.data.retry_after}s`);
        } else {
          toast.error(response.data.errors?.[0] || 'Failed to resend code');
        }
      }
    } catch (error: any) {
      const retryAfter = error.response?.data?.retry_after;
      if (retryAfter) {
        setResendCooldown(retryAfter);
        toast.error(`Please wait ${retryAfter}s`);
      } else {
        toast.error(error.response?.data?.errors?.[0] || 'Failed to resend code');
      }
    }
  };

  const handleEmail2FASubmit = async (submission: React.FormEvent | string) => {
    let code = '';
    if (typeof submission === 'string') {
      code = submission;
    } else {
      submission.preventDefault();
      code = emailCode;
    }

    if (!code || code.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/verify-login-email-2fa', {
        user_id: email2FAUser,
        code: code
      });

      if (response.data.success) {
        await refreshUser();
        toast.success(t('success.loginSuccess'));
        router.push('/');
      } else {
        toast.error(response.data.errors?.[0] || 'Verification failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || 'Verification failed');
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
      // Step 1: Get authentication options from server (axios client already uses withCredentials)
      const optionsResponse = await api.post(API_ENDPOINTS.AUTH.PASSKEY.AUTH_OPTIONS, {
        identifier: identifier || undefined,
      });
      const optionsResult: any = optionsResponse.data;
      if (!optionsResult?.success) {
        toast.error(optionsResult?.errors?.[0] || optionsResult?.error || t('errors.generic'));
        return;
      }

      const options = optionsResult.options;

      // Convert base64url strings to ArrayBuffers
      const allowCredentials = options.allowCredentials?.map((cred: { id: string }) => ({
        ...cred,
        id: base64urlToArrayBuffer(cred.id),
      }));
      const publicKeyOptions: any = {
        ...options,
        challenge: base64urlToArrayBuffer(options.challenge),
        ...(allowCredentials && allowCredentials.length > 0 ? { allowCredentials } : {}),
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
      const verifyResponse = await api.post(API_ENDPOINTS.AUTH.PASSKEY.AUTH_VERIFY, {
        credential: credentialData,
        identifier: identifier || undefined,
      });
      const verifyResult: any = verifyResponse.data;

      if (verifyResult.require_email_2fa) {
        setEmail2FAUser(verifyResult.user_id);
        setShowEmail2FA(true);
        toast.success(verifyResult.message || 'Please check your email.');
        setLoading(false);
        return;
      }

      if (verifyResult?.success) {
        // Fix: Passkey login already sets the cookie, just refresh the user state
        // The verify endpoint returns a token but for cookie-based auth we just need to refresh context
        await refreshUser();
        toast.success(t('success.loginSuccess'));
        router.push('/');
      } else {
        const errorMsg = verifyResult?.errors?.[0] || verifyResult?.error;
        if (errorMsg === 'User not found') {
          toast.error(t('errors.userNotFound'));
        } else {
          toast.error(errorMsg || t('errors.passkeyFailed'));
        }
      }
    } catch (error: any) {
      console.error('Passkey login error:', error);
      // Axios errors: surface backend message if available
      const backendMsg =
        error?.response?.data?.errors?.[0] ||
        error?.response?.data?.error ||
        error?.response?.data?.message;
      if (backendMsg) {
        if (backendMsg === 'User not found') {
          toast.error(t('errors.userNotFound'));
        } else {
          toast.error(backendMsg);
        }
      } else if (error instanceof Error && error.name === 'NotAllowedError') {
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
        <link rel="icon" type="image/png" href="https://i.postimg.cc/FY5shL9w/chat.png" />
      </Head>

      <div className="min-h-screen theme-bg-primary flex items-center justify-center p-4 pt-24">
        {/* Fixed Header with Controls */}
        <div className="fixed top-0 left-0 right-0 z-50 p-4 theme-bg-primary bg-opacity-90 dark:bg-opacity-90 backdrop-blur-md border-b theme-border">
          <div className="flex justify-between items-center">
            <Link href="/about" className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer no-underline text-decoration-none hover:no-underline">
              <img
                src="https://i.postimg.cc/FY5shL9w/chat.png"
                alt="TopicsFlow Logo"
                className="h-10 w-10"
              />
              <span className="text-xl font-bold theme-text-primary no-underline">
                {t('common.appName')}
              </span>
            </Link>
            <div className="flex items-center space-x-3">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-md">
          <div className="theme-bg-secondary rounded-2xl shadow-xl p-8 border theme-border">
            {showEmail2FA ? (
              <div className="p-4">
                <div className="flex justify-center mb-6">
                  <svg className={`w-12 h-12 text-white ${loading ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold theme-text-primary mb-2 text-center">{t('auth.emailVerification')}</h2>
                <p className="theme-text-secondary text-center mb-6">{t('auth.enterCodeSent')}</p>
                <form onSubmit={handleEmail2FASubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2 text-center">
                      {t('auth.verificationCode')}
                    </label>
                    <TOTPInput
                      length={6}
                      onComplete={(code) => {
                        setEmailCode(code);
                        handleEmail2FASubmit(code);
                      }}
                      disabled={loading}
                      autoFocus={true}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmail2FA(false);
                      setEmailCode('');
                    }}
                    className="w-full py-2 theme-text-secondary hover:theme-text-primary text-sm transition-colors"
                  >
                    {t('common.back')}
                  </button>


                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={handleResendEmail2FA}
                      disabled={resendCooldown > 0}
                      className={`text-sm font-medium ${resendCooldown > 0
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'theme-text-accent hover:underline'
                        }`}
                    >
                      {resendCooldown > 0
                        ? `${t('auth.resendVerificationCode')} (${resendCooldown}s)`
                        : t('auth.resendVerificationCode')}
                    </button>
                  </div>
                </form>
              </div>
            ) : auth.user && loading ? (
              // Showing Success/Redirect state immediately after login
              <div className="text-center py-8">
                <div className="mb-4 flex justify-center">
                  <svg className="w-16 h-16 text-green-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold theme-text-primary mb-2">
                  {t('success.loginSuccess') || 'Login Successful'}
                </h2>
                <p className="theme-text-secondary">
                  {t('common.loading') || 'Redirecting...'}
                </p>
              </div>
            ) : auth.user ? (
              <div className="text-center">
                <img
                  src="https://i.postimg.cc/52jHqBD9/chat.png"
                  alt="TopicsFlow Logo"
                  className="h-16 w-16 mx-auto mb-4"
                />
                <h2 className="text-2xl font-bold theme-text-primary mb-2">
                  {t('common.welcomeBack') || 'Welcome Back'},
                </h2>
                <p className="text-xl theme-text-primary font-semibold mb-6">
                  {auth.user?.username}
                </p>
                <div className="space-y-4">
                  <Link href="/" className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors no-underline hover:no-underline">
                    {t('common.backToDashboard') || 'Return to Dashboard'}
                  </Link>
                  <button
                    onClick={auth.logout}
                    className="w-full py-3 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 theme-text-primary font-medium rounded-lg transition-colors"
                  >
                    {t('auth.logout') || 'Logout'}
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (showCodeInput) {
                          setShowCodeInput(false);
                          setTotpCode('');
                          setUseBackupCode(false);
                          setBackupCode('');
                        }
                      }}
                      className="w-full px-4 py-3 rounded-lg theme-bg-primary theme-text-primary border-2 theme-border
                    focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder={t('login.usernameOrEmail')}
                      disabled={loading}
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
              </>
            )}
          </div>
        </div >
      </div >
    </>
  );
};

export default LoginPage;
