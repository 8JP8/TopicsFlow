import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import TOTPInput from '@/components/Auth/TOTPInput';
import QRCodeDisplay from '@/components/Auth/QRCodeDisplay';
import LanguageToggle from '@/components/UI/LanguageToggle';
import ThemeToggle from '@/components/UI/ThemeToggle';

const RecoveryPage: React.FC = () => {
  const { t } = useLanguage();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [qrData, setQrData] = useState<{ qrCodeImage: string; totpSecret: string } | null>(null);
  const [resending, setResending] = useState(false);

  const totalSteps = 5;

  // Step 1: Initiate recovery
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t('errors.invalidEmail'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/recovery/initiate-passwordless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, language: t('common.languageCode') || 'en' }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(t('recovery.emailSent'));
        setCurrentStep(2);
      } else {
        toast.error(result.error || t('errors.generic'));
      }
    } catch (error) {
      console.error('Recovery initiate error:', error);
      toast.error(t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify email code
  const handleEmailCodeVerify = async (code: string) => {
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/recovery/verify-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(t('success.emailVerified'));
        setCurrentStep(3);
      } else {
        toast.error(result.error || t('errors.invalidCode'));
        setEmailCode('');
      }
    } catch (error) {
      console.error('Email code verification error:', error);
      toast.error(t('errors.network'));
      setEmailCode('');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify recovery code and get new QR
  const handleRecoveryCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recoveryCode.trim()) {
      toast.error(t('errors.requiredField'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/recovery/verify-user-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recovery_code: recoveryCode, language: t('common.languageCode') || 'en' }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Fetch new QR code
        setQrData({
          qrCodeImage: result.qr_code_image,
          totpSecret: result.totp_secret,
        });
        toast.success(t('recovery.resetAuthenticator'));
        setCurrentStep(4);
      } else {
        toast.error(result.error || t('errors.invalidCode'));
      }
    } catch (error) {
      console.error('Recovery code verification error:', error);
      toast.error(t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  // Step 4 (Display QR) - no action needed, user proceeds to step 5

  // Step 5: Verify new TOTP
  const handleNewTOTPVerify = async (code: string) => {
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/recovery/complete-totp-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, totp_code: code }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(t('recovery.recoveryComplete'));
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        toast.error(result.error || t('errors.invalidCode'));
      }
    } catch (error) {
      console.error('TOTP verification error:', error);
      toast.error(t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setResending(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/recovery/initiate-passwordless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, language: t('common.languageCode') || 'en' }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(t('recovery.emailSent'));
      } else {
        toast.error(result.error || t('errors.generic'));
      }
    } catch (error) {
      toast.error(t('errors.network'));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`${t('recovery.title')} - ${t('common.appName')}`}</title>
        <meta name="description" content={t('recovery.subtitle')} />
        <link rel="icon" type="image/png" href="https://i.postimg.cc/FY5shL9w/chat.png" />
      </Head>

      <div className="min-h-screen theme-bg-primary flex items-center justify-center p-4 pt-24">
        {/* Fixed Header with Controls */}
        <div className="fixed top-0 left-0 right-0 z-50 p-4 theme-bg-primary bg-opacity-90 dark:bg-opacity-90 backdrop-blur-md border-b theme-border">
          <div className="flex justify-between items-center">
            <Link href="/login" className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer no-underline text-decoration-none hover:no-underline">
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

        {/* Recovery Card */}
        <div className="w-full max-w-2xl">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium theme-text-secondary">
                {t('common.step')} {currentStep} {t('common.of')} {totalSteps}
              </span>
              <span className="text-sm font-medium theme-text-secondary">
                {Math.round((currentStep / totalSteps) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 theme-bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <div className="theme-bg-secondary rounded-2xl shadow-xl p-8 border theme-border">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold theme-text-primary mb-2">
                {t('recovery.title')}
              </h1>
              <p className="theme-text-secondary">
                {currentStep === 1 && t('recovery.emailVerification')}
                {currentStep === 2 && t('recovery.enterEmailCode')}
                {currentStep === 3 && t('recovery.enterRecoveryCode')}
                {currentStep === 4 && t('recovery.setupNewAuth')}
                {currentStep === 5 && t('recovery.verifyNewAuth')}
              </p>
            </div>

            {/* Step 1: Enter Email */}
            {currentStep === 1 && (
              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {t('recovery.emailInfo')}
                  </p>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium theme-text-primary mb-2">
                    {t('auth.email')}
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg theme-bg-primary theme-text-primary border-2 theme-border
                      focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder={t('recovery.enterEmail')}
                    disabled={loading}
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                    text-white font-medium rounded-lg transition-colors"
                >
                  {loading ? t('common.loading') : t('common.next')}
                </button>

                <div className="text-center text-sm theme-text-secondary">
                  <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                    {t('common.backToLogin')}
                  </Link>
                </div>
              </form>
            )}

            {/* Step 2: Verify Email Code */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {t('registration.checkEmail')}
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium theme-text-primary text-center">
                    {t('auth.enterCode')}
                  </label>
                  <TOTPInput
                    length={6}
                    onComplete={handleEmailCodeVerify}
                    disabled={loading}
                    autoFocus={true}
                  />
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={resending || loading}
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 font-medium"
                  >
                    {resending ? t('common.loading') : t('registration.resendCode')}
                  </button>
                </div>

                <button
                  onClick={() => setCurrentStep(1)}
                  disabled={loading}
                  className="w-full py-3 px-4 theme-bg-primary hover:theme-bg-tertiary theme-text-primary
                    font-medium rounded-lg transition-colors border-2 theme-border disabled:opacity-50"
                >
                  {t('common.previous')}
                </button>
              </div>
            )}

            {/* Step 3: Enter Recovery Code */}
            {currentStep === 3 && (
              <form onSubmit={handleRecoveryCodeSubmit} className="space-y-6">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-900 dark:text-amber-100">
                    {t('recovery.recoveryCodeInfo')}
                  </p>
                </div>

                <div>
                  <label htmlFor="recoveryCode" className="block text-sm font-medium theme-text-primary mb-2">
                    {t('auth.recoveryCode')}
                  </label>
                  <input
                    type="password"
                    id="recoveryCode"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg theme-bg-primary theme-text-primary border-2 theme-border
                      focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder={t('recovery.enterRecoveryCode')}
                    disabled={loading}
                    autoFocus
                    required
                  />
                </div>

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={loading}
                    className="flex-1 py-3 px-4 theme-bg-primary hover:theme-bg-tertiary theme-text-primary
                      font-medium rounded-lg transition-colors border-2 theme-border disabled:opacity-50"
                  >
                    {t('common.previous')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                      text-white font-medium rounded-lg transition-colors"
                  >
                    {loading ? t('common.loading') : t('common.next')}
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Display New QR Code */}
            {currentStep === 4 && qrData && (
              <div className="space-y-6">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-900 dark:text-green-100">
                    {t('recovery.setupNewAuth')}
                  </p>
                </div>

                <QRCodeDisplay
                  qrCodeImage={qrData.qrCodeImage}
                  totpSecret={qrData.totpSecret}
                  username={email}
                />

                <button
                  onClick={() => setCurrentStep(5)}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white
                    font-medium rounded-lg transition-colors"
                >
                  {t('common.next')}
                </button>
              </div>
            )}

            {/* Step 5: Verify New TOTP */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {t('registration.enterAuthCode')}
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium theme-text-primary text-center">
                    {t('auth.authenticatorCode')}
                  </label>
                  <TOTPInput
                    length={6}
                    onComplete={handleNewTOTPVerify}
                    disabled={loading}
                    autoFocus={true}
                  />
                </div>

                <button
                  onClick={() => setCurrentStep(4)}
                  disabled={loading}
                  className="w-full py-3 px-4 theme-bg-primary hover:theme-bg-tertiary theme-text-primary
                    font-medium rounded-lg transition-colors border-2 theme-border disabled:opacity-50"
                >
                  {t('common.previous')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RecoveryPage;
