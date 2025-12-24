import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { RegistrationData } from './RegistrationWizard';
import { getApiBaseUrl } from '@/utils/api';

interface Step6Props {
  data: RegistrationData;
  updateData: (data: Partial<RegistrationData>) => void;
  onNext: () => void;
  onSkip: () => void;
}

const Step6PasskeySetup: React.FC<Step6Props> = ({ data, updateData, onNext, onSkip }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  );

  const handleAddPasskey = async () => {
    if (!passkeySupported) {
      toast.error(t('errors.passkeyNotSupported'));
      return;
    }

    setLoading(true);

    try {
      // Step 1: Get registration options from server
      const apiBaseUrl = getApiBaseUrl();
      const optionsResponse = await fetch(`${apiBaseUrl}/api/auth/passkey/register-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include session cookies for authentication
        body: JSON.stringify({ email: data.email }),
      });

      const optionsResult = await optionsResponse.json();

      if (!optionsResponse.ok || !optionsResult.success) {
        toast.error(optionsResult.error || t('errors.generic'));
        return;
      }

      const options = optionsResult.options;

      // Convert base64url strings to ArrayBuffers
      const publicKeyOptions = {
        ...options,
        challenge: base64urlToArrayBuffer(options.challenge),
        user: {
          ...options.user,
          id: base64urlToArrayBuffer(options.user.id),
        },
        excludeCredentials: options.excludeCredentials?.map((cred: any) => ({
          ...cred,
          id: base64urlToArrayBuffer(cred.id),
        })) || [],
      };

      // Step 2: Create credential using WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        toast.error(t('errors.passkeyFailed'));
        return;
      }

      // Step 3: Prepare credential data for server
      const response = credential.response as AuthenticatorAttestationResponse;
      const credentialData = {
        id: credential.id,
        rawId: arrayBufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
          attestationObject: arrayBufferToBase64url(response.attestationObject),
        },
      };

      // Step 4: Send credential to server for verification
      const verifyResponse = await fetch(`${apiBaseUrl}/api/auth/passkey/register-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include session cookies for verification
        body: JSON.stringify({
          email: data.email,
          credential: credentialData,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (verifyResponse.ok && verifyResult.success) {
        toast.success(t('success.passkeyAdded'));
        onNext();
      } else {
        toast.error(verifyResult.error || t('errors.passkeyFailed'));
      }
    } catch (error: any) {
      console.error('Passkey registration error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error(t('errors.passkeyUserCancelled'));
      } else if (error.name === 'InvalidStateError') {
        toast.error(t('errors.passkeyAlreadyRegistered'));
      } else {
        toast.error(t('errors.passkeyFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for base64url conversion
  const base64urlToArrayBuffer = (base64url: string): ArrayBuffer => {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const arrayBufferToBase64url = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-purple-900 dark:text-purple-100 mb-1">
              {t('registration.passkeyOptional')}
            </p>
            <p className="text-purple-700 dark:text-purple-300 mb-2">
              {t('registration.passkeyBenefits')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-purple-700 dark:text-purple-300 ml-2">
              <li>{t('registration.passkeyBenefit1')}</li>
              <li>{t('registration.passkeyBenefit2')}</li>
              <li>{t('registration.passkeyBenefit3')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Supported Methods */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 theme-bg-primary rounded-lg border theme-border text-center">
          <div className="text-3xl mb-2">👤</div>
          <p className="text-sm font-medium theme-text-primary">Face ID</p>
          <p className="text-xs theme-text-secondary mt-1">iOS & macOS</p>
        </div>
        <div className="p-4 theme-bg-primary rounded-lg border theme-border text-center">
          <div className="text-3xl mb-2">👆</div>
          <p className="text-sm font-medium theme-text-primary">Touch ID</p>
          <p className="text-xs theme-text-secondary mt-1">iOS & macOS</p>
        </div>
        <div className="p-4 theme-bg-primary rounded-lg border theme-border text-center">
          <div className="text-3xl mb-2">🪟</div>
          <p className="text-sm font-medium theme-text-primary">Windows Hello</p>
          <p className="text-xs theme-text-secondary mt-1">Windows 10+</p>
        </div>
        <div className="p-4 theme-bg-primary rounded-lg border theme-border text-center">
          <div className="text-3xl mb-2">🔐</div>
          <p className="text-sm font-medium theme-text-primary">Security Keys</p>
          <p className="text-xs theme-text-secondary mt-1">YubiKey, etc.</p>
        </div>
      </div>

      {/* Device Support Status */}
      {!passkeySupported && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start space-x-3">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm">
              <p className="font-medium text-red-900 dark:text-red-100">
                {t('errors.passkeyNotSupported')}
              </p>
              <p className="text-red-700 dark:text-red-300 mt-1">
                {t('registration.passkeyRequirements')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col space-y-3 pt-4">
        <button
          type="button"
          onClick={handleAddPasskey}
          disabled={loading || !passkeySupported}
          className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400
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
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>{t('registration.addPasskey')}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onSkip}
          disabled={loading}
          className="w-full py-3 px-4 theme-bg-primary hover:theme-bg-tertiary theme-text-primary
            font-medium rounded-lg transition-colors border-2 theme-border disabled:opacity-50"
        >
          {t('registration.skipPasskey')}
        </button>
      </div>

      {/* Help Text */}
      <div className="text-center text-xs theme-text-secondary">
        <p>{t('registration.passkeyAddLater')}</p>
      </div>
    </div>
  );
};

export default Step6PasskeySetup;
