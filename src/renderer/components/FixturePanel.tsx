import React, { useState, useCallback } from 'react';
import { FixtureCard } from './FixtureCard';
import type { Fixture } from '../types';

interface FixturePanelProps {
  fixtures: Fixture[];
  channels: number[];
  conflicts: string[];
  onChannelChange: (channel: number, value: number) => void;
  onOpenEditor: () => void;
  onEditFixture: (fixture: Fixture) => void;
  onDeleteFixture: (id: string) => void;
  onModeChange?: (fixtureId: string, modeName: string) => void;
  onTriggerStart?: (channel: number) => void;
  onTriggerEnd?: (channel: number) => void;
}

/**
 * FixturePanel — Tabbed interface, one tab per fixture.
 * Renders FixtureCard for the currently selected fixture.
 */
export const FixturePanel: React.FC<FixturePanelProps> = ({
  fixtures,
  channels,
  conflicts,
  onChannelChange,
  onOpenEditor,
  onEditFixture,
  onDeleteFixture,
  onModeChange,
  onTriggerStart,
  onTriggerEnd,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = useCallback((id: string) => {
    setConfirmDelete(id);
  }, []);

  const confirmDeleteFixture = useCallback(() => {
    if (confirmDelete) {
      onDeleteFixture(confirmDelete);
      setConfirmDelete(null);
      // If we deleted the active tab, reset to first
      if (activeTab >= fixtures.length - 1) {
        setActiveTab(Math.max(0, fixtures.length - 2));
      }
    }
  }, [confirmDelete, onDeleteFixture, activeTab, fixtures.length]);

  if (fixtures.length === 0) {
    return (
      <div className="fixture-panel">
        <div className="empty-state">
          <p>No fixtures configured</p>
          <button className="btn btn-primary" onClick={onOpenEditor}>
            + Create Fixture
          </button>
        </div>
      </div>
    );
  }

  const activeFixture = fixtures[activeTab] || fixtures[0];

  return (
    <div className="fixture-panel">
      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Fixture</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}>×</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
              Are you sure you want to delete <strong>{fixtures.find(f => f.id === confirmDelete)?.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDeleteFixture}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <div className="alert alert-warning">
          <strong>Channel Conflicts:</strong>
          <ul style={{ marginTop: 4, paddingLeft: 20 }}>
            {conflicts.map((c, i) => (
              <li key={i} style={{ fontSize: 12 }}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="fixture-tabs">
        {fixtures.map((fixture, index) => (
          <button
            key={fixture.id}
            className={`fixture-tab ${index === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {fixture.name}
          </button>
        ))}
        <button
          className="fixture-tab"
          onClick={onOpenEditor}
          style={{ color: 'var(--accent-glow)' }}
        >
          + Add
        </button>
      </div>

      {/* Active fixture card */}
      <FixtureCard
        fixture={activeFixture}
        channels={channels}
        onChannelChange={onChannelChange}
        onEdit={() => onEditFixture(activeFixture)}
        onDelete={() => handleDelete(activeFixture.id)}
        onModeChange={onModeChange}
        onTriggerStart={onTriggerStart}
        onTriggerEnd={onTriggerEnd}
      />
    </div>
  );
};
