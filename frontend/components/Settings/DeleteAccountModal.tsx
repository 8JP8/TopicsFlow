import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const router = useRouter();
    const [totpCode, setTotpCode] = useState('');
    const [emailCode, setEmailCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'confirm' | 'verify'>('confirm');

    if (!isOpen) return null;

    const handleSendEmailCode = async () => {
        try {
            setLoading(true);
            const response = await api.post(API_ENDPOINTS.USERS.REQUEST_DELETION_CODE);
            if (response.data.success) {
                toast.success(t('deleteAccount.emailSent') || 'Verification code sent to your email');
                setStep('verify');
            } else {
                toast.error(response.data.errors?.[0] || t('errors.generic'));
            }
        } catch (error) {
            console.error('Failed to request deletion code:', error);
            toast.error(t('errors.generic') || 'Failed to initiate deletion');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!totpCode || !emailCode) {
            toast.error(t('deleteAccount.fillAll') || 'Please enter both codes');
            return;
        }

        if (!confirm(t('deleteAccount.finalConfirm') || 'Are you absolutely sure? This cannot be undone.')) {
            return;
        }

        try {
            setLoading(true);
            const response = await api.delete(API_ENDPOINTS.USERS.DELETE_ACCOUNT, {
                data: {
                    verification_code: emailCode,
                    totp_code: totpCode
                }
            });

            if (response.data.success) {
                toast.success(t('deleteAccount.success') || 'Account deleted successfully');
                router.push('/login');
            } else {
                toast.error(response.data.errors?.[0] || t('deleteAccount.failed'));
            }
        } catch (error) {
            console.error('Delete account error:', error);
            toast.error(t('deleteAccount.failed') || 'Failed to delete account. Check your codes.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-red-50 dark:bg-red-900/20">
                    <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                        {t('settings.deleteAccount') || 'Delete Account'}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 'confirm' ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                                    {t('deleteAccount.warning') || 'Warning: This action is irreversible. All your data, messages, and settings will be permanently lost.'}
                                </p>
                            </div>
                            <p className="text-sm theme-text-secondary">
                                {t('deleteAccount.confirmDesc') || 'To verify your identity, we need to send a verification code to your email address. You will also need your 2FA authenticator app.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium theme-text-primary mb-1">
                                    {t('twoFactor.authCode') || 'Authenticator Code (TOTP)'}
                                </label>
                                <input
                                    type="text"
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value)}
                                    placeholder="000000"
                                    className="w-full px-4 py-2 theme-bg-tertiary theme-text-primary border theme-border rounded-lg focus:ring-2 focus:ring-red-500"
                                    maxLength={6}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium theme-text-primary mb-1">
                                    {t('deleteAccount.emailCode') || 'Email Verification Code'}
                                </label>
                                <input
                                    type="text"
                                    value={emailCode}
                                    onChange={(e) => setEmailCode(e.target.value)}
                                    placeholder="Enter code sent to email"
                                    className="w-full px-4 py-2 theme-bg-tertiary theme-text-primary border theme-border rounded-lg focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t theme-border bg-gray-50 dark:bg-gray-800/50 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 theme-text-secondary hover:theme-text-primary font-medium"
                        disabled={loading}
                    >
                        {t('common.cancel') || 'Cancel'}
                    </button>

                    {step === 'confirm' ? (
                        <button
                            onClick={handleSendEmailCode}
                            disabled={loading}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center"
                        >
                            {loading ? <LoadingSpinner size="sm" className="text-white" /> : null}
                            <span className={loading ? 'ml-2' : ''}>
                                {t('common.continue') || 'Continue'}
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={handleDelete}
                            disabled={loading || !totpCode || !emailCode}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center"
                        >
                            {loading ? <LoadingSpinner size="sm" className="text-white" /> : null}
                            <span className={loading ? 'ml-2' : ''}>
                                {t('settings.deleteAccount') || 'Delete Account'}
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeleteAccountModal;
