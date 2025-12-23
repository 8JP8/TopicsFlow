import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import QRCodeDisplay from '../QRCodeDisplay';
import { RegistrationData } from './RegistrationWizard';

interface Step3Props {
  data: RegistrationData;
  updateData: (data: Partial<RegistrationData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const Step3AuthenticatorSetup: React.FC<Step3Props> = ({ data, updateData, onNext, onBack }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<{
    qrCodeImage: string;
    totpSecret: string;
  } | null>(null);

  useEffect(() => {
    fetchQRCode();
  }, []);

  const fetchQRCode = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/totp/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          username: data.username,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setQrData({
          qrCodeImage: result.qr_code_image,
          totpSecret: result.totp_secret,
        });
        updateData({
          totpSecret: result.totp_secret,
          qrCodeImage: result.qr_code_image,
        });
      } else {
        toast.error(result.error || t('errors.generic'));
      }
    } catch (error) {
      console.error('QR code fetch error:', error);
      toast.error(t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="theme-text-secondary">{t('common.loading')}</p>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="theme-text-primary">{t('errors.generic')}</p>
        <button
          onClick={fetchQRCode}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Authenticator Apps Info */}
      <div className="p-4 theme-bg-primary rounded-lg border theme-border">
        <h4 className="font-medium theme-text-primary mb-2">
          {t('registration.compatibleApps')}
        </h4>
        <ul className="text-sm theme-text-secondary space-y-1">
          <li>• Google Authenticator</li>
          <li>• Microsoft Authenticator</li>
          <li>• Authy</li>
          <li>• 1Password</li>
          <li>• {t('registration.otherTOTPApps')}</li>
        </ul>
      </div>

      {/* QR Code Display */}
      <QRCodeDisplay
        qrCodeImage={qrData.qrCodeImage}
        totpSecret={qrData.totpSecret}
        username={data.username}
      />

      {/* Warning Box */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
              {t('common.important')}
            </p>
            <p className="text-yellow-700 dark:text-yellow-300">
              {t('registration.saveAuthenticatorWarning')}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex space-x-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 px-4 theme-bg-primary hover:theme-bg-tertiary theme-text-primary
            font-medium rounded-lg transition-colors border-2 theme-border"
        >
          {t('common.previous')}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white
            font-medium rounded-lg transition-colors"
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  );
};

export default Step3AuthenticatorSetup;
