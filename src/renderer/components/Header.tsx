import React, { useEffect, useState } from 'react';
import { StatusBar } from './StatusBar';
import type { DMXStatus } from '../types';

export type ViewMode = 'canvas' | 'fixtures';

interface HeaderProps {
  dmxStatus: DMXStatus;
  isSocketConnected: boolean;
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export const Header: React.FC<HeaderProps> = ({ dmxStatus, isSocketConnected, activeView, onViewChange }) => {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        if (window.electronAPI?.getAppVersion) {
          const appVersion = await window.electronAPI.getAppVersion();
          setVersion(appVersion);
        }
      } catch (err) {
        console.error('Failed to fetch app version:', err);
      }
    };
    fetchVersion();
  }, []);

  return (
    <header className="app-header">
      <div className="header-left">
        <h1>DMX Controller</h1>
        {version && <span className="version-badge">v{version}</span>}
        <div className="view-tabs">
          <button
            className={`view-tab ${activeView === 'canvas' ? 'active' : ''}`}
            onClick={() => onViewChange('canvas')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <circle cx="15.5" cy="8.5" r="1.5" />
              <circle cx="12" cy="15.5" r="1.5" />
            </svg>
            Canvas
          </button>
          <button
            className={`view-tab ${activeView === 'fixtures' ? 'active' : ''}`}
            onClick={() => onViewChange('fixtures')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Fixtures &amp; Channels
          </button>
        </div>
      </div>
      <div className="status-area">
        <StatusBar dmxStatus={dmxStatus} isSocketConnected={isSocketConnected} />
      </div>
    </header>
  );
};
