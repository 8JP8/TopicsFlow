import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallPrompt: React.FC = () => {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches || 
          (window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return true;
      }
      return false;
    };

    if (checkInstalled()) {
      return;
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if user has already dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
    
    // Only show if not dismissed or dismissed more than 7 days ago
    const shouldShow = !dismissed || daysSinceDismissed > 7;

    // Listen for beforeinstallprompt event (browser-native install prompt)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event fired - PWA is installable');
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
      
      // Only show our custom prompt if user hasn't dismissed it recently
      if (shouldShow) {
        // Wait a bit before showing prompt (better UX)
        setTimeout(() => {
          if (!checkInstalled()) {
            setShowPrompt(true);
          }
        }, 5000); // Show after 5 seconds
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For browsers that don't support beforeinstallprompt (like Safari iOS)
    // Check if we should show manual instructions
    if (!('onbeforeinstallprompt' in window) && shouldShow) {
      // Check if it's iOS
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // Show prompt after delay for iOS users
        setTimeout(() => {
          if (!checkInstalled()) {
            setIsInstallable(true);
            setShowPrompt(true);
          }
        }, 10000);
      }
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback: show instructions for browsers that don't support beforeinstallprompt
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        alert(t('pwa.iosInstallInstructions') || 'To install: Tap the share button and select "Add to Home Screen"');
      } else if (/Android/.test(navigator.userAgent)) {
        alert(t('pwa.androidInstallInstructions') || 'To install: Tap the menu (⋮) and select "Install app" or "Add to Home screen"');
      } else {
        alert(t('pwa.installInstructions') || 'To install: Click the install button (⊕) in your browser\'s address bar');
      }
      handleDismiss();
      return;
    }

    try {
      console.log('Showing native install prompt...');
      // Show the native browser install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user to respond
      const { outcome } = await deferredPrompt.userChoice;
      console.log('User choice:', outcome);
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setIsInstalled(true);
        setShowPrompt(false);
        // Don't clear deferredPrompt yet - wait for appinstalled event
      } else {
        console.log('User dismissed the install prompt');
        // User dismissed, remember for 7 days
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        setShowPrompt(false);
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
      // Fallback to instructions
      alert(t('pwa.installInstructions') || 'To install: Click the install button in your browser\'s address bar');
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
    // Keep deferredPrompt in case user wants to install later
  };

  // Don't show if already installed or prompt not shown
  if (isInstalled || !showPrompt) {
    return null;
  }

  // Don't show if we don't have a deferred prompt and it's not iOS
  if (!deferredPrompt && !/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
      <div className={`theme-bg-secondary theme-border rounded-lg shadow-2xl p-4 border-2`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <img src="https://i.postimg.cc/FY5shL9w/chat.png" alt="Logo" className="w-6 h-6" />
              <h3 className="theme-text-primary font-bold text-sm">
                {t('pwa.installTitle') || 'Install TopicsFlow'}
              </h3>
            </div>
            <p className="theme-text-secondary text-xs mb-3">
              {t('pwa.installDescription') || 'Install our app for a better experience with offline support and faster loading.'}
            </p>
            <div className="flex space-x-2">
              <button
                onClick={handleInstallClick}
                className="px-4 py-2 theme-blue-primary text-white rounded-lg font-semibold text-xs hover:opacity-90 transition-opacity shadow-lg"
              >
                {t('pwa.install') || 'Install'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 theme-bg-tertiary theme-text-primary rounded-lg font-semibold text-xs hover:theme-bg-primary transition-colors"
              >
                {t('common.cancel') || 'Not now'}
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="ml-2 theme-text-secondary hover:theme-text-primary transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;

