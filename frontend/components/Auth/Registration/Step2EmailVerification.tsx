import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import TOTPInput from '../TOTPInput';
import { RegistrationData } from './RegistrationWizard';

interface Step2Props {
  data: RegistrationData;
  updateData: (data: Partial<RegistrationData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const Step2EmailVerification: React.FC<Step2Props> = ({ data, updateData, onNext, onBack }) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [code, setCode] = useState('');

  const handleVerify = async (verificationCode: string) => {
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          code: verificationCode,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(t('success.emailVerified'));
        onNext();
      } else {
        const errorMessage = result.error || t('errors.invalidCode');
        toast.error(errorMessage);
        setCode(''); // Reset input
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error(t('errors.network'));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          language,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(t('registration.emailSent'));
      } else {
        toast.error(result.error || t('errors.generic'));
      }
    } catch (error) {
      console.error('Resend error:', error);
      toast.error(t('errors.network'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Message */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              {t('registration.checkEmail')}
            </p>
            <p className="text-blue-700 dark:text-blue-300">
              {t('registration.emailSentTo', { email: data.email })}
            </p>
          </div>
        </div>
      </div>

      {/* Verification Code Input */}
      <div className="space-y-4">
        <label className="block text-sm font-medium theme-text-primary text-center">
          {t('auth.enterCode')}
        </label>
        <TOTPInput
          length={6}
          onComplete={handleVerify}
          disabled={loading}
          autoFocus={true}
        />
      </div>

      {/* Resend Button */}
      <div className="text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || loading}
          className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 font-medium"
        >
          {resending ? t('common.loading') : t('registration.resendCode')}
        </button>
      </div>

      {/* Navigation Buttons */}
      <div className="flex space-x-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 px-4 theme-bg-primary hover:theme-bg-tertiary theme-text-primary
            font-medium rounded-lg transition-colors border-2 theme-border disabled:opacity-50"
        >
          {t('common.previous')}
        </button>
      </div>

      {/* Help Text */}
      <div className="text-center text-sm theme-text-secondary">
        <p>{t('registration.codeExpires')}</p>
      </div>
    </div>
  );
};

export default Step2EmailVerification;
