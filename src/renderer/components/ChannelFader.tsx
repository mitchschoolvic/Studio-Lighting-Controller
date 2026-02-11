import React, { useCallback } from 'react';

interface ChannelFaderProps {
  channel: number;
  value: number;
  label?: string;
  onChange: (channel: number, value: number) => void;
}

export const ChannelFader: React.FC<ChannelFaderProps> = ({
  channel,
  value,
  label,
  onChange,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(channel, parseInt(e.target.value, 10));
    },
    [channel, onChange]
  );

  return (
    <div className="channel-fader">
      <span className="channel-number">CH {channel}</span>
      <input
        type="range"
        className="vertical-fader"
        min={0}
        max={255}
        value={value}
        onChange={handleChange}
        // @ts-expect-error — orient is a non-standard attribute for vertical sliders
        orient="vertical"
      />
      <span className="channel-value">{value}</span>
      {label && <span className="channel-label" title={label}>{label}</span>}
    </div>
  );
};
