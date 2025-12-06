import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import toast from 'react-hot-toast';
import { getAnonymousModeState, saveAnonymousModeState, getLastAnonymousName, saveLastAnonymousName } from '@/utils/anonymousStorage';

interface AnonymousModeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string;
  topicTitle: string;
  currentAnonymousName?: string;
  isAnonymous?: boolean;
  onUpdate: (isAnonymous: boolean, anonymousName?: string) => void;
}

// Random name word lists
const ADJECTIVES = [
  'Swift', 'Silent', 'Brave', 'Clever', 'Wise', 'Bold', 'Quick', 'Bright',
  'Noble', 'Fierce', 'Calm', 'Gentle', 'Sharp', 'Dark', 'Light', 'Ancient',
  'Modern', 'Wild', 'Tame', 'Lucky', 'Happy', 'Mysterious', 'Curious', 'Elegant'
];

const NOUNS = [
  'Fox', 'Wolf', 'Eagle', 'Tiger', 'Dragon', 'Phoenix', 'Raven', 'Hawk',
  'Lion', 'Bear', 'Owl', 'Falcon', 'Panther', 'Lynx', 'Cobra', 'Shark',
  'Dolphin', 'Whale', 'Panda', 'Koala', 'Rabbit', 'Deer', 'Turtle', 'Penguin'
];

const AnonymousModeDialog: React.FC<AnonymousModeDialogProps> = ({
  isOpen,
  onClose,
  topicId,
  topicTitle,
  currentAnonymousName,
  isAnonymous: initialIsAnonymous = false,
  onUpdate,
}) => {
  const { t } = useLanguage();
  const [isAnonymous, setIsAnonymous] = useState(initialIsAnonymous);
  const [anonymousName, setAnonymousName] = useState(currentAnonymousName || '');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load anonymous identity from database and localStorage when dialog opens
  useEffect(() => {
    if (!isOpen || !topicId) return;

    const loadAnonymousIdentity = async () => {
      setLoading(true);
      try {
        // First, check localStorage for saved state
        const savedState = getAnonymousModeState(topicId);
        const lastName = getLastAnonymousName(topicId);

        // Try to load from API to get the actual identity from database
        try {
          const response = await api.get(API_ENDPOINTS.TOPICS.ANONYMOUS_IDENTITY(topicId));
          if (response.data.success && response.data.data?.anonymous_name) {
            const apiName = response.data.data.anonymous_name;
            // Use API name if available, otherwise use saved state or last name
            setAnonymousName(apiName);
            setIsAnonymous(savedState.isAnonymous || initialIsAnonymous);
            // Save to localStorage
            saveAnonymousModeState(topicId, savedState.isAnonymous || initialIsAnonymous, apiName);
            saveLastAnonymousName(topicId, apiName);
          } else {
            // No identity in database, but check if there's a previous name in localStorage
            if (lastName) {
              setAnonymousName(lastName);
            } else if (currentAnonymousName) {
              setAnonymousName(currentAnonymousName);
            }
            setIsAnonymous(savedState.isAnonymous || initialIsAnonymous);
          }
        } catch (error: any) {
          // If API call fails (e.g., 404 - no identity exists), use localStorage or props
          if (error.response?.status === 404) {
            // No identity exists in database, but check localStorage for previous name
            if (lastName) {
              setAnonymousName(lastName);
            } else if (currentAnonymousName) {
              setAnonymousName(currentAnonymousName);
            }
            setIsAnonymous(savedState.isAnonymous || initialIsAnonymous);
          } else {
            // Other error - use saved state or props
            if (savedState.isAnonymous && savedState.name) {
              setAnonymousName(savedState.name);
              setIsAnonymous(true);
            } else if (lastName) {
              setAnonymousName(lastName);
              setIsAnonymous(initialIsAnonymous);
            } else {
              setAnonymousName(currentAnonymousName || '');
              setIsAnonymous(initialIsAnonymous);
            }
          }
        }
      } catch (error: any) {
        console.error('Failed to load anonymous identity:', error);
        // Fallback to props
        setAnonymousName(currentAnonymousName || '');
        setIsAnonymous(initialIsAnonymous);
      } finally {
        setLoading(false);
      }
    };

    loadAnonymousIdentity();
  }, [isOpen, topicId, initialIsAnonymous, currentAnonymousName]);

  const generateRandomName = () => {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const randomName = `${adjective}${noun}${Math.floor(Math.random() * 999)}`;
    setAnonymousName(randomName);
  };

  const handleSave = async () => {
    if (isAnonymous && !anonymousName.trim()) {
      toast.error(t('topics.anonymousNameRequired') || 'Por favor, insira um nome anónimo');
      return;
    }

    setSaving(true);

    try {
      if (!topicId) {
        toast.error(t('errors.generic') || 'Topic ID is required');
        setSaving(false);
        return;
      }

      if (isAnonymous) {
        // Create or update anonymous identity immediately
        const response = await api.put(API_ENDPOINTS.TOPICS.ANONYMOUS_IDENTITY(topicId), {
          new_name: anonymousName.trim(),
          custom_anonymous_name: anonymousName.trim(),
        });

        if (response.data.success) {
          const finalName = response.data.data?.anonymous_name || anonymousName.trim();
          // Save to localStorage
          saveAnonymousModeState(topicId, true, finalName);
          saveLastAnonymousName(topicId, finalName);
          toast.success(t('topics.anonymousModeEnabled') || 'Modo anónimo ativado');
          onUpdate(true, finalName);
        } else {
          toast.error(response.data.errors?.[0] || t('errors.generic'));
        }
      } else {
        // Delete anonymous identity from database
        try {
          await api.delete(API_ENDPOINTS.USERS.DELETE_ANONYMOUS_IDENTITY(topicId));
          // Remove from localStorage (but keep the last name for future use)
          saveAnonymousModeState(topicId, false);
          toast.success(t('topics.anonymousModeDisabled') || 'Modo anónimo desativado');
          onUpdate(false);
        } catch (error: any) {
          // If identity doesn't exist, it's fine - just update localStorage
          saveAnonymousModeState(topicId, false);
          console.log('No anonymous identity to delete');
          onUpdate(false);
        }
      }

      onClose();
    } catch (error: any) {
      console.error('Failed to update anonymous mode:', error);
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold theme-text-primary">
            {t('topics.anonymousMode') || 'Modo Anónimo'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
          >
            <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm theme-text-secondary mb-4">
            {t('topics.anonymousModeDescription') || 'Configure o modo anónimo para este tópico. Quando ativado, todas as suas ações serão exibidas com o nome anónimo escolhido.'}
          </p>
          <p className="text-sm font-medium theme-text-primary mb-2">
            {t('topics.topic') || 'Tópico'}: <span className="font-normal">{topicTitle}</span>
          </p>
        </div>

        {/* Toggle Anonymous Mode */}
        <div className="mb-6">
          <label className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg cursor-pointer">
            <span className="text-sm font-medium theme-text-primary">
              {t('topics.enableAnonymousMode') || 'Ativar Modo Anónimo'}
            </span>
            <div className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="sr-only"
                role="switch"
                aria-checked={isAnonymous}
              />
              <span
                className={`absolute inset-0 rounded-full transition-colors duration-200 ease-in-out ${isAnonymous ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
              />
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out z-10 ${isAnonymous ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </div>
          </label>
        </div>

        {/* Anonymous Name Input - Show even when disabled if there's a previous name */}
        {(isAnonymous || anonymousName) && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">
                {t('topics.anonymousName') || 'Nome Anónimo'}
              </label>
              <input
                type="text"
                value={anonymousName}
                onChange={(e) => setAnonymousName(e.target.value)}
                placeholder={t('topics.enterAnonymousName') || 'Digite seu nome anónimo'}
                className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={50}
                disabled={loading}
              />
              {!isAnonymous && anonymousName && (
                <p className="text-xs theme-text-muted mt-1">
                  {t('topics.previousAnonymousName') || 'Nome anónimo anterior - ative o modo anónimo para usar'}
                </p>
              )}
            </div>

            {isAnonymous && (
              <button
                onClick={generateRandomName}
                className="w-full px-4 py-2 btn btn-secondary flex items-center justify-center gap-2"
                disabled={loading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('topics.generateRandomName') || 'Gerar Nome Aleatório'}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 btn btn-secondary"
            disabled={saving}
          >
            {t('common.cancel') || 'Cancelar'}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('common.saving') || 'A guardar...'}
              </div>
            ) : (
              t('common.save') || 'Guardar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnonymousModeDialog;
