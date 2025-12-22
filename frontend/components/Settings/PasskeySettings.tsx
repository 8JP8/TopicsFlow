import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { startRegistration } from '@simplewebauthn/browser';

interface Passkey {
    id: string;
    credential_id: string;
    name: string;
    created_at: string;
    last_used_at?: string;
}

const PasskeySettings: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [passkeys, setPasskeys] = useState<Passkey[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [showTotpModal, setShowTotpModal] = useState(false);

    useEffect(() => {
        fetchPasskeys();
    }, []);

    const fetchPasskeys = async () => {
        try {
            setLoading(true);
            const response = await api.get('/auth/passkey/list');
            if (response.data.success) {
                setPasskeys(response.data.passkeys || []);
            }
        } catch (error) {
            console.error('Failed to fetch passkeys:', error);
            // Silent error or mild toast
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePasskey = async () => {
        if (!user?.totp_enabled) {
            toast.error(t('settings.enableTotpFirst') || 'Please enable 2FA (TOTP) first to add passkeys.');
            return;
        }
        setShowTotpModal(true);
    };

    const verifyTotpAndRegister = async () => {
        if (!totpCode || totpCode.length !== 6) {
            toast.error(t('settings.invalidTotp') || 'Invalid TOTP code');
            return;
        }

        try {
            setIsAdding(true);
            // 1. Verify TOTP first
            const verifyRes = await api.post('/auth/totp/verify', {
                code: totpCode,
                is_setup: false // Verifying existing TOTP setup
            });

            if (!verifyRes.data.success) {
                toast.error(t('settings.totpVerificationFailed') || 'Verification failed. Please try again.');
                setIsAdding(false);
                return;
            }

            // Close modal on success
            setShowTotpModal(false);
            setTotpCode('');

            // 2. Start Passkey Registration
            const optionsRes = await api.post('/auth/passkey/register-options', {
                email: user?.email // Optional, backend might infer from token
            });

            if (!optionsRes.data.success) {
                throw new Error('Failed to get registration options');
            }

            const attResp = await startRegistration(optionsRes.data.options);

            const verifyPasskeyRes = await api.post('/auth/passkey/register-verify', {
                credential: attResp,
                email: user?.email
            });

            if (verifyPasskeyRes.data.success) {
                toast.success(t('settings.passkeyAdded') || 'Passkey added successfully');
                fetchPasskeys();
            } else {
                throw new Error('Verification failed');
            }

        } catch (error: any) {
            console.error('Passkey registration error:', error);
            toast.error(error.message || t('settings.passkeyFailed') || 'Failed to add passkey');
            // If error occurred after modal closed, we don't reopen it automatically
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeletePasskey = async (id: string, credentialId: string) => {
        if (!confirm(t('settings.confirmDeletePasskey') || 'Are you sure you want to remove this passkey?')) {
            return;
        }

        try {
            const response = await api.delete(`/auth/passkey/${credentialId}`);
            if (response.data.success) {
                toast.success(t('settings.passkeyDeleted') || 'Passkey removed');
                setPasskeys(passkeys.filter(pk => pk.credential_id !== credentialId));
            }
        } catch (error) {
            toast.error(t('settings.deleteFailed') || 'Failed to remove passkey');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium theme-text-primary">{t('settings.passkeys') || 'Passkeys'}</h3>
                    <p className="text-sm theme-text-secondary">
                        {t('settings.passkeysDesc') || 'Use existing devices to sign in without a password.'}
                    </p>
                </div>
                <button
                    onClick={handleCreatePasskey}
                    disabled={isAdding}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    {isAdding ? '...' : t('settings.addPasskey') || 'Add Passkey'}
                </button>
            </div>

            {/* List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="animate-pulse flex space-x-4">
                        <div className="flex-1 space-y-4 py-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                ) : passkeys.length === 0 ? (
                    <p className="text-sm theme-text-muted italic">{t('settings.noPasskeys') || 'No passkeys registered.'}</p>
                ) : (
                    passkeys.map((pk) => (
                        <div key={pk.credential_id} className="flex items-center justify-between p-3 border theme-border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium theme-text-primary">{pk.name || 'Passkey'}</p>
                                    <p className="text-xs theme-text-secondary">
                                        {t('common.added')}: {new Date(pk.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDeletePasskey(pk.id, pk.credential_id)}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full transition-colors"
                                title={t('common.delete')}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* TOTP Verification Modal */}
            {showTotpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
                        <h3 className="text-lg font-bold theme-text-primary mb-4">{t('settings.verifyIdentity') || 'Verify Identity'}</h3>
                        <p className="text-sm theme-text-secondary mb-4">
                            {t('settings.enterTotpForPasskey') || 'Please enter your 2FA code to add a new passkey.'}
                        </p>
                        <input
                            type="text"
                            value={totpCode}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                                setTotpCode(val);
                            }}
                            placeholder="000000"
                            className="w-full text-center text-2xl tracking-widest px-4 py-2 border theme-border rounded-lg theme-text-primary bg-transparent focus:ring-2 focus:ring-blue-500 mb-6"
                            autoFocus
                        />

                        <div className="flex space-x-3">
                            <button
                                onClick={() => {
                                    setShowTotpModal(false);
                                    setTotpCode('');
                                }}
                                className="flex-1 px-4 py-2 text-sm font-medium theme-text-secondary bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={verifyTotpAndRegister}
                                disabled={totpCode.length !== 6 || isAdding}
                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {isAdding ? <span className="animate-spin inline-block mr-2">⟳</span> : null}
                                {t('common.verify')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PasskeySettings;
