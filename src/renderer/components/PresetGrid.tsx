import React, { useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { PresetButton } from './PresetButton';
import type { Preset } from '../types';

interface PresetGridProps {
  socket: Socket | null;
}

const PRESET_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#ff5722', '#795548', '#607d8b', '#00bcd4',
];

/**
 * PresetGrid — Scrollable grid of preset trigger buttons.
 */
export const PresetGrid: React.FC<PresetGridProps> = ({ socket }) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetFadeTime, setNewPresetFadeTime] = useState(1000);
  const [newPresetColor, setNewPresetColor] = useState(PRESET_COLORS[0]);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);

  const [editName, setEditName] = useState('');
  const [editFadeTime, setEditFadeTime] = useState(1000);
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState<Preset | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handlePresetsList = (data: Preset[]) => {
      setPresets(data);
    };

    const handlePresetActivated = (data: { id: string }) => {
      setActivePresetId(data.id);
    };

    socket.on('presets:list', handlePresetsList);
    socket.on('preset:activated', handlePresetActivated);

    return () => {
      socket.off('presets:list', handlePresetsList);
      socket.off('preset:activated', handlePresetActivated);
    };
  }, [socket]);

  const recallPreset = useCallback(
    (id: string) => {
      socket?.emit('preset:recall', { id });
    },
    [socket]
  );

  const savePreset = useCallback(() => {
    if (!newPresetName.trim()) return;
    socket?.emit('preset:save', {
      name: newPresetName.trim(),
      fadeTime: newPresetFadeTime,
      color: newPresetColor,
    });
    setShowSaveDialog(false);
    setNewPresetName('');
    setNewPresetFadeTime(1000);
    setNewPresetColor(PRESET_COLORS[0]);
  }, [socket, newPresetName, newPresetFadeTime, newPresetColor]);

  const deletePreset = useCallback(
    (id: string) => {
      socket?.emit('preset:delete', { id });
      setConfirmDelete(null);
      setEditingPreset(null);
    },
    [socket]
  );

  const handleEdit = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (preset) {
        setEditingPreset(preset);
        setEditName(preset.name);
        setEditFadeTime(preset.fadeTime);
        setEditColor(preset.color);
      }
    },
    [presets]
  );

  const handleDeleteRequest = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (preset) {
        setConfirmDelete(preset);
      }
    },
    [presets]
  );

  const updatePreset = useCallback(() => {
    if (!editingPreset || !editName.trim()) return;
    socket?.emit('preset:update', {
      id: editingPreset.id,
      patch: {
        name: editName.trim(),
        fadeTime: editFadeTime,
        color: editColor,
      },
    });
    setEditingPreset(null);
  }, [socket, editingPreset, editName, editFadeTime, editColor]);

  return (
    <div className="preset-grid">
      <div className="preset-grid-header">
        <h3>Presets</h3>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowSaveDialog(true)}>
          + Save Current
        </button>
      </div>

      <div className="preset-grid-items">
        {presets.map((preset) => (
          <PresetButton
            key={preset.id}
            id={preset.id}
            name={preset.name}
            color={preset.color}
            isActive={preset.id === activePresetId}
            onClick={recallPreset}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
          />
        ))}
        <button
          className="preset-button add-preset"
          onClick={() => setShowSaveDialog(true)}
        >
          +
        </button>
      </div>

      {/* Save Preset Dialog */}
      {showSaveDialog && (
        <div className="modal-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Save Preset</h2>
              <button className="modal-close" onClick={() => setShowSaveDialog(false)}>
                ×
              </button>
            </div>

            <div className="form-group">
              <label>Preset Name</label>
              <input
                type="text"
                className="form-input"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="e.g., Warm Wash"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Fade Time (ms)</label>
              <input
                type="number"
                className="form-input"
                value={newPresetFadeTime}
                onChange={(e) => setNewPresetFadeTime(parseInt(e.target.value, 10) || 0)}
                min={0}
                step={100}
              />
            </div>

            <div className="form-group">
              <label>Button Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      backgroundColor: color,
                      border: color === newPresetColor ? '2px solid white' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => setNewPresetColor(color)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={savePreset}
                disabled={!newPresetName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Preset Dialog */}
      {editingPreset && (
        <div className="modal-overlay" onClick={() => setEditingPreset(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Preset</h2>
              <button className="modal-close" onClick={() => setEditingPreset(null)}>
                ×
              </button>
            </div>

            <div className="form-group">
              <label>Preset Name</label>
              <input
                type="text"
                className="form-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g., Warm Wash"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Fade Time (ms)</label>
              <input
                type="number"
                className="form-input"
                value={editFadeTime}
                onChange={(e) => setEditFadeTime(parseInt(e.target.value, 10) || 0)}
                min={0}
                step={100}
              />
            </div>

            <div className="form-group">
              <label>Button Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      backgroundColor: color,
                      border: color === editColor ? '2px solid white' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => setEditColor(color)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setEditingPreset(null);
                  setConfirmDelete(editingPreset);
                }}
              >
                Delete
              </button>
              <button className="btn btn-secondary" onClick={() => setEditingPreset(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={updatePreset}
                disabled={!editName.trim()}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Preset</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}>×</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
              Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deletePreset(confirmDelete.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
