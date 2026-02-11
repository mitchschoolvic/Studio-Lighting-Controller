import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import type { Fixture, FixtureChannel, ColorMode, FixtureProfile } from '../types';

interface BundledProfile {
  id: string;
  profile: FixtureProfile;
}

/**
 * Hook to subscribe to fixture profile list updates via Socket.io.
 */
export function useFixtures(socket: Socket | null) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [bundledProfiles, setBundledProfiles] = useState<BundledProfile[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleFixturesList = (data: Fixture[]) => {
      setFixtures(data);
    };

    const handleConflicts = (data: string[]) => {
      setConflicts(data);
    };

    const handleProfiles = (data: BundledProfile[]) => {
      setBundledProfiles(data);
    };

    socket.on('fixtures:list', handleFixturesList);
    socket.on('fixtures:conflicts', handleConflicts);
    socket.on('fixtures:profiles', handleProfiles);

    // Request profiles on connect
    socket.emit('fixture:get-profiles');

    return () => {
      socket.off('fixtures:list', handleFixturesList);
      socket.off('fixtures:conflicts', handleConflicts);
      socket.off('fixtures:profiles', handleProfiles);
    };
  }, [socket]);

  const createFixture = useCallback(
    (name: string, type: string, channels: FixtureChannel[], colorMode: ColorMode = 'rgb') => {
      socket?.emit('fixture:create', { name, type, channels, colorMode });
    },
    [socket]
  );

  const createFromProfile = useCallback(
    (name: string, profileId: string, startAddress: number) => {
      socket?.emit('fixture:create-from-profile', { name, profileId, startAddress });
    },
    [socket]
  );

  const updateFixture = useCallback(
    (id: string, patch: Partial<Fixture>) => {
      socket?.emit('fixture:update', { id, patch });
    },
    [socket]
  );

  const deleteFixture = useCallback(
    (id: string) => {
      socket?.emit('fixture:delete', { id });
    },
    [socket]
  );

  const setMode = useCallback(
    (fixtureId: string, modeName: string) => {
      socket?.emit('fixture:set-mode', { fixtureId, modeName });
    },
    [socket]
  );

  const triggerStart = useCallback(
    (channel: number) => {
      socket?.emit('fixture:trigger-start', { channel });
    },
    [socket]
  );

  const triggerEnd = useCallback(
    (channel: number) => {
      socket?.emit('fixture:trigger-end', { channel });
    },
    [socket]
  );

  return {
    fixtures,
    conflicts,
    bundledProfiles,
    createFixture,
    createFromProfile,
    updateFixture,
    deleteFixture,
    setMode,
    triggerStart,
    triggerEnd,
  };
}
