import React, { useState, useMemo, useCallback } from 'react';
import { ChannelFader } from './ChannelFader';

const FADERS_PER_PAGE = 12;

interface FaderBankProps {
  channels: number[];
  channelMap: Map<number, { fixtureName: string; channelName: string }>;
  onChannelChange: (channel: number, value: number) => void;
}

export const FaderBank: React.FC<FaderBankProps> = ({
  channels,
  channelMap,
  onChannelChange,
}) => {
  const [page, setPage] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const totalPages = Math.ceil(512 / FADERS_PER_PAGE);
  const startChannel = page * FADERS_PER_PAGE + 1;
  const endChannel = Math.min(startChannel + FADERS_PER_PAGE - 1, 512);

  const faders = useMemo(() => {
    const result: { channel: number; value: number; label?: string }[] = [];
    for (let ch = startChannel; ch <= endChannel; ch++) {
      const mapping = channelMap.get(ch);
      result.push({
        channel: ch,
        value: channels[ch - 1] || 0,
        label: mapping ? `${mapping.fixtureName} / ${mapping.channelName}` : undefined,
      });
    }
    return result;
  }, [channels, startChannel, endChannel, channelMap]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(0, p - 1));
  }, []);

  const nextPage = useCallback(() => {
    setPage((p) => Math.min(totalPages - 1, p + 1));
  }, [totalPages]);

  return (
    <div className="fader-bank">
      <button
        className="collapsible-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span className={`collapsible-arrow ${!isCollapsed ? 'open' : ''}`}>&#9654;</span>
        Raw Channels ({startChannel}–{endChannel})
      </button>

      {!isCollapsed && (
        <>
          <div className="fader-bank-header">
            <h3>
              Channels {startChannel}–{endChannel}
            </h3>
            <div className="fader-bank-controls">
              <button className="btn-icon" onClick={prevPage} disabled={page === 0}>
                ◀
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Page {page + 1}/{totalPages}
              </span>
              <button
                className="btn-icon"
                onClick={nextPage}
                disabled={page >= totalPages - 1}
              >
                ▶
              </button>
            </div>
          </div>
          <div className="fader-bank-grid">
            {faders.map((f) => (
              <ChannelFader
                key={f.channel}
                channel={f.channel}
                value={f.value}
                label={f.label}
                onChange={onChannelChange}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
