import React, { useState } from 'react';
import { api } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import TOTPInput from '@/components/Auth/TOTPInput';

interface BackupCodesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const BackupCodesModal: React.FC<BackupCodesModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const [step, setStep] = useState<'verify' | 'display'>('verify');
    const [isLoading, setIsLoading] = useState(false);
    const [backupCodes, setBackupCodes] = useState<string[]>([]);

    // reset function when modal closes or unmounts is handled by parent unmounting it usually, 
    // or we can add useEffect to reset if isOpen changes.
    // For now, state is local to component instance.

    const handleVerify = async (code: string) => {
        if (!code || code.length !== 6) return;

        setIsLoading(true);
        try {
            const response = await api.post('/api/auth/backup-codes', { totp_code: code });
            if (response.data.success) {
                setBackupCodes(response.data.backup_codes);
                setStep('display');
            } else {
                toast.error(response.data.errors?.[0] || t('errors.invalidCode'));
            }
        } catch (error: any) {
            toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyCodes = () => {
        const text = backupCodes.join('\n');
        navigator.clipboard.writeText(text);
        toast.success(t('success.copied') || 'Copied to clipboard');
    };

    const handleDownload = () => {
        const text = backupCodes.join('\n');
        const element = document.createElement("a");
        const file = new Blob([text], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = "backup-codes.txt";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        toast.success(t('success.codesDownloaded'));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold theme-text-primary">
                        {t('settings.backupCodes')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {step === 'verify' ? (
                    <div className="space-y-6">
                        <p className="theme-text-secondary text-sm text-center">
                            {t('settings.backupCodesVerifyDesc')}
                        </p>

                        <div className="flex justify-center">
                            <TOTPInput
                                length={6}
                                onComplete={handleVerify}
                                disabled={isLoading}
                                autoFocus={true}
                            />
                        </div>

                        <div className="flex justify-center h-6">
                            {isLoading && <LoadingSpinner size="md" />}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium btn-ghost rounded-lg"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
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
                                        {t('settings.backupCodesWarning')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 p-4 theme-bg-secondary rounded-lg font-mono text-center theme-text-primary border theme-border">
                            {backupCodes.map((code, index) => (
                                <div key={index} className="py-1 select-all font-bold tracking-wider">{code}</div>
                            ))}
                        </div>

                        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                            <button
                                onClick={handleCopyCodes}
                                className="flex-1 px-4 py-2 text-sm font-medium btn-secondary rounded-lg flex items-center justify-center transition-colors"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                {t('common.copy')}
                            </button>
                            <button
                                onClick={handleDownload}
                                className="flex-1 px-4 py-2 text-sm font-medium btn-secondary rounded-lg flex items-center justify-center transition-colors"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {t('common.download')}
                            </button>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={onClose}
                                className="px-6 py-2 text-sm font-medium btn-primary rounded-lg shadow-md hover:shadow-lg transition-all"
                            >
                                {t('common.done')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BackupCodesModal;
