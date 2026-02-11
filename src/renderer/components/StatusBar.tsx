import React from 'react';
import type { DMXStatus } from '../types';

interface StatusBarProps {
  dmxStatus: DMXStatus;
  isSocketConnected: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({ dmxStatus, isSocketConnected }) => {
  return (
    <div className="status-bar">
      <div className="status-item">
        <span className={`status-dot ${dmxStatus.connected ? 'connected' : 'disconnected'}`} />
        <span>DMX: {dmxStatus.connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      {dmxStatus.port && (
        <div className="status-item">
          <span>{dmxStatus.port}</span>
        </div>
      )}
      <div className="status-item">
        <span className={`status-dot ${isSocketConnected ? 'connected' : 'disconnected'}`} />
        <span>UI: {isSocketConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </div>
  );
};
