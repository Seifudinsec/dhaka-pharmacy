import React, { useEffect, useState } from 'react';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import AppIcon from './AppIcon';

const isStandaloneMode = () => (
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
  window.navigator.standalone === true
);

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => (
    typeof window !== 'undefined' ? isStandaloneMode() : false
  ));

  useEffect(() => {
    const mediaQuery = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setIsInstalled(isStandaloneMode());
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    const handleDisplayModeChange = () => {
      setIsInstalled(isStandaloneMode());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      return;
    }

    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  if (isInstalled || !installPrompt) {
    return null;
  }

  return (
    <div className="install-app-btn-wrap">
      <button
        className="install-app-btn"
        onClick={handleInstall}
        aria-label="Install Dhaka Pharmacy app"
        title="Install Dhaka Pharmacy"
        type="button"
      >
        <AppIcon icon={faDownload} />
      </button>
      <span className="install-app-btn-tooltip" aria-hidden="true">
        Download app
      </span>
    </div>
  );
}
