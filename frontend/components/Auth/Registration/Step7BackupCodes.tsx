import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { RegistrationData } from './RegistrationWizard';

interface Step7Props {
  data: RegistrationData;
  onComplete: () => void;
}

const Step7BackupCodes: React.FC<Step7Props> = ({ data, onComplete }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    // Use backup codes from registration data (returned from TOTP setup)
    if (data.backupCodes && data.backupCodes.length > 0) {
      setBackupCodes(data.backupCodes);
      setLoading(false);
    } else {
      // Fallback: fetch backup codes if not in data
      fetchBackupCodes();
    }
  }, [data.backupCodes]);

  const fetchBackupCodes = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/backup-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include session cookies
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setBackupCodes(result.backup_codes || []);
      } else {
        toast.error(result.error || t('errors.generic'));
      }
    } catch (error) {
      console.error('Backup codes fetch error:', error);
      toast.error(t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const content = [
      `${t('registration.backupCodesTitle')}`,
      `${t('common.account')}: ${data.username}`,
      `${t('common.email')}: ${data.email}`,
      `${t('common.date')}: ${new Date().toLocaleDateString()}`,
      '',
      t('registration.backupCodesWarning'),
      '',
      ...backupCodes.map((code, index) => `${index + 1}. ${code}`),
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-codes-${data.username}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setHasSaved(true);
    toast.success(t('success.codesDownloaded'));
  };

  const handleCopy = async () => {
    const content = backupCodes.join('\n');
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setHasSaved(true);
      toast.success(t('success.copiedToClipboard'));
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error(t('errors.copyFailed'));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="theme-text-secondary">{t('registration.generatingCodes')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-green-900 dark:text-green-100 mb-1">
              {t('registration.registrationComplete')}
            </p>
            <p className="text-green-700 dark:text-green-300">
              {t('registration.backupCodesInfo')}
            </p>
          </div>
        </div>
      </div>

      {/* Warning Box */}
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-red-900 dark:text-red-100 mb-1">
              {t('common.important')}
            </p>
            <p className="text-red-700 dark:text-red-300">
              {t('registration.backupCodesWarning')}
            </p>
          </div>
        </div>
      </div>

      {/* Backup Codes List */}
      <div className="p-6 theme-bg-primary rounded-lg border-2 theme-border">
        <h3 className="text-lg font-semibold theme-text-primary mb-4 text-center">
          {t('registration.yourBackupCodes')}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {backupCodes.map((code, index) => (
            <div
              key={index}
              className="p-3 theme-bg-secondary rounded-lg border theme-border"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs theme-text-secondary font-medium">#{index + 1}</span>
                <code className="text-sm font-mono theme-text-primary font-bold">
                  {code}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={handleDownload}
          className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white
            font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>{t('registration.downloadCodes')}</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="py-3 px-4 theme-bg-secondary hover:theme-bg-tertiary theme-text-primary
            font-medium rounded-lg transition-colors border-2 theme-border flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>{copied ? t('success.copied') : t('registration.copyCodes')}</span>
        </button>
      </div>

      {/* Usage Instructions */}
      <div className="p-4 theme-bg-primary rounded-lg border theme-border">
        <h4 className="font-medium theme-text-primary mb-2">
          {t('registration.howToUseBackupCodes')}
        </h4>
        <ul className="text-sm theme-text-secondary space-y-1 list-disc list-inside ml-2">
          <li>{t('registration.backupCodeUse1')}</li>
          <li>{t('registration.backupCodeUse2')}</li>
          <li>{t('registration.backupCodeUse3')}</li>
        </ul>
      </div>

      {/* Complete Button */}
      <button
        type="button"
        onClick={onComplete}
        disabled={!hasSaved}
        className="w-full py-4 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400
          text-white font-bold rounded-lg transition-colors text-lg flex items-center justify-center space-x-2"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>{t('common.finish')}</span>
      </button>

      {!hasSaved && (
        <p className="text-center text-sm theme-text-secondary">
          {t('registration.mustSaveCodes')}
        </p>
      )}
    </div>
  );
};

export default Step7BackupCodes;
