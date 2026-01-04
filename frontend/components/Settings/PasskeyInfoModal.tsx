import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface PasskeyInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PasskeyInfoModal: React.FC<PasskeyInfoModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();

    // Helper to detect platform
    const platform = useMemo(() => {
        if (typeof window === 'undefined') return 'default';
        const ua = navigator.userAgent;
        const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

        if (/Windows/i.test(ua) || /Win/i.test(platform)) return 'windows';
        if (/Mac OS X|Macintosh/i.test(ua) || /Mac/i.test(platform)) return 'mac';
        if (/Linux/i.test(ua) || /Linux/i.test(platform)) return 'linux';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
        if (/Android/i.test(ua)) return 'android';

        return 'default';
    }, []);

    if (!isOpen) return null;

    // Helper to get icon
    const getPlatformIcon = (plat: string) => {
        switch (plat) {
            case 'windows':
            case 'mac':
            case 'linux':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-monitor theme-text-primary">
                        <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
                    </svg>
                );
            case 'ios':
            case 'android':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-smartphone theme-text-primary">
                        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />
                    </svg>
                );
            default:
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield theme-text-primary">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    </svg>
                );
        }

    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b theme-border bg-white dark:bg-gray-800 rounded-t-xl shrink-0">
                    <div>
                        <h3 className="text-xl font-bold theme-text-primary">
                            {t('settings.passkeyInfoTitle') || 'About Passkeys'}
                        </h3>
                        <p className="text-sm theme-text-secondary mt-1">
                            {t('settings.passkeyInfoSubtitle') || 'Passkeys are a modern, secure way to sign in without typing a password. They use the biometric security features already on your device.'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 space-y-8 overflow-y-auto flex-1">

                    {/* Methods Grid */}
                    <div>
                        <h4 className="font-semibold theme-text-primary mb-4 flex items-center gap-2">
                            {t('settings.supportedMethods') || 'Supported Methods'}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                            {/* Biometrics */}
                            <div className="p-4 rounded-xl border theme-border hover:border-purple-500/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all group">
                                <div className="mb-3 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg w-fit group-hover:scale-110 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-fingerprint-pattern-icon lucide-fingerprint-pattern text-purple-600 dark:text-purple-400"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /><path d="M14 13.12c0 2.38 0 6.38-1 8.88" /><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /><path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16h.01" /><path d="M21.8 16c.2-2 .131-5.354 0-6" /><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" /><path d="M8.65 22c.21-.66.45-1.32.57-2" /><path d="M9 6.8a6 6 0 0 1 9 5.2v2" /></svg>
                                </div>
                                <h5 className="font-medium theme-text-primary mb-1">
                                    {t('settings.biometricLogin') || 'Biometric Login'}
                                </h5>
                                <p className="text-sm theme-text-secondary">
                                    {t('settings.biometricDesc') || 'Use Touch ID or Fingerprint sensors on your laptop or phone.'}
                                </p>
                            </div>

                            {/* Face Scan */}
                            <div className="p-4 rounded-xl border theme-border hover:border-purple-500/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all group">
                                <div className="mb-3 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg w-fit group-hover:scale-110 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-scan-face-icon lucide-scan-face text-purple-600 dark:text-purple-400"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01" /><path d="M15 9h.01" /></svg>
                                </div>
                                <h5 className="font-medium theme-text-primary mb-1">
                                    {t('settings.faceRecognition') || 'Face Recognition'}
                                </h5>
                                <p className="text-sm theme-text-secondary">
                                    {t('settings.faceIdDesc') || 'Use Face ID on iOS or Windows Hello facial recognition.'}
                                </p>
                            </div>

                            {/* External Keys */}
                            <div className="p-4 rounded-xl border theme-border hover:border-purple-500/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all group">
                                <div className="mb-3 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg w-fit group-hover:scale-110 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-usb-icon lucide-usb text-purple-600 dark:text-purple-400"><circle cx="10" cy="7" r="1" /><circle cx="4" cy="20" r="1" /><path d="M4.7 19.3 19 5" /><path d="m21 3-3 1 2 2Z" /><path d="M9.26 7.68 5 12l2 5" /><path d="m10 14 5 2 3.5-3.5" /><path d="m18 12 1-1 1 1-1 1Z" /></svg>
                                </div>
                                <h5 className="font-medium theme-text-primary mb-1">
                                    {t('settings.securityKeys') || 'Security Keys'}
                                </h5>
                                <p className="text-sm theme-text-secondary">
                                    {t('settings.securityKeysDesc') || 'Hardware keys like YubiKey or Titan Security Key.'}
                                </p>
                            </div>

                            {/* QR Code */}
                            <div className="p-4 rounded-xl border theme-border hover:border-purple-500/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all group">
                                <div className="mb-3 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg w-fit group-hover:scale-110 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-scan-qr-code-icon lucide-scan-qr-code text-purple-600 dark:text-purple-400"><path d="M17 12v4a1 1 0 0 1-1 1h-4" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M17 8V7" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M7 17h.01" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><rect x="7" y="7" width="5" height="5" rx="1" /></svg>
                                </div>
                                <h5 className="font-medium theme-text-primary mb-1">
                                    {t('settings.otherDevices') || 'Other Devices'}
                                </h5>
                                <p className="text-sm theme-text-secondary">
                                    {t('settings.qrCodeDesc') || 'Scan a QR code to use your phone to sign in on another device.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Platform Specifics */}
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 border theme-border">
                        <div className="flex items-center gap-2 mb-2">
                            {getPlatformIcon(platform)}
                            <h4 className="font-semibold theme-text-primary text-sm">
                                {t(`settings.platformInfo.${platform}.title`) || t('settings.windowsHelloTitle') || 'Windows Users'}
                            </h4>
                        </div>
                        <p className="text-sm theme-text-secondary">
                            {t(`settings.platformInfo.${platform}.description`) || t('settings.windowsHelloInfo') || 'On Windows, you can use Windows Hello to sign in with your face, fingerprint, or PIN exactly like you unlock your PC.'}
                        </p>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t theme-border flex justify-end bg-white dark:bg-gray-800 rounded-b-xl shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 theme-text-primary rounded-lg font-medium transition-colors"
                    >
                        {t('common.close') || 'Close'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PasskeyInfoModal;
