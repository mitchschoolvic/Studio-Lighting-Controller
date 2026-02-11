import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import type { DMXState, DMXStatus } from '../types';

/**
 * Hook to subscribe to DMX universe state updates via Socket.io.
 */
export function useDMXState(socket: Socket | null) {
  const [channels, setChannelsState] = useState<number[]>(new Array(512).fill(0));
  const [master, setMaster] = useState<number>(255);
  const [dmxStatus, setDMXStatus] = useState<DMXStatus>({
    connected: false,
    port: null,
  });

  useEffect(() => {
    if (!socket) return;

    const handleState = (data: DMXState) => {
      setChannelsState(data.channels);
      setMaster(data.master);
    };

    const handleStatus = (data: DMXStatus) => {
      setDMXStatus(data);
    };

    socket.on('dmx:state', handleState);
    socket.on('dmx:status', handleStatus);

    return () => {
      socket.off('dmx:state', handleState);
      socket.off('dmx:status', handleStatus);
    };
  }, [socket]);

  const setChannel = useCallback(
    (channel: number, value: number) => {
      socket?.emit('dmx:set-channel', { channel, value });
    },
    [socket]
  );

  const setChannels = useCallback(
    (values: Record<number, number>) => {
      socket?.emit('dmx:set-channels', { values });
    },
    [socket]
  );

  const setMasterDimmer = useCallback(
    (value: number) => {
      socket?.emit('dmx:master', { value });
    },
    [socket]
  );

  const blackout = useCallback(
    (fadeTime?: number) => {
      socket?.emit('dmx:blackout', { fadeTime });
    },
    [socket]
  );

  return {
    channels,
    master,
    dmxStatus,
    setChannel,
    setChannelsBatch: setChannels,
    setMasterDimmer,
    blackout,
  };
}
