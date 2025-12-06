// Helper functions to manage anonymous mode state in localStorage

const STORAGE_KEY_PREFIX = 'anonymous_mode_';
const LAST_NAME_KEY_PREFIX = 'anonymous_name_';

/**
 * Get anonymous mode state for a topic from localStorage
 */
export const getAnonymousModeState = (topicId: string): { isAnonymous: boolean; name: string } => {
  if (typeof window === 'undefined' || !topicId) {
    return { isAnonymous: false, name: '' };
  }

  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${topicId}`);
    const storedName = localStorage.getItem(`${LAST_NAME_KEY_PREFIX}${topicId}`);
    
    if (stored === 'true') {
      return {
        isAnonymous: true,
        name: storedName || ''
      };
    }
  } catch (error) {
    console.error('Failed to read anonymous mode from localStorage:', error);
  }

  return { isAnonymous: false, name: '' };
};

/**
 * Save anonymous mode state for a topic to localStorage
 */
export const saveAnonymousModeState = (topicId: string, isAnonymous: boolean, name?: string): void => {
  if (typeof window === 'undefined' || !topicId) {
    return;
  }

  try {
    if (isAnonymous) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${topicId}`, 'true');
      if (name) {
        localStorage.setItem(`${LAST_NAME_KEY_PREFIX}${topicId}`, name);
      }
    } else {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${topicId}`);
      // Keep the last name even when disabled, so user can reuse it when re-enabling
      // The name is preserved in localStorage for autofill
    }
  } catch (error) {
    console.error('Failed to save anonymous mode to localStorage:', error);
  }
};

/**
 * Get last used anonymous name for a topic
 */
export const getLastAnonymousName = (topicId: string): string => {
  if (typeof window === 'undefined' || !topicId) {
    return '';
  }

  try {
    return localStorage.getItem(`${LAST_NAME_KEY_PREFIX}${topicId}`) || '';
  } catch (error) {
    console.error('Failed to read last anonymous name from localStorage:', error);
    return '';
  }
};

/**
 * Save last used anonymous name for a topic
 */
export const saveLastAnonymousName = (topicId: string, name: string): void => {
  if (typeof window === 'undefined' || !topicId || !name) {
    return;
  }

  try {
    localStorage.setItem(`${LAST_NAME_KEY_PREFIX}${topicId}`, name);
  } catch (error) {
    console.error('Failed to save last anonymous name to localStorage:', error);
  }
};

