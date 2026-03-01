import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameActions } from '@/data/actions';
import type { SessionSnapshot } from '@/data/selectors';
import type { LobbyViewModel, MatchHudViewModel, ToastMessage, UiRole } from '@/types/ui';

interface UseHostWebcamMeshParams {
  role: UiRole;
  identity: string;
  lobby: LobbyViewModel | null;
  hud: MatchHudViewModel | null;
  snapshot: SessionSnapshot;
  actions: Pick<GameActions, 'setCameraEnabled' | 'sendWebrtcSignal'>;
  pushToast: (title: string, description: string, tone?: ToastMessage['tone']) => void;
}

interface UseHostWebcamMeshResult {
  backgroundStream: MediaStream | null;
  cameraEnabled: boolean;
  cameraToggleEnabled: boolean;
  cameraBusy: boolean;
  toggleCamera: (enabled: boolean) => Promise<void>;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};

const ACTIVE_PHASES = new Set(['PreGame', 'InGame', 'SuddenDeath', 'TieBreakRps']);

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase();
}

function parseJsonPayload<T>(payloadJson: string): T | null {
  try {
    return JSON.parse(payloadJson) as T;
  } catch {
    return null;
  }
}

export function useHostWebcamMesh({
  role,
  identity,
  lobby,
  hud,
  snapshot,
  actions,
  pushToast,
}: UseHostWebcamMeshParams): UseHostWebcamMeshResult {
  const isHost = role === 'host';
  const matchId = hud?.matchId ?? '';
  const hasLiveMatch = matchId.length > 0;
  const canPreArmInLobby = isHost && Boolean(lobby) && !hasLiveMatch;
  const isActivePhase = Boolean(hud && ACTIVE_PHASES.has(hud.phase));
  const hostIdentity = hud?.hostCameraHostIdentity ?? lobby?.hostIdentity ?? '';
  const streamEpoch = Math.max(0, hud?.hostCameraStreamEpoch ?? 0);
  const cameraEnabledFromServer = Boolean(hud?.hostCameraEnabled);

  const [cameraBusy, setCameraBusy] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [preArmed, setPreArmed] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const processedSignalIdsRef = useRef(new Set<string>());
  const viewerReadyKeyRef = useRef('');
  const streamKeyRef = useRef('');

  const closePeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (!peer) {
      return;
    }
    peer.onicecandidate = null;
    peer.ontrack = null;
    peer.close();
    peersRef.current.delete(peerId);
  }, []);

  const closeAllPeers = useCallback(() => {
    for (const peerId of peersRef.current.keys()) {
      closePeer(peerId);
    }
  }, [closePeer]);

  const stopLocalStream = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }
    for (const track of stream.getTracks()) {
      track.onended = null;
      track.stop();
    }
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const clearRemoteStream = useCallback(() => {
    const stream = remoteStreamRef.current;
    if (!stream) {
      return;
    }
    remoteStreamRef.current = null;
    setRemoteStream(null);
  }, []);

  const sendSignal = useCallback(
    async (toIdentity: string, kind: string, payload: Record<string, unknown>) => {
      if (!hasLiveMatch || streamEpoch <= 0) {
        return;
      }
      await actions.sendWebrtcSignal(
        matchId,
        streamEpoch,
        toIdentity,
        kind,
        JSON.stringify(payload)
      );
    },
    [actions, hasLiveMatch, matchId, streamEpoch]
  );

  const createPeerConnection = useCallback(
    (remoteIdentity: string, mode: 'host' | 'viewer'): RTCPeerConnection => {
      closePeer(remoteIdentity);

      const peer = new RTCPeerConnection(ICE_SERVERS);
      peer.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }
        void sendSignal(remoteIdentity, 'ice', {
          candidate: event.candidate.toJSON(),
        }).catch(() => {
          // Best-effort signaling. Connection retries naturally.
        });
      };

      if (mode === 'host') {
        const stream = localStreamRef.current;
        if (stream) {
          for (const track of stream.getTracks()) {
            peer.addTrack(track, stream);
          }
        }
      } else {
        peer.ontrack = (event) => {
          const [stream] = event.streams;
          if (!stream) {
            return;
          }
          remoteStreamRef.current = stream;
          setRemoteStream(stream);
        };
      }

      peersRef.current.set(remoteIdentity, peer);
      return peer;
    },
    [closePeer, sendSignal]
  );

  const incomingSignals = useMemo(
    () =>
      snapshot.tugWebrtcSignals
        .filter(
          (signal) =>
            hasLiveMatch &&
            signal.matchId === matchId &&
            signal.streamEpoch === streamEpoch &&
            normalizeIdentity(signal.toIdentity) === normalizeIdentity(identity)
        )
        .sort((left, right) => {
          if (left.createdAtMicros === right.createdAtMicros) {
            return left.signalId.localeCompare(right.signalId);
          }
          return left.createdAtMicros > right.createdAtMicros ? 1 : -1;
        }),
    [hasLiveMatch, identity, matchId, snapshot.tugWebrtcSignals, streamEpoch]
  );

  useEffect(() => {
    const streamKey = `${matchId}:${streamEpoch}:${cameraEnabledFromServer ? 1 : 0}:${isActivePhase ? 1 : 0}`;
    if (streamKeyRef.current === streamKey) {
      return;
    }

    streamKeyRef.current = streamKey;
    processedSignalIdsRef.current.clear();
    viewerReadyKeyRef.current = '';
    closeAllPeers();

    if (!cameraEnabledFromServer || !isActivePhase) {
      clearRemoteStream();
      if (!isHost) {
        stopLocalStream();
      }
    }
  }, [
    cameraEnabledFromServer,
    clearRemoteStream,
    closeAllPeers,
    isActivePhase,
    isHost,
    matchId,
    stopLocalStream,
    streamEpoch,
  ]);

  useEffect(() => {
    if (!isActivePhase || !cameraEnabledFromServer || streamEpoch <= 0 || !hasLiveMatch || isHost) {
      viewerReadyKeyRef.current = '';
      return;
    }

    const normalizedHost = normalizeIdentity(hostIdentity);
    if (!normalizedHost || normalizedHost === normalizeIdentity(identity)) {
      return;
    }

    const readyKey = `${matchId}:${streamEpoch}:${identity}`;
    if (viewerReadyKeyRef.current === readyKey) {
      return;
    }

    viewerReadyKeyRef.current = readyKey;
    void sendSignal(hostIdentity, 'viewer_ready', {}).catch(() => {
      // If this fails, a later snapshot update/reconnect will retry.
      viewerReadyKeyRef.current = '';
    });
  }, [
    cameraEnabledFromServer,
    hasLiveMatch,
    hostIdentity,
    identity,
    isActivePhase,
    isHost,
    matchId,
    sendSignal,
    streamEpoch,
  ]);

  useEffect(() => {
    if (!hasLiveMatch || !cameraEnabledFromServer || !isActivePhase || streamEpoch <= 0) {
      return;
    }

    const liveSignalIds = new Set(incomingSignals.map((signal) => signal.signalId));
    for (const signalId of Array.from(processedSignalIdsRef.current.values())) {
      if (!liveSignalIds.has(signalId)) {
        processedSignalIdsRef.current.delete(signalId);
      }
    }

    for (const signal of incomingSignals) {
      if (processedSignalIdsRef.current.has(signal.signalId)) {
        continue;
      }
      processedSignalIdsRef.current.add(signal.signalId);

      const fromIdentity = signal.fromIdentity;
      if (!fromIdentity) {
        continue;
      }

      if (signal.kind === 'viewer_ready') {
        if (!isHost) {
          continue;
        }
        if (!peersRef.current.has(fromIdentity) && peersRef.current.size >= 12) {
          continue;
        }
        const peer = createPeerConnection(fromIdentity, 'host');
        void (async () => {
          try {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            await sendSignal(fromIdentity, 'offer', {
              sdp: peer.localDescription,
            });
          } catch {
            closePeer(fromIdentity);
          }
        })();
        continue;
      }

      if (signal.kind === 'offer') {
        if (isHost) {
          continue;
        }
        const payload = parseJsonPayload<{ sdp?: RTCSessionDescriptionInit | null }>(
          signal.payloadJson
        );
        const remoteDescription = payload?.sdp;
        if (!remoteDescription) {
          continue;
        }
        const peer = createPeerConnection(fromIdentity, 'viewer');
        void (async () => {
          try {
            await peer.setRemoteDescription(remoteDescription);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await sendSignal(fromIdentity, 'answer', {
              sdp: peer.localDescription,
            });
          } catch {
            closePeer(fromIdentity);
          }
        })();
        continue;
      }

      if (signal.kind === 'answer') {
        if (!isHost) {
          continue;
        }
        const payload = parseJsonPayload<{ sdp?: RTCSessionDescriptionInit | null }>(
          signal.payloadJson
        );
        const remoteDescription = payload?.sdp;
        if (!remoteDescription) {
          continue;
        }
        const peer = peersRef.current.get(fromIdentity);
        if (!peer) {
          continue;
        }
        void peer.setRemoteDescription(remoteDescription).catch(() => {
          closePeer(fromIdentity);
        });
        continue;
      }

      if (signal.kind === 'ice') {
        const payload = parseJsonPayload<{ candidate?: RTCIceCandidateInit | null }>(
          signal.payloadJson
        );
        const candidate = payload?.candidate;
        if (!candidate) {
          continue;
        }
        const peer = peersRef.current.get(fromIdentity);
        if (!peer) {
          continue;
        }
        void peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {
          // Ignore transient ICE race conditions.
        });
      }
    }
  }, [
    cameraEnabledFromServer,
    closePeer,
    createPeerConnection,
    hasLiveMatch,
    incomingSignals,
    isActivePhase,
    isHost,
    matchId,
    sendSignal,
    streamEpoch,
  ]);

  const ensureLocalPreviewStream = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    for (const track of stream.getTracks()) {
      track.onended = () => {
        closeAllPeers();
        stopLocalStream();
        clearRemoteStream();
        setPreArmed(false);
        if (matchId) {
          void actions.setCameraEnabled(matchId, false).catch(() => {
            // Ignore phase/race errors during stream shutdown.
          });
        }
        pushToast('Camera Off', 'Webcam stream ended.', 'neutral');
      };
    }
    return stream;
  }, [actions, clearRemoteStream, closeAllPeers, matchId, pushToast, stopLocalStream]);

  const toggleCamera = useCallback(
    async (enabled: boolean) => {
      if (!isHost) {
        return;
      }
      setCameraBusy(true);

      if (!enabled) {
        try {
          if (hasLiveMatch && cameraEnabledFromServer) {
            await actions.setCameraEnabled(matchId, false);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Could not disable camera stream.';
          pushToast('Camera Error', message, 'danger');
        } finally {
          closeAllPeers();
          stopLocalStream();
          clearRemoteStream();
          setPreArmed(false);
          setCameraBusy(false);
        }
        return;
      }

      try {
        await ensureLocalPreviewStream();
        setPreArmed(true);
        if (hasLiveMatch && isActivePhase) {
          await actions.setCameraEnabled(matchId, true);
        }
      } catch (error) {
        closeAllPeers();
        stopLocalStream();
        clearRemoteStream();
        setPreArmed(false);
        const message =
          error instanceof Error ? error.message : 'Camera permission denied or unavailable.';
        pushToast('Camera Error', message, 'danger');
      } finally {
        setCameraBusy(false);
      }
    },
    [
      actions,
      cameraEnabledFromServer,
      clearRemoteStream,
      closeAllPeers,
      ensureLocalPreviewStream,
      hasLiveMatch,
      isActivePhase,
      isHost,
      matchId,
      pushToast,
      stopLocalStream,
    ]
  );

  useEffect(() => {
    if (
      !isHost ||
      !isActivePhase ||
      !cameraEnabledFromServer ||
      cameraBusy ||
      localStreamRef.current
    ) {
      return;
    }
    void toggleCamera(true);
  }, [cameraBusy, cameraEnabledFromServer, isActivePhase, isHost, toggleCamera]);

  useEffect(() => {
    if (
      !isHost ||
      !hasLiveMatch ||
      !isActivePhase ||
      !preArmed ||
      cameraEnabledFromServer ||
      cameraBusy
    ) {
      return;
    }
    void toggleCamera(true);
  }, [
    cameraBusy,
    cameraEnabledFromServer,
    hasLiveMatch,
    isActivePhase,
    isHost,
    preArmed,
    toggleCamera,
  ]);

  useEffect(() => {
    if (!isHost || isActivePhase || preArmed) {
      return;
    }
    closeAllPeers();
    stopLocalStream();
    clearRemoteStream();
  }, [clearRemoteStream, closeAllPeers, isActivePhase, isHost, preArmed, stopLocalStream]);

  useEffect(() => {
    return () => {
      closeAllPeers();
      stopLocalStream();
      clearRemoteStream();
    };
  }, [clearRemoteStream, closeAllPeers, stopLocalStream]);

  const cameraEnabled = cameraEnabledFromServer || preArmed;
  const backgroundStream = isHost
    ? ((isActivePhase && (cameraEnabledFromServer || cameraBusy)) || preArmed) && localStream
      ? localStream
      : null
    : isActivePhase && cameraEnabledFromServer
      ? remoteStream
      : null;

  return {
    backgroundStream,
    cameraEnabled,
    cameraToggleEnabled: isHost && (isActivePhase || canPreArmInLobby),
    cameraBusy,
    toggleCamera,
  };
}
