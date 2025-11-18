import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { RegistrationData } from './RegistrationWizard';

interface Step5Props {
  data: RegistrationData;
  onNext: () => void;
  onBack: () => void;
}

const Step5RecoveryCode: React.FC<Step5Props> = ({ data, onNext, onBack }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ recoveryCode?: string; confirmCode?: string }>({});

  const validateForm = () => {
    const newErrors: { recoveryCode?: string; confirmCode?: string } = {};

    if (!recoveryCode.trim()) {
      newErrors.recoveryCode = t('errors.requiredField');
    } else if (recoveryCode.length < 8) {
      newErrors.recoveryCode = t('errors.minLength', { min: 8 });
    }

    if (!confirmCode.trim()) {
      newErrors.confirmCode = t('errors.requiredField');
    } else if (recoveryCode !== confirmCode) {
      newErrors.confirmCode = t('errors.codeMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/recovery-code/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          recovery_code: recoveryCode,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(t('success.recoveryCodeSet'));
        onNext();
      } else {
        toast.error(result.error || t('errors.generic'));
      }
    } catch (error) {
      console.error('Recovery code setup error:', error);
      toast.error(t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info Box */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
              {t('registration.recoveryCodeTitle')}
            </p>
            <p className="text-amber-700 dark:text-amber-300 mb-2">
              {t('registration.recoveryCodeInfo')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300 ml-2">
              <li>{t('registration.recoveryCodeTip1')}</li>
              <li>{t('registration.recoveryCodeTip2')}</li>
              <li>{t('registration.recoveryCodeTip3')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recovery Code Input */}
      <div>
        <label htmlFor="recoveryCode" className="block text-sm font-medium theme-text-primary mb-2">
          {t('auth.recoveryCode')} <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            id="recoveryCode"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            className={`w-full px-4 py-3 pr-12 rounded-lg theme-bg-primary theme-text-primary border-2
              ${errors.recoveryCode ? 'border-red-500' : 'theme-border'}
              focus:outline-none focus:border-blue-500 transition-colors`}
            placeholder={t('registration.recoveryCodePlaceholder')}
            disabled={loading}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 theme-text-secondary hover:theme-text-primary"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {errors.recoveryCode && (
          <p className="mt-1 text-sm text-red-500">{errors.recoveryCode}</p>
        )}
      </div>

      {/* Confirm Recovery Code */}
      <div>
        <label htmlFor="confirmCode" className="block text-sm font-medium theme-text-primary mb-2">
          {t('auth.confirmRecoveryCode')} <span className="text-red-500">*</span>
        </label>
        <input
          type={showPassword ? 'text' : 'password'}
          id="confirmCode"
          value={confirmCode}
          onChange={(e) => setConfirmCode(e.target.value)}
          className={`w-full px-4 py-3 rounded-lg theme-bg-primary theme-text-primary border-2
            ${errors.confirmCode ? 'border-red-500' : 'theme-border'}
            focus:outline-none focus:border-blue-500 transition-colors`}
          placeholder={t('auth.confirmRecoveryCode')}
          disabled={loading}
        />
        {errors.confirmCode && (
          <p className="mt-1 text-sm text-red-500">{errors.confirmCode}</p>
        )}
      </div>

      {/* Password Strength Indicator */}
      {recoveryCode && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="theme-text-secondary">{t('common.strength')}:</span>
            <span className={`font-medium ${
              recoveryCode.length < 8 ? 'text-red-500' :
              recoveryCode.length < 12 ? 'text-yellow-500' :
              recoveryCode.length < 16 ? 'text-blue-500' : 'text-green-500'
            }`}>
              {recoveryCode.length < 8 ? t('common.weak') :
               recoveryCode.length < 12 ? t('common.fair') :
               recoveryCode.length < 16 ? t('common.good') : t('common.strong')}
            </span>
          </div>
          <div className="h-2 theme-bg-primary rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                recoveryCode.length < 8 ? 'bg-red-500 w-1/4' :
                recoveryCode.length < 12 ? 'bg-yellow-500 w-1/2' :
                recoveryCode.length < 16 ? 'bg-blue-500 w-3/4' : 'bg-green-500 w-full'
              }`}
            />
          </div>
        </div>
      )}

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
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
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
            <span>{t('common.next')}</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default Step5RecoveryCode;
