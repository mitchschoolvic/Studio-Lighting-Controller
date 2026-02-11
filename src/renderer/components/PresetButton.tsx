import React from 'react';

interface PresetButtonProps {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  onClick: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * PresetButton — Single preset trigger button with color, active state,
 * and touch-friendly edit/delete icons.
 */
export const PresetButton: React.FC<PresetButtonProps> = ({
  id,
  name,
  color,
  isActive,
  onClick,
  onEdit,
  onDelete,
}) => {
  return (
    <div className={`preset-button-wrapper ${isActive ? 'active' : ''}`}>
      <button
        className={`preset-button ${isActive ? 'active' : ''}`}
        style={{ backgroundColor: color }}
        onClick={() => onClick(id)}
        title={`Recall: ${name}`}
      >
        {name}
      </button>
      <div className="preset-button-actions">
        <button
          className="preset-action-btn"
          onClick={(e) => { e.stopPropagation(); onEdit(id); }}
          title="Edit preset"
        >
          ✎
        </button>
        <button
          className="preset-action-btn preset-action-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(id); }}
          title="Delete preset"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
