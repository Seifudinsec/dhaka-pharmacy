import React, { useEffect, useState } from 'react';
import { faDownload, faXmark } from '@fortawesome/free-solid-svg-icons';
import AppIcon from './AppIcon';

const isStandaloneMode = () => (
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
  window.navigator.standalone === true
);

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isMobileDevice = () => /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent);
const isSafariBrowser = () => (
  /safari/i.test(window.navigator.userAgent) &&
  !/chrome|chromium|crios|fxios|edgios|opr|opera|samsungbrowser/i.test(window.navigator.userAgent)
);

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => (
    typeof window !== 'undefined' ? isStandaloneMode() : false
  ));
  const [manualInstallMode, setManualInstallMode] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
    const iosDevice = isIosDevice();
    const safariBrowser = isSafariBrowser();
    let promptCaptured = false;

    setIsIos(iosDevice);
    setIsSafari(safariBrowser);

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      promptCaptured = true;
      setInstallPrompt(event);
      setManualInstallMode(null);
      setIsInstalled(isStandaloneMode());
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setManualInstallMode(null);
      setShowInstructions(false);
      setIsInstalled(true);
    };

    const handleDisplayModeChange = () => {
      const standalone = isStandaloneMode();
      setIsInstalled(standalone);
      if (standalone) {
        setManualInstallMode(null);
        setShowInstructions(false);
      }
    };

    const fallbackTimer = window.setTimeout(() => {
      if (!promptCaptured && !isStandaloneMode() && isMobileDevice()) {
        setManualInstallMode(iosDevice ? 'ios' : 'generic');
      }
    }, 1500);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      if (manualInstallMode) {
        setShowInstructions(true);
      }
      return;
    }

    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  if (isInstalled || (!installPrompt && !manualInstallMode)) {
    return null;
  }

  return (
    <>
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

      {showInstructions && (
        <div className="modal-overlay" onClick={() => setShowInstructions(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Install Dhaka Pharmacy</h3>
              <button className="modal-close" onClick={() => setShowInstructions(false)} type="button">
                <AppIcon icon={faXmark} />
              </button>
            </div>
            <div className="modal-body">
              {manualInstallMode === 'ios' ? (
                <div className="install-help-stack">
                  <p className="install-help-copy">
                    Add Dhaka Pharmacy to your home screen from the iPhone or iPad browser menu.
                  </p>
                  {!isSafari && (
                    <p className="install-help-note">
                      For the best iPhone install flow, open this page in Safari first.
                    </p>
                  )}
                  <ol className="install-help-steps">
                    <li>Open the browser share menu.</li>
                    <li>Select <strong>Add to Home Screen</strong>.</li>
                    <li>Tap <strong>Add</strong> to finish installing the app.</li>
                  </ol>
                </div>
              ) : (
                <div className="install-help-stack">
                  <p className="install-help-copy">
                    If your phone does not show the native install prompt, you can still install the app from the browser menu.
                  </p>
                  <ol className="install-help-steps">
                    <li>Open the browser menu.</li>
                    <li>Select <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li>
                    <li>Confirm the install when prompted.</li>
                  </ol>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowInstructions(false)} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
