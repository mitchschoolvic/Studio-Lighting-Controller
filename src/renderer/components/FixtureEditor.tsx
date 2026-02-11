import React, { useState, useCallback } from 'react';
import type { Fixture, FixtureChannel, ColorMode, FixtureProfile } from '../types';

interface BundledProfile {
  id: string;
  profile: FixtureProfile;
}

interface FixtureEditorProps {
  fixture?: Fixture; // If provided, editing; otherwise creating
  bundledProfiles?: BundledProfile[];
  onSave: (name: string, type: string, channels: FixtureChannel[], colorMode: ColorMode) => void;
  onSaveFromProfile?: (name: string, profileId: string, startAddress: number) => void;
  onUpdate?: (id: string, patch: Partial<Fixture>) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

type EditorMode = 'basic' | 'profile';

const FIXTURE_TYPES = ['RGB Fixture', 'HSB Fixture', 'RGBW Fixture', 'Dimmer', 'Moving Head', 'Custom'];

const DEFAULT_RGB_CHANNELS: FixtureChannel[] = [
  { name: 'red', dmxChannel: 1 },
  { name: 'green', dmxChannel: 2 },
  { name: 'blue', dmxChannel: 3 },
];

const DEFAULT_HSB_CHANNELS: FixtureChannel[] = [
  { name: 'hue', dmxChannel: 1 },
  { name: 'saturation', dmxChannel: 2 },
  { name: 'brightness', dmxChannel: 3 },
];

/**
 * FixtureEditor — Modal dialog for creating/editing fixture profiles.
 * Supports both basic (manual channel) and profile-based (bundled JSON) creation.
 */
export const FixtureEditor: React.FC<FixtureEditorProps> = ({
  fixture,
  bundledProfiles = [],
  onSave,
  onSaveFromProfile,
  onUpdate,
  onDelete,
  onClose,
}) => {
  // Determine initial editor mode: if editing a profile fixture, use profile mode
  const isEditingProfile = !!(fixture?.profile);
  const initialMode: EditorMode = isEditingProfile ? 'profile' : 'basic';

  const [editorMode, setEditorMode] = useState<EditorMode>(initialMode);
  const [name, setName] = useState(fixture?.name || '');
  const [type, setType] = useState(fixture?.type || 'RGB Fixture');
  const [colorMode, setColorMode] = useState<ColorMode>(fixture?.colorMode || 'rgb');
  const [channels, setChannels] = useState<FixtureChannel[]>(
    fixture?.channels || DEFAULT_RGB_CHANNELS.map((ch) => ({ ...ch }))
  );

  // Profile mode state
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    bundledProfiles.length > 0 ? bundledProfiles[0].id : ''
  );
  const [startAddress, setStartAddress] = useState<number>(fixture?.startAddress || 1);

  const selectedProfile = bundledProfiles.find((p) => p.id === selectedProfileId)?.profile;

  const addChannel = useCallback(() => {
    const maxCh = channels.reduce((max, ch) => Math.max(max, ch.dmxChannel), 0);
    setChannels([...channels, { name: '', dmxChannel: maxCh + 1 }]);
  }, [channels]);

  const removeChannel = useCallback(
    (index: number) => {
      setChannels(channels.filter((_, i) => i !== index));
    },
    [channels]
  );

  const updateChannel = useCallback(
    (index: number, field: 'name' | 'dmxChannel', value: string | number) => {
      const updated = [...channels];
      if (field === 'name') {
        updated[index] = { ...updated[index], name: value as string };
      } else {
        updated[index] = { ...updated[index], dmxChannel: value as number };
      }
      setChannels(updated);
    },
    [channels]
  );

  const handleColorModeChange = useCallback(
    (newMode: ColorMode) => {
      setColorMode(newMode);
      if (!fixture) {
        const baseCh = channels.length > 0 ? channels[0].dmxChannel : 1;
        if (newMode === 'hsb') {
          setChannels(DEFAULT_HSB_CHANNELS.map((ch, i) => ({ ...ch, dmxChannel: baseCh + i })));
          setType('HSB Fixture');
        } else {
          setChannels(DEFAULT_RGB_CHANNELS.map((ch, i) => ({ ...ch, dmxChannel: baseCh + i })));
          setType('RGB Fixture');
        }
      }
    },
    [fixture, channels]
  );

  const handleSave = useCallback(() => {
    if (!name.trim()) return;

    if (editorMode === 'profile' && !fixture) {
      // Creating a new profile fixture
      if (!selectedProfileId || !onSaveFromProfile) return;
      onSaveFromProfile(name, selectedProfileId, startAddress);
      onClose();
      return;
    }

    if (editorMode === 'basic') {
      if (channels.length === 0) return;
      if (fixture && onUpdate) {
        onUpdate(fixture.id, { name, type, channels, colorMode });
      } else {
        onSave(name, type, channels, colorMode);
      }
    }

    onClose();
  }, [name, type, channels, colorMode, fixture, editorMode, selectedProfileId, startAddress, onSave, onSaveFromProfile, onUpdate, onClose]);

  const handleDelete = useCallback(() => {
    if (fixture && onDelete) {
      onDelete(fixture.id);
      onClose();
    }
  }, [fixture, onDelete, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{fixture ? 'Edit Fixture' : 'New Fixture'}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Editor Mode Toggle (only when creating, not editing) */}
        {!fixture && bundledProfiles.length > 0 && (
          <div className="form-group">
            <label>Creation Method</label>
            <div className="editor-mode-selector">
              <button
                className={`btn btn-sm ${editorMode === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEditorMode('profile')}
                type="button"
              >
                From Profile
              </button>
              <button
                className={`btn btn-sm ${editorMode === 'basic' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEditorMode('basic')}
                type="button"
              >
                Basic / Manual
              </button>
            </div>
          </div>
        )}

        {/* Fixture Name */}
        <div className="form-group">
          <label>Fixture Name</label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Key Light"
          />
        </div>

        {/* ── Profile Mode ── */}
        {editorMode === 'profile' && !fixture && (
          <>
            <div className="form-group">
              <label>Fixture Profile</label>
              <select
                className="form-select"
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
              >
                {bundledProfiles.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.profile.fixture}
                  </option>
                ))}
              </select>
            </div>

            {selectedProfile && (
              <>
                <div className="form-group">
                  <label>Starting DMX Address</label>
                  <input
                    type="number"
                    className="form-input"
                    value={startAddress}
                    onChange={(e) => setStartAddress(Math.max(1, Math.min(512, parseInt(e.target.value, 10) || 1)))}
                    min={1}
                    max={512 - selectedProfile.channelCount + 1}
                  />
                  <small style={{ color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                    Uses {selectedProfile.channelCount} channels (DMX {startAddress}–{startAddress + selectedProfile.channelCount - 1})
                  </small>
                </div>

                {/* Channel Preview */}
                <div className="form-group">
                  <label>Channel Assignment Preview</label>
                  <div className="profile-channel-preview">
                    {Object.entries(selectedProfile.channels)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, def], index) => (
                        <div key={key} className="profile-preview-row">
                          <span className="profile-preview-addr">DMX {startAddress + index}</span>
                          <span className="profile-preview-label">{def.label}</span>
                          <span className="profile-preview-role">{def.role}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Modes Preview */}
                <div className="form-group">
                  <label>Available Modes ({selectedProfile.modes.length})</label>
                  <div className="profile-modes-preview">
                    {selectedProfile.modes.map((mode) => (
                      <span key={mode.name} className="profile-mode-tag">
                        {mode.name}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Basic Mode ── */}
        {(editorMode === 'basic' || fixture) && !(fixture?.profile) && (
          <>
            <div className="form-group">
              <label>Fixture Type</label>
              <select
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {FIXTURE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Color Mode</label>
              <div className="color-mode-selector">
                <button
                  className={`btn btn-sm ${colorMode === 'rgb' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleColorModeChange('rgb')}
                  type="button"
                >
                  RGB
                </button>
                <button
                  className={`btn btn-sm ${colorMode === 'hsb' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleColorModeChange('hsb')}
                  type="button"
                >
                  HSB
                </button>
              </div>
              <small style={{ color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                {colorMode === 'rgb'
                  ? 'Fixture receives Red, Green, Blue DMX values'
                  : 'Fixture receives Hue, Saturation, Brightness DMX values'}
              </small>
            </div>

            <div className="form-group">
              <label>Channels</label>
              {channels.map((ch, index) => (
                <div key={index} className="channel-row">
                  <input
                    type="text"
                    className="form-input"
                    value={ch.name}
                    onChange={(e) => updateChannel(index, 'name', e.target.value)}
                    placeholder="Channel name (e.g., red, brightness)"
                  />
                  <input
                    type="number"
                    className="form-input channel-number-input"
                    value={ch.dmxChannel}
                    onChange={(e) =>
                      updateChannel(index, 'dmxChannel', parseInt(e.target.value, 10) || 1)
                    }
                    min={1}
                    max={512}
                    placeholder="DMX #"
                  />
                  <button
                    className="btn-icon"
                    onClick={() => removeChannel(index)}
                    title="Remove channel"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={addChannel}>
                + Add Channel
              </button>
            </div>
          </>
        )}

        {/* Profile fixture in edit mode — read-only info */}
        {fixture?.profile && (
          <div className="form-group">
            <label>Profile Info</label>
            <div className="profile-channel-preview">
              <div className="profile-preview-row">
                <span className="profile-preview-label">Type: {fixture.type}</span>
              </div>
              <div className="profile-preview-row">
                <span className="profile-preview-label">
                  Channels: DMX {fixture.startAddress}–{(fixture.startAddress || 1) + fixture.profile.channelCount - 1}
                </span>
              </div>
              <div className="profile-preview-row">
                <span className="profile-preview-label">Modes: {fixture.profile.modes.length}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          {fixture && onDelete && (
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!name.trim() || (editorMode === 'basic' && !fixture?.profile && channels.length === 0)}
          >
            {fixture ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};
