import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { startRegistration } from '@simplewebauthn/browser';
import TOTPInput from '@/components/Auth/TOTPInput';
import PasskeyInfoModal from './PasskeyInfoModal';

// Avoid importing an extra package just for types in this repo setup.
type RegistrationResponseJSON = any;

interface Passkey {
    credential_id: string;
    created_at: string;
    last_used?: string;
    device_name?: string;
}

const PasskeySettings: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [passkeys, setPasskeys] = useState<Passkey[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [showTotpModal, setShowTotpModal] = useState(false);
    const [totpKey, setTotpKey] = useState(0); // For resetting input

    // Name / rename modal
    const [showNameModal, setShowNameModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [nameModalMode, setNameModalMode] = useState<'add' | 'rename'>('add');
    const [nameInput, setNameInput] = useState('');
    const [nameError, setNameError] = useState<string | null>(null);
    const [nameSaving, setNameSaving] = useState(false);
    const [renameCredentialId, setRenameCredentialId] = useState<string | null>(null);
    const [pendingAttResp, setPendingAttResp] = useState<RegistrationResponseJSON | null>(null);

    const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 64);

    const isDuplicateName = (candidate: string, excludeCredentialId?: string | null) => {
        const c = normalizeName(candidate).toLowerCase();
        if (!c) return false;
        return passkeys.some(pk => {
            if (excludeCredentialId && pk.credential_id === excludeCredentialId) return false;
            return (pk.device_name || '').trim().toLowerCase() === c;
        });
    };

    const guessPcName = () => {
        try {
            const anyNav: any = navigator as any;
            const platform = (anyNav.userAgentData?.platform || navigator.platform || '').toString();
            const ua = (navigator.userAgent || '').toString();
            const isWindows = /Windows/i.test(ua) || /Win/i.test(platform);
            const isMac = /Mac OS X|Macintosh/i.test(ua) || /Mac/i.test(platform);
            const isAndroid = /Android/i.test(ua);
            const isIOS = /iPhone|iPad|iPod/i.test(ua);
            if (isWindows) return 'Windows PC';
            if (isMac) return 'Mac';
            if (isAndroid) return 'Android device';
            if (isIOS) return 'iPhone/iPad';
            return platform || 'This device';
        } catch {
            return 'This device';
        }
    };

    useEffect(() => {
        fetchPasskeys();
    }, []);

    const fetchPasskeys = async () => {
        try {
            setLoading(true);
            const response = await api.get(API_ENDPOINTS.AUTH.PASSKEY.LIST);
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

    const verifyTotpAndRegister = async (code?: string) => {
        const tokenToVerify = code || totpCode;
        if (!tokenToVerify || tokenToVerify.length !== 6) {
            toast.error(t('settings.invalidTotp') || 'Invalid TOTP code');
            return;
        }

        try {
            if (!user) return;
            setIsAdding(true);
            // 1. Verify TOTP first (general verification, not setup)
            const verifyRes = await api.post(API_ENDPOINTS.AUTH.VERIFY_TOTP, {
                user_id: user.id,
                totp_code: tokenToVerify,
                is_setup: false
            });

            if (!verifyRes.data.success) {
                toast.error(t('settings.totpVerificationFailed') || 'Verification failed. Please try again.');
                setIsAdding(false);
                return;
            }

            // Close modal on success
            setShowTotpModal(false);
            setTotpCode('');
            setTotpKey(prev => prev + 1);

            // 2. Start Passkey Registration
            const optionsRes = await api.post(API_ENDPOINTS.AUTH.PASSKEY.REGISTER_OPTIONS, {
                email: user?.email // Optional, backend might infer from token
            });

            if (!optionsRes.data.success) {
                throw new Error('Failed to get registration options');
            }

            const attResp = await startRegistration({ optionsJSON: optionsRes.data.options });

            // Open naming modal (default name best-effort)
            setPendingAttResp(attResp);
            setNameModalMode('add');
            const defName = guessPcName();
            setNameInput(defName);
            setNameError(null);
            setShowNameModal(true);

        } catch (error: any) {
            console.error('Passkey registration error:', error);
            toast.error(error.message || t('settings.passkeyFailed') || 'Failed to add passkey');
            // If error occurred after modal closed, we don't reopen it automatically
        } finally {
            setIsAdding(false);
        }
    };

    const handleRenamePasskey = (credentialId: string, currentName?: string) => {
        setNameModalMode('rename');
        setRenameCredentialId(credentialId);
        setNameInput(currentName || guessPcName());
        setNameError(null);
        setShowNameModal(true);
    };

    const closeNameModal = () => {
        setShowNameModal(false);
        setNameSaving(false);
        setNameError(null);
        setRenameCredentialId(null);
        setPendingAttResp(null);
    };

    const saveNameModal = async () => {
        if (!user) return;
        const finalName = normalizeName(nameInput);
        if (!finalName) {
            setNameError(t('settings.passkeyNameRequired') || 'Name is required');
            return;
        }

        if (nameModalMode === 'add') {
            if (isDuplicateName(finalName, null)) {
                setNameError(t('settings.passkeyNameDuplicate') || 'You already have a passkey with this name');
                return;
            }
            if (!pendingAttResp) {
                setNameError(t('settings.passkeyFailed') || 'Failed to add passkey');
                return;
            }
            try {
                setNameSaving(true);
                const verifyPasskeyRes = await api.post(API_ENDPOINTS.AUTH.PASSKEY.REGISTER_VERIFY, {
                    credential: pendingAttResp,
                    email: user?.email,
                    device_name: finalName
                });
                if (verifyPasskeyRes.data.success) {
                    toast.success(t('settings.passkeyAdded') || 'Passkey added successfully');
                    closeNameModal();
                    fetchPasskeys();
                } else {
                    const err = (verifyPasskeyRes.data.errors && verifyPasskeyRes.data.errors[0]) || t('settings.passkeyFailed') || 'Failed to add passkey';
                    setNameError(err);
                }
            } catch (e: any) {
                setNameError(e?.message || t('settings.passkeyFailed') || 'Failed to add passkey');
            } finally {
                setNameSaving(false);
            }
        } else {
            // rename
            if (!renameCredentialId) return;
            if (isDuplicateName(finalName, renameCredentialId)) {
                setNameError(t('settings.passkeyNameDuplicate') || 'You already have a passkey with this name');
                return;
            }
            try {
                setNameSaving(true);
                const res = await api.patch(API_ENDPOINTS.AUTH.PASSKEY.UPDATE(renameCredentialId), { device_name: finalName });
                if (res.data.success) {
                    toast.success(t('settings.passkeyRenamed') || 'Passkey renamed');
                    closeNameModal();
                    fetchPasskeys();
                } else {
                    const err = (res.data.errors && res.data.errors[0]) || t('settings.passkeyRenameFailed') || 'Failed to rename passkey';
                    setNameError(err);
                }
            } catch (e: any) {
                setNameError(e?.message || t('settings.passkeyRenameFailed') || 'Failed to rename passkey');
            } finally {
                setNameSaving(false);
            }
        }
    };

    const handleDeletePasskey = async (credentialId: string) => {
        if (!confirm(t('settings.confirmDeletePasskey') || 'Are you sure you want to remove this passkey?')) {
            return;
        }

        try {
            const response = await api.delete(API_ENDPOINTS.AUTH.PASSKEY.DELETE(credentialId));
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
            <div className="flex justify-between items-start">
                <div className="flex items-start">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="17"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-lock-keyhole theme-text-primary mr-2 mt-1"
                        style={{ minWidth: '17px', minHeight: '20px' }}
                    >
                        <circle cx="12" cy="16" r="1" />
                        <rect x="3" y="10" width="18" height="12" rx="2" />
                        <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                    </svg>
                    <div>
                        <h4 className="font-medium theme-text-primary">{t('settings.passkeys') || 'Passkeys'}</h4>
                        <p className="text-sm theme-text-secondary mt-1">
                            {t('settings.passkeysDesc') || 'Add biometric login (Face ID, Touch ID or Windows Hello) for faster and more secure access.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <button
                    onClick={() => setShowInfoModal(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-lg"
                    title={t('common.learnMore') || 'Learn More'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                </button>
                <button
                    onClick={handleCreatePasskey}
                    disabled={isAdding}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                >
                    {isAdding ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-loader-circle-icon lucide-loader-circle animate-spin inline-block mr-2 w-4 h-4"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    ) : null}
                    {t('settings.addPasskey') || 'Add Passkey'}
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
                                    <p className="text-sm font-medium theme-text-primary">{pk.device_name || 'Passkey'}</p>
                                    <p className="text-xs theme-text-secondary">
                                        {new Date(pk.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleRenamePasskey(pk.credential_id, pk.device_name)}
                                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                    title={t('common.edit') || 'Edit'}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleDeletePasskey(pk.credential_id)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full transition-colors"
                                    title={t('common.delete')}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* TOTP Verification Modal */}
            {
                showTotpModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold theme-text-primary">{t('settings.verifyIdentity') || 'Verify Identity'}</h3>
                                <button
                                    onClick={() => {
                                        setShowTotpModal(false);
                                        setTotpCode('');
                                        setTotpKey(prev => prev + 1);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <p className="text-sm theme-text-secondary mb-6">
                                {t('settings.enterTotpForPasskey') || 'Please enter your 2FA code to add a new passkey.'}
                            </p>

                            <div className="flex justify-center mb-2">
                                <TOTPInput
                                    key={totpKey}
                                    length={6}
                                    onComplete={(code) => {
                                        setTotpCode(code);
                                        verifyTotpAndRegister(code);
                                    }}
                                    disabled={isAdding}
                                    autoFocus={true}
                                />
                            </div>
                            {isAdding && (
                                <div className="flex justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-loader-circle-icon lucide-loader-circle animate-spin text-white"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Passkey Name Modal */}
            {showNameModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold theme-text-primary">
                                {nameModalMode === 'add'
                                    ? (t('settings.namePasskeyTitle') || 'Name your passkey')
                                    : (t('settings.renamePasskeyTitle') || 'Rename passkey')}
                            </h3>
                            <button
                                onClick={closeNameModal}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                disabled={nameSaving}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <p className="text-sm theme-text-secondary mb-4">
                            {t('settings.passkeyNameHelp') || 'Give this passkey a name so you can recognize it later.'}
                        </p>

                        <input
                            value={nameInput}
                            onChange={(e) => {
                                setNameInput(e.target.value);
                                setNameError(null);
                            }}
                            className="w-full px-3 py-2 border theme-border rounded-lg bg-white dark:bg-gray-900 theme-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder={t('settings.passkeyNamePlaceholder') || 'e.g., Windows PC'}
                            maxLength={64}
                            disabled={nameSaving}
                            autoFocus
                        />

                        {nameError && <p className="text-sm text-red-500 mt-2">{nameError}</p>}

                        {isDuplicateName(nameInput, nameModalMode === 'rename' ? renameCredentialId : null) && !nameError && (
                            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                                {t('settings.passkeyNameDuplicate') || 'You already have a passkey with this name'}
                            </p>
                        )}

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={closeNameModal}
                                disabled={nameSaving}
                                className="px-4 py-2 text-sm font-medium theme-text-primary bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                            >
                                {t('common.cancel') || 'Cancel'}
                            </button>
                            <button
                                onClick={saveNameModal}
                                disabled={nameSaving || !normalizeName(nameInput) || isDuplicateName(nameInput, nameModalMode === 'rename' ? renameCredentialId : null)}
                                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                                {nameSaving ? (t('common.saving') || 'Saving...') : (t('common.save') || 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <PasskeyInfoModal
                isOpen={showInfoModal}
                onClose={() => setShowInfoModal(false)}
            />
        </div >
    );
};

export default PasskeySettings;
