import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import TOTPInput from '../TOTPInput';
import { RegistrationData } from './RegistrationWizard';

interface Step4Props {
  data: RegistrationData;
  onNext: () => void;
  onBack: () => void;
}

const Step4AuthenticatorVerify: React.FC<Step4Props> = ({ data, onNext, onBack }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleVerify = async (code: string) => {
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/complete-totp-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          totp_code: code,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(t('success.authSetup'));
        onNext();
      } else {
        const errorMessage = result.error || t('errors.invalidCode');
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('TOTP verification error:', error);
      toast.error(t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              {t('registration.verifyAuth')}
            </p>
            <p className="text-blue-700 dark:text-blue-300">
              {t('registration.enterAuthCode')}
            </p>
          </div>
        </div>
      </div>

      {/* TOTP Code Input */}
      <div className="space-y-4">
        <label className="block text-sm font-medium theme-text-primary text-center">
          {t('auth.authenticatorCode')}
        </label>
        <TOTPInput
          length={6}
          onComplete={handleVerify}
          disabled={loading}
          autoFocus={true}
        />
      </div>

      {/* Help Text */}
      <div className="text-center text-sm theme-text-secondary space-y-2">
        <p>{t('registration.totpRefreshInfo')}</p>
        <p className="text-xs">{t('registration.codeChangesEvery30Seconds')}</p>
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

      {/* Troubleshooting */}
      <details className="text-sm theme-text-secondary">
        <summary className="cursor-pointer font-medium hover:theme-text-primary">
          {t('common.troubleshooting')}
        </summary>
        <ul className="mt-2 ml-4 space-y-1 list-disc">
          <li>{t('registration.checkTimeSync')}</li>
          <li>{t('registration.waitForNewCode')}</li>
          <li>{t('registration.rescanQRCode')}</li>
          <li>{t('registration.checkManualEntry')}</li>
        </ul>
      </details>
    </div>
  );
};

export default Step4AuthenticatorVerify;
