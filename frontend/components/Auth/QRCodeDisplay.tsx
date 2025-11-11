import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface QRCodeDisplayProps {
  qrCodeImage: string;
  totpSecret: string;
  username: string;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ qrCodeImage, totpSecret, username }) => {
  const { t } = useLanguage();

  const copySecret = () => {
    navigator.clipboard.writeText(totpSecret);
  };

  return (
    <div className="space-y-6">
      {/* QR Code Section */}
      <div className="flex flex-col items-center space-y-4">
        <h3 className="text-lg font-semibold theme-text-primary">
          {t('registration.scanQR')}
        </h3>
        <p className="text-sm theme-text-secondary text-center max-w-md">
          {t('registration.qrInstructions')}
        </p>

        {/* QR Code Image */}
        <div className="p-4 theme-bg-secondary rounded-xl border-2 theme-border">
          <img
            src={qrCodeImage}
            alt="TOTP QR Code"
            className="w-64 h-64"
          />
        </div>
      </div>

      {/* Manual Entry Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold theme-text-primary">
          {t('registration.manualEntry')}
        </h3>
        <p className="text-sm theme-text-secondary">
          {t('registration.manualInstructions')}
        </p>

        {/* Secret Key Display */}
        <div className="flex items-center space-x-2 p-4 theme-bg-secondary rounded-lg border theme-border">
          <code className="flex-1 text-sm font-mono theme-text-primary break-all">
            {totpSecret}
          </code>
          <button
            onClick={copySecret}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-1"
            title={t('common.copy')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">Copy</span>
          </button>
        </div>

        {/* Account Info */}
        <div className="text-sm theme-text-secondary space-y-1">
          <p><strong>Account:</strong> {username}</p>
          <p><strong>Type:</strong> Time-based (TOTP)</p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeDisplay;
