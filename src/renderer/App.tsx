import React, { useState, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import type { ViewMode } from './components/Header';
import { MasterFader } from './components/MasterFader';
import { FixturePanel } from './components/FixturePanel';
import { FixtureEditor } from './components/FixtureEditor';
import { FaderBank } from './components/FaderBank';
import { PresetGrid } from './components/PresetGrid';
import { CanvasView } from './components/CanvasView';
import { useSocket } from './hooks/useSocket';
import { useDMXState } from './hooks/useDMXState';
import { useFixtures } from './hooks/useFixtures';
import type { Fixture, FixtureChannel, ColorMode } from './types';

export const App: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const { channels, master, dmxStatus, setChannel, setMasterDimmer, blackout } =
    useDMXState(socket);
  const { fixtures, conflicts, bundledProfiles, createFixture, createFromProfile, updateFixture, deleteFixture, setMode, triggerStart, triggerEnd } =
    useFixtures(socket);

  const [showFixtureEditor, setShowFixtureEditor] = useState(false);
  const [editingFixture, setEditingFixture] = useState<Fixture | null>(null);
  const [showFixtureDrawer, setShowFixtureDrawer] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>('canvas');

  // Build channel map for the fader bank labels
  const channelMap = useMemo(() => {
    const map = new Map<number, { fixtureName: string; channelName: string }>();
    for (const fixture of fixtures) {
      for (const ch of fixture.channels) {
        if (!map.has(ch.dmxChannel)) {
          map.set(ch.dmxChannel, {
            fixtureName: fixture.name,
            channelName: ch.name,
          });
        }
      }
    }
    return map;
  }, [fixtures]);

  const handleOpenEditor = useCallback(() => {
    setEditingFixture(null);
    setShowFixtureEditor(true);
  }, []);

  const handleEditFixture = useCallback((fixture: Fixture) => {
    setEditingFixture(fixture);
    setShowFixtureEditor(true);
  }, []);

  const handleSaveFixture = useCallback(
    (name: string, type: string, fixtureChannels: FixtureChannel[], colorMode: ColorMode) => {
      createFixture(name, type, fixtureChannels, colorMode);
    },
    [createFixture]
  );

  const handleSaveFromProfile = useCallback(
    (name: string, profileId: string, startAddress: number) => {
      createFromProfile(name, profileId, startAddress);
    },
    [createFromProfile]
  );

  const handleUpdateFixture = useCallback(
    (id: string, patch: Partial<Fixture>) => {
      updateFixture(id, patch);
    },
    [updateFixture]
  );

  const handleDeleteFixture = useCallback(
    (id: string) => {
      deleteFixture(id);
    },
    [deleteFixture]
  );

  return (
    <div className="app-container">
      <Header
        dmxStatus={dmxStatus}
        isSocketConnected={isConnected}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <div className="app-body">
        {/* Sidebar: Master Fader + Blackout */}
        <div className="sidebar">
          <MasterFader value={master} onChange={setMasterDimmer} />
          <button
            className="btn btn-danger btn-sm"
            onClick={() => blackout(1000)}
            style={{ width: '100%', textAlign: 'center' }}
          >
            Blackout
          </button>
        </div>

        {/* Main content area — switches between Canvas and Fixtures view */}
        <div className="main-content">
          {activeView === 'canvas' ? (
            <CanvasView
              fixtures={fixtures}
              channels={channels}
              master={master}
              socket={socket}
              onChannelChange={setChannel}
              onUpdateFixture={handleUpdateFixture}
              onModeChange={setMode}
              onTriggerStart={triggerStart}
              onTriggerEnd={triggerEnd}
            />
          ) : (
            <>
              <div className="top-section">
                {/* Fixture Panel */}
                <FixturePanel
                  fixtures={fixtures}
                  channels={channels}
                  conflicts={conflicts}
                  onChannelChange={setChannel}
                  onOpenEditor={handleOpenEditor}
                  onEditFixture={handleEditFixture}
                  onDeleteFixture={handleDeleteFixture}
                  onModeChange={setMode}
                  onTriggerStart={triggerStart}
                  onTriggerEnd={triggerEnd}
                />

                {/* Fader Bank (collapsible) */}
                <div style={{ marginTop: 16 }}>
                  <FaderBank
                    channels={channels}
                    channelMap={channelMap}
                    onChannelChange={setChannel}
                  />
                </div>
              </div>

              {/* Bottom Section: Presets + Fixture Editor Toggle */}
              <div className="bottom-section">
                {/* Preset Grid */}
                <PresetGrid socket={socket} />

                {/* Fixture Editor Drawer Toggle */}
                <div
                  className="fixture-editor-header"
                  onClick={() => setShowFixtureDrawer(!showFixtureDrawer)}
                >
                  <h3>
                    <span className={`collapsible-arrow ${showFixtureDrawer ? 'open' : ''}`}>
                      &#9654;
                    </span>{' '}
                    Fixture Editor ({fixtures.length} fixtures)
                  </h3>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditor();
                    }}
                  >
                    + New Fixture
                  </button>
                </div>

                {showFixtureDrawer && (
                  <div className="fixture-editor-drawer">
                    {fixtures.length === 0 ? (
                      <div className="empty-state">
                        <p>No fixtures configured</p>
                      </div>
                    ) : (
                      <div className="fixture-list">
                        {fixtures.map((fixture) => (
                          <div key={fixture.id} className="fixture-list-item">
                            <div className="fixture-info">
                              <span className="fixture-name">{fixture.name}</span>
                              <span className="fixture-channels">
                                {fixture.type} {fixture.profile ? '(Profile)' : `(${fixture.colorMode === 'hsb' ? 'HSB' : 'RGB'})`} — {fixture.channels.length} ch (
                                {fixture.profile && fixture.startAddress
                                  ? `DMX ${fixture.startAddress}–${fixture.startAddress + fixture.profile.channelCount - 1}`
                                  : fixture.channels.map((c) => `CH${c.dmxChannel}`).join(', ')})
                              </span>
                            </div>
                            <div className="fixture-actions">
                              <button
                                className="btn-icon"
                                onClick={() => handleEditFixture(fixture)}
                                title="Edit fixture"
                              >
                                ✎
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => handleDeleteFixture(fixture.id)}
                                title="Delete fixture"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fixture Editor Modal */}
      {showFixtureEditor && (
        <FixtureEditor
          fixture={editingFixture || undefined}
          bundledProfiles={bundledProfiles}
          onSave={handleSaveFixture}
          onSaveFromProfile={handleSaveFromProfile}
          onUpdate={handleUpdateFixture}
          onDelete={handleDeleteFixture}
          onClose={() => {
            setShowFixtureEditor(false);
            setEditingFixture(null);
          }}
        />
      )}
    </div>
  );
};
