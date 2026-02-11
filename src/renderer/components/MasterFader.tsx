import React, { useCallback } from 'react';

interface MasterFaderProps {
  value: number;
  onChange: (value: number) => void;
}

export const MasterFader: React.FC<MasterFaderProps> = ({ value, onChange }) => {
  const percentage = Math.round((value / 255) * 100);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseInt(e.target.value, 10));
    },
    [onChange]
  );

  return (
    <div className="master-fader">
      <label>Master</label>
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
      <div className="fader-value">{percentage}%</div>
    </div>
  );
};
