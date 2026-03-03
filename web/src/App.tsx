import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { HeaderBar } from '@/components/layout/HeaderBar';
import { HostControlsPanel } from '@/components/host/HostControlsPanel';
import { HostPowerPanel } from '@/components/host/HostPowerPanel';
import { LandingPanel } from '@/components/lobby/LandingPanel';
import { CountdownOverlay } from '@/components/match/CountdownOverlay';
import { MatchHud } from '@/components/match/MatchHud';
import { PostGameStatsModal } from '@/components/match/PostGameStatsModal';
import { RpsTieBreakModal } from '@/components/match/RpsTieBreakModal';
import { PlayerInputPanel } from '@/components/player/PlayerInputPanel';
import { ConfettiBurst } from '@/components/shared/ConfettiBurst';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent } from '@/components/shared/ui/card';
import { Volume2, VolumeX } from 'lucide-react';
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/shared/ui/toast';
import chillhouseTrack from '@/assets/music/chillhouse.mp3';
import discoTrack from '@/assets/music/disco.mp3';
import eurobeatTrack from '@/assets/music/eurobeat.mp3';
import funkyTrack from '@/assets/music/funky.mp3';
import { useSpacetimeSession } from '@/data/useSpacetimeSession';
import { summarizeMatchEventFacts } from '@/lib/events';
import { evaluateHostPowerActivationGuard, getCooldownRemainingMs } from '@/lib/hostPowerCooldown';
import { selectUiViewModel } from '@/lib/selectors';
import { useHostPowerCooldowns } from '@/lib/useHostPowerCooldowns';
import { useHostWebcamMesh } from '@/lib/useHostWebcamMesh';
import type { ToastMessage } from '@/types/ui';

const GAME_TYPE_TUG_OF_WAR = 'tug_of_war';
type TieZoneSize = 'small' | 'medium' | 'large' | 'xlarge';

const TIE_ZONE_PERCENT_BY_SIZE: Record<TieZoneSize, number> = {
  small: 10,
  medium: 20,
  large: 30,
  xlarge: 40,
};

const MUSIC_TRACKS = [
  { id: 'disco', label: 'Disco', src: discoTrack },
  { id: 'chillhouse', label: 'Chillhouse', src: chillhouseTrack },
  { id: 'funky', label: 'Funky', src: funkyTrack },
  { id: 'eurobeat', label: 'Eurobeat', src: eurobeatTrack },
] as const;
type MusicTrackId = (typeof MUSIC_TRACKS)[number]['id'];

function makeToastId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MUSIC_TRACK_STORAGE_KEY = 'sttow_music_track';
const MUSIC_MUTED_STORAGE_KEY = 'sttow_music_muted';
const MUSIC_VOLUME_STORAGE_KEY = 'sttow_music_volume';
const GREENSCREEN_STORAGE_KEY = 'sttow_greenscreen_enabled';

function loadStoredTrackId(): MusicTrackId {
  try {
    const stored = localStorage.getItem(MUSIC_TRACK_STORAGE_KEY);
    if (stored && MUSIC_TRACKS.some((track) => track.id === stored)) {
      return stored as MusicTrackId;
    }
  } catch {
    // Ignore localStorage failures and fall back to default.
  }
  return MUSIC_TRACKS[0].id;
}

function loadStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUSIC_MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function loadStoredVolume(): number {
  try {
    const stored = localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY);
    if (!stored) {
      return 0.2;
    }
    const parsed = Number(stored);
    if (!Number.isFinite(parsed)) {
      return 0.2;
    }
    return Math.max(0, Math.min(1, parsed));
  } catch {
    return 0.2;
  }
}

function loadStoredGreenScreenEnabled(): boolean {
  try {
    return localStorage.getItem(GREENSCREEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function resolveTeamTone(
  lobby: NonNullable<ReturnType<typeof selectUiViewModel>['lobby']>
): 'teamA' | 'teamB' | 'neutral' {
  if (lobby.teamA.some((player) => player.isYou)) {
    return 'teamA';
  }
  if (lobby.teamB.some((player) => player.isYou)) {
    return 'teamB';
  }
  return 'neutral';
}

function toDisplayCharacterAccuracy(correctChars: number, missChars: number): number {
  const boundedCorrectChars = Math.max(0, Math.trunc(correctChars));
  const boundedMissChars = Math.max(0, Math.trunc(missChars));
  const attempts = boundedCorrectChars + boundedMissChars;
  if (attempts <= 0) {
    return 0;
  }
  if (boundedMissChars <= 0) {
    return 100;
  }
  return Math.max(0, Math.min(99, Math.round((boundedCorrectChars / attempts) * 100)));
}

export default function App() {
  const { state, identity, errorMessage, snapshot, actions } = useSpacetimeSession();

  const [displayName, setDisplayName] = useState('Player');
  const [joinCode, setJoinCode] = useState('');
  const [roundMinutes, setRoundMinutes] = useState(3);
  const [lockLobby, setLockLobby] = useState(false);
  const [tieZoneSize, setTieZoneSize] = useState<TieZoneSize>('small');
  const [pendingRoundSeconds, setPendingRoundSeconds] = useState<number | null>(null);
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  const [selectedLobbyId, setSelectedLobbyId] = useState('');
  const [dismissedLobbyId, setDismissedLobbyId] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [postGameModalOpen, setPostGameModalOpen] = useState(false);
  const [lastPostGameMatchId, setLastPostGameMatchId] = useState('');
  const [lastConfettiMatchId, setLastConfettiMatchId] = useState('');
  const [confettiBurstKey, setConfettiBurstKey] = useState(0);
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [leaveLobbyConfirmOpen, setLeaveLobbyConfirmOpen] = useState(false);
  const [nowMillis, setNowMillis] = useState(() => Date.now());
  const [selectedMusicTrackId, setSelectedMusicTrackId] = useState<MusicTrackId>(() =>
    loadStoredTrackId()
  );
  const [musicMuted, setMusicMuted] = useState<boolean>(() => loadStoredMuted());
  const [musicVolume, setMusicVolume] = useState<number>(() => loadStoredVolume());
  const [greenScreenEnabled, setGreenScreenEnabled] = useState<boolean>(() =>
    loadStoredGreenScreenEnabled()
  );
  const confettiTimeoutRef = useRef<number | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentMusicTrackIdRef = useRef<MusicTrackId | ''>('');

  const ui = useMemo(
    () =>
      selectUiViewModel({
        connectionState: state,
        snapshot,
        identity,
        selectedLobbyId,
        pendingJoinCode,
        ignoredLobbyId: dismissedLobbyId,
        includeEventFeed: false,
      }),
    [dismissedLobbyId, identity, pendingJoinCode, selectedLobbyId, snapshot, state]
  );
  const hostPowerCooldowns = useHostPowerCooldowns({
    role: ui.role,
    lobbyId: ui.lobby?.lobbyId ?? '',
    matchId: ui.matchHud?.matchId ?? '',
  });
  const { cooldownEndsByPowerId, getCooldownState, startCooldown } = hostPowerCooldowns;

  const selectedMusicTrack = useMemo(
    () => MUSIC_TRACKS.find((track) => track.id === selectedMusicTrackId) ?? MUSIC_TRACKS[0],
    [selectedMusicTrackId]
  );

  const attemptPlayMusic = useCallback(() => {
    const audio = musicAudioRef.current;
    if (!audio) {
      return;
    }
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      void playPromise.catch(() => {
        // Autoplay may be blocked until user interaction.
      });
    }
  }, []);

  useEffect(() => {
    if (ui.lobby && ui.lobby.lobbyId !== selectedLobbyId) {
      setSelectedLobbyId(ui.lobby.lobbyId);
    }
  }, [selectedLobbyId, ui.lobby]);

  useEffect(() => {
    if (ui.phase !== 'post' || !ui.matchHud?.matchId) {
      return;
    }

    if (ui.matchHud.matchId !== lastPostGameMatchId) {
      setLastPostGameMatchId(ui.matchHud.matchId);
      setPostGameModalOpen(true);
    }
  }, [lastPostGameMatchId, ui.matchHud, ui.phase]);

  useEffect(() => {
    if (ui.phase !== 'post' && postGameModalOpen) {
      setPostGameModalOpen(false);
    }
  }, [postGameModalOpen, ui.phase]);

  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current != null) {
        window.clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMillis(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = loadStoredVolume();
    musicAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      musicAudioRef.current = null;
      currentMusicTrackIdRef.current = '';
    };
  }, []);

  useEffect(() => {
    const audio = musicAudioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = musicVolume;
    audio.muted = musicMuted;
    if (!musicMuted) {
      attemptPlayMusic();
    }
  }, [attemptPlayMusic, musicMuted, musicVolume]);

  useEffect(() => {
    const audio = musicAudioRef.current;
    if (!audio) {
      return;
    }
    if (currentMusicTrackIdRef.current !== selectedMusicTrack.id) {
      audio.src = selectedMusicTrack.src;
      audio.currentTime = 0;
      audio.load();
      currentMusicTrackIdRef.current = selectedMusicTrack.id;
    }
    if (!musicMuted) {
      attemptPlayMusic();
    }
  }, [attemptPlayMusic, musicMuted, selectedMusicTrack]);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_TRACK_STORAGE_KEY, selectedMusicTrackId);
      localStorage.setItem(MUSIC_MUTED_STORAGE_KEY, musicMuted ? '1' : '0');
      localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, musicVolume.toString());
      localStorage.setItem(GREENSCREEN_STORAGE_KEY, greenScreenEnabled ? '1' : '0');
    } catch {
      // Ignore localStorage failures.
    }
  }, [greenScreenEnabled, musicMuted, musicVolume, selectedMusicTrackId]);

  useEffect(() => {
    if (musicMuted) {
      return;
    }
    const unlockPlayback = () => {
      attemptPlayMusic();
    };

    window.addEventListener('pointerdown', unlockPlayback);
    window.addEventListener('keydown', unlockPlayback);
    return () => {
      window.removeEventListener('pointerdown', unlockPlayback);
      window.removeEventListener('keydown', unlockPlayback);
    };
  }, [attemptPlayMusic, musicMuted, selectedMusicTrackId]);

  useEffect(() => {
    if (ui.phase === 'post') {
      return;
    }
    if (confettiTimeoutRef.current != null) {
      window.clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = null;
    }
    if (confettiVisible) {
      setConfettiVisible(false);
    }
  }, [confettiVisible, ui.phase]);

  const pushToast = useCallback(
    (title: string, description: string, tone: ToastMessage['tone'] = 'neutral') => {
      setToasts((current) => [
        ...current,
        {
          id: makeToastId(),
          title,
          description,
          tone,
        },
      ]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const withActionErrorToast = useCallback(
    async (title: string, action: () => Promise<void>) => {
      try {
        await action();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        pushToast(title, message, 'danger');
        throw error;
      }
    },
    [pushToast]
  );

  const handleCreateLobby = useCallback(async () => {
    setPendingJoinCode('');
    setDismissedLobbyId('');
    const roundSeconds = Math.max(1, Math.min(10, Math.trunc(roundMinutes))) * 60;
    const tieZonePercent = TIE_ZONE_PERCENT_BY_SIZE[tieZoneSize];
    await withActionErrorToast('Could not create lobby', () =>
      actions.createLobby(GAME_TYPE_TUG_OF_WAR, roundSeconds, lockLobby, tieZonePercent)
    );
    setPendingRoundSeconds(roundSeconds);
  }, [actions, lockLobby, roundMinutes, tieZoneSize, withActionErrorToast]);

  useEffect(() => {
    if (pendingRoundSeconds == null) {
      return;
    }
    if (!ui.lobby || ui.role !== 'host' || ui.lobby.status !== 'Waiting') {
      return;
    }
    if (ui.preMatchSecondsRemaining === pendingRoundSeconds) {
      setPendingRoundSeconds(null);
      return;
    }
    const lobby = ui.lobby;

    let cancelled = false;
    void withActionErrorToast('Could not set match length', () =>
      actions.setLobbySetting(lobby.lobbyId, 'round_seconds', JSON.stringify(pendingRoundSeconds))
    )
      .then(() => {
        if (!cancelled) {
          setPendingRoundSeconds(null);
        }
      })
      .catch(() => {
        // Toast is already shown by withActionErrorToast.
      });

    return () => {
      cancelled = true;
    };
  }, [
    actions,
    pendingRoundSeconds,
    ui.lobby,
    ui.preMatchSecondsRemaining,
    ui.role,
    withActionErrorToast,
  ]);

  const handleJoinLobby = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      pushToast('Missing join code', 'Enter a valid lobby code first.', 'neutral');
      return;
    }

    const nextName = displayName.trim() || 'Player';
    setPendingJoinCode(code);
    setDismissedLobbyId('');

    await withActionErrorToast('Could not join lobby', () => actions.joinLobby(code, nextName));
  }, [actions, displayName, joinCode, pushToast, withActionErrorToast]);

  const handleStartMatch = useCallback(async () => {
    if (!ui.lobby) {
      return;
    }

    await withActionErrorToast('Could not start match', () =>
      actions.startMatch(ui.lobby!.lobbyId)
    );
  }, [actions, ui.lobby, withActionErrorToast]);

  const handleResetLobby = useCallback(async () => {
    if (!ui.lobby) {
      return;
    }

    await withActionErrorToast('Could not reset lobby', () =>
      actions.resetLobby(ui.lobby!.lobbyId)
    );
  }, [actions, ui.lobby, withActionErrorToast]);

  const handleEndMatch = useCallback(async () => {
    if (!ui.lobby) {
      return;
    }

    await withActionErrorToast('Could not end match', () => actions.endMatch(ui.lobby!.lobbyId));
  }, [actions, ui.lobby, withActionErrorToast]);
  const handleClosePostGame = useCallback(async () => {
    const lobbyId = ui.lobby?.lobbyId;
    if (!lobbyId) {
      setPostGameModalOpen(false);
      return;
    }
    if (ui.role !== 'host' || ui.phase !== 'post') {
      setPostGameModalOpen(false);
      return;
    }

    await withActionErrorToast('Could not close post-game', () => actions.closePostGame(lobbyId));

    setDismissedLobbyId(lobbyId);
    setSelectedLobbyId('');
    setPendingJoinCode('');
    setPostGameModalOpen(false);
  }, [actions, ui.lobby, ui.phase, ui.role, withActionErrorToast]);

  const handleActivatePower = useCallback(
    async (powerId: string) => {
      if (!ui.matchHud) {
        return;
      }

      const power = ui.hostPanel?.powers.find((candidate) => candidate.id === powerId) ?? null;
      const cooldownEndsAtMs = cooldownEndsByPowerId[powerId] ?? 0;
      const cooldownRemainingMs = getCooldownRemainingMs(cooldownEndsAtMs, Date.now());
      const guard = evaluateHostPowerActivationGuard({
        power,
        cooldownRemainingMs,
      });
      if (guard?.blocked) {
        pushToast(guard.title, guard.description, 'neutral');
        return;
      }

      await withActionErrorToast('Could not activate power', () =>
        actions.activatePower(ui.matchHud!.matchId, powerId)
      );
      startCooldown(powerId);
    },
    [
      actions,
      cooldownEndsByPowerId,
      pushToast,
      startCooldown,
      ui.hostPanel?.powers,
      ui.matchHud,
      withActionErrorToast,
    ]
  );

  const handleSubmitWord = useCallback(
    async (typed: string) => {
      if (!ui.matchHud) {
        throw new Error('No active match.');
      }

      await withActionErrorToast('Submission failed', () =>
        actions.submitWord(ui.matchHud!.matchId, ui.matchHud!.wordVersion, typed)
      );
    },
    [actions, ui.matchHud, withActionErrorToast]
  );
  const handleRecordMistake = useCallback(async () => {
    if (!ui.matchHud) {
      return;
    }

    try {
      await actions.recordMistake(ui.matchHud.matchId);
    } catch {
      // Ignore transient errors; mistakes are telemetry and should not interrupt typing.
    }
  }, [actions, ui.matchHud]);
  const handleVoteRps = useCallback(
    async (choice: 'rock' | 'paper' | 'scissors') => {
      if (!ui.rpsTieBreak) {
        return;
      }
      await withActionErrorToast('Could not submit tie-break vote', () =>
        actions.voteRps(ui.rpsTieBreak!.matchId, choice)
      );
    },
    [actions, ui.rpsTieBreak, withActionErrorToast]
  );
  const handleContinueTieBreak = useCallback(async () => {
    if (!ui.rpsTieBreak) {
      return;
    }
    await withActionErrorToast('Could not continue to post-game', () =>
      actions.continueTieBreak(ui.rpsTieBreak!.matchId)
    );
  }, [actions, ui.rpsTieBreak, withActionErrorToast]);
  const fireConfettiBurst = useCallback(() => {
    setConfettiBurstKey((current) => current + 1);
    setConfettiVisible(true);

    if (confettiTimeoutRef.current != null) {
      window.clearTimeout(confettiTimeoutRef.current);
    }
    confettiTimeoutRef.current = window.setTimeout(() => {
      setConfettiVisible(false);
      confettiTimeoutRef.current = null;
    }, 8200);
  }, []);
  const handleCopyLobbyCode = useCallback(async () => {
    const code = ui.lobby?.joinCode?.trim();
    if (!code) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const input = document.createElement('textarea');
        input.value = code;
        input.setAttribute('readonly', 'true');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      pushToast('Copied', `Lobby code ${code} copied to clipboard.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Clipboard unavailable';
      pushToast('Copy failed', message, 'danger');
    }
  }, [pushToast, ui.lobby]);

  const leaveLobbyLocally = useCallback((lobbyId: string) => {
    setDismissedLobbyId(lobbyId);
    setSelectedLobbyId('');
    setPendingJoinCode('');
    setPostGameModalOpen(false);
    setLeaveLobbyConfirmOpen(false);
  }, []);

  const requestLeaveLobby = useCallback(
    async (lobbyId: string) => {
      try {
        await actions.leaveLobby(lobbyId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        pushToast('Could not leave lobby', message, 'danger');
      }
    },
    [actions, pushToast]
  );

  const handleLeaveLobbyClick = useCallback(() => {
    const lobbyId = ui.lobby?.lobbyId;
    if (!lobbyId) {
      return;
    }

    if (ui.role === 'host') {
      setLeaveLobbyConfirmOpen(true);
      return;
    }

    leaveLobbyLocally(lobbyId);
    void requestLeaveLobby(lobbyId);
  }, [leaveLobbyLocally, requestLeaveLobby, ui.lobby, ui.role]);

  const handleConfirmLeaveLobby = useCallback(() => {
    const lobbyId = ui.lobby?.lobbyId;
    if (!lobbyId) {
      setLeaveLobbyConfirmOpen(false);
      return;
    }
    leaveLobbyLocally(lobbyId);
    void requestLeaveLobby(lobbyId);
  }, [leaveLobbyLocally, requestLeaveLobby, ui.lobby]);

  useEffect(() => {
    if (!ui.lobby && leaveLobbyConfirmOpen) {
      setLeaveLobbyConfirmOpen(false);
    }
  }, [leaveLobbyConfirmOpen, ui.lobby]);

  const webcamMesh = useHostWebcamMesh({
    role: ui.role,
    identity,
    lobby: ui.lobby,
    hud: ui.matchHud,
    snapshot,
    actions,
    pushToast,
  });

  const myTeam = useMemo(() => {
    if (!ui.lobby) {
      return '';
    }
    if (ui.lobby.teamA.some((player) => player.isYou)) {
      return 'A';
    }
    if (ui.lobby.teamB.some((player) => player.isYou)) {
      return 'B';
    }
    return '';
  }, [ui.lobby]);
  const matchEventFacts = useMemo(() => {
    const matchId = ui.matchHud?.matchId ?? '';
    const lobbyId = ui.lobby?.lobbyId ?? '';
    if (!matchId || !lobbyId) {
      return null;
    }
    return summarizeMatchEventFacts(snapshot.events, {
      matchId,
      lobbyId,
    });
  }, [snapshot.events, ui.lobby?.lobbyId, ui.matchHud?.matchId]);
  const hostAccuracy = useMemo(() => {
    const matchId = ui.matchHud?.matchId ?? '';
    if (!matchId) {
      return 0;
    }
    const hostState = snapshot.tugHostStates.find((row) => row.matchId === matchId);
    if (hostState) {
      return toDisplayCharacterAccuracy(hostState.correctCharCount, hostState.missCharCount);
    }
    return matchEventFacts?.hostAccuracy.accuracy ?? 0;
  }, [matchEventFacts?.hostAccuracy.accuracy, snapshot.tugHostStates, ui.matchHud?.matchId]);
  const latestHostPowerActivation = useMemo(() => {
    return matchEventFacts?.latestHostPowerActivation ?? null;
  }, [matchEventFacts?.latestHostPowerActivation]);
  const postGameCloseSecondsRemaining = useMemo(() => {
    if (ui.phase !== 'post' || !ui.lobby) {
      return null;
    }
    const dismissAtMicros = matchEventFacts?.latestPostGameClose?.dismissAtMicros ?? null;

    if (dismissAtMicros == null) {
      return null;
    }

    const nowMicros = BigInt(Math.trunc(nowMillis)) * 1000n;
    const remainingMicros = dismissAtMicros > nowMicros ? dismissAtMicros - nowMicros : 0n;
    return Math.max(0, Math.ceil(Number(remainingMicros) / 1_000_000));
  }, [matchEventFacts?.latestPostGameClose?.dismissAtMicros, nowMillis, ui.lobby, ui.phase]);
  const hostPowerCooldownStatesByPowerId = useMemo(() => {
    if (!ui.hostPanel) {
      return {};
    }
    return Object.fromEntries(
      ui.hostPanel.powers.map((power) => [power.id, getCooldownState(power.id)])
    );
  }, [getCooldownState, ui.hostPanel]);

  useEffect(() => {
    if (ui.phase !== 'post' || !ui.matchHud?.matchId) {
      return;
    }
    const winnerTeam = ui.matchHud.winnerTeam;
    if ((winnerTeam !== 'A' && winnerTeam !== 'B') || myTeam !== winnerTeam) {
      return;
    }
    if (ui.matchHud.matchId === lastConfettiMatchId) {
      return;
    }

    setLastConfettiMatchId(ui.matchHud.matchId);
    fireConfettiBurst();
  }, [fireConfettiBurst, lastConfettiMatchId, myTeam, ui.matchHud, ui.phase]);

  const teamTone = ui.lobby ? resolveTeamTone(ui.lobby) : 'neutral';
  const backgroundClassName = greenScreenEnabled
    ? 'bg-[#7fff00]'
    : teamTone === 'teamA'
      ? 'team-bg-a'
      : teamTone === 'teamB'
        ? 'team-bg-b'
        : '';

  const headerMusicControls = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <select
          value={selectedMusicTrackId}
          onChange={(event) => setSelectedMusicTrackId(event.target.value as MusicTrackId)}
          className="neo-focus h-9 rounded-[var(--ui-radius-md)] border-4 border-neo-ink bg-neo-paper px-2 font-display text-xs font-bold uppercase tracking-wide text-neo-ink shadow-neo"
          aria-label="Music track"
        >
          {MUSIC_TRACKS.map((track) => (
            <option key={track.id} value={track.id}>
              {track.label}
            </option>
          ))}
        </select>
        <div className="group relative">
          <Button
            type="button"
            size="icon"
            variant="neutral"
            className="h-9 w-9"
            onClick={() => {
              setMusicMuted((current) => !current);
            }}
            aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
            title={musicMuted ? 'Unmute music' : 'Mute music'}
          >
            {musicMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <div className="pointer-events-none absolute left-1/2 top-full z-[92] -translate-x-1/2 pt-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <div className="flex h-28 w-12 items-center justify-center rounded-[var(--ui-radius-md)] border-4 border-neo-ink bg-neo-paper shadow-neo">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(musicVolume * 100)}
                onChange={(event) => {
                  const nextVolume = Math.max(
                    0,
                    Math.min(1, Number(event.target.value) / 100)
                  );
                  setMusicVolume(nextVolume);
                }}
                className="-rotate-90 w-20 m-0"
                aria-label="Music volume"
              />
            </div>
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="neutral"
          className={`h-9 w-9 ${greenScreenEnabled ? 'bg-[#7fff00]' : 'bg-[#adff2f]'} p-0`}
          onClick={() => {
            setGreenScreenEnabled((current) => !current);
          }}
          aria-label={greenScreenEnabled ? 'Disable greenscreen mode' : 'Enable greenscreen mode'}
          title={greenScreenEnabled ? 'Disable greenscreen mode' : 'Enable greenscreen mode'}
        />
      </div>
    ),
    [greenScreenEnabled, musicMuted, musicVolume, selectedMusicTrackId]
  );

  const primary =
    ui.phase === 'landing' ? (
      <LandingPanel
        displayName={displayName}
        joinCode={joinCode}
        roundMinutes={roundMinutes}
        lockLobby={lockLobby}
        tieZoneSize={tieZoneSize}
        onDisplayNameChange={setDisplayName}
        onJoinCodeChange={setJoinCode}
        onRoundMinutesChange={setRoundMinutes}
        onLockLobbyChange={setLockLobby}
        onTieZoneSizeChange={setTieZoneSize}
        onJoin={handleJoinLobby}
        onCreateLobby={handleCreateLobby}
      />
    ) : (
      <>
        {ui.matchHud || ui.preMatchHud ? (
          <MatchHud
            hud={ui.matchHud ?? ui.preMatchHud!}
            teamAPlayers={ui.lobby?.teamA ?? []}
            teamBPlayers={ui.lobby?.teamB ?? []}
            cameraStream={webcamMesh.backgroundStream}
            latestPowerActivation={ui.matchHud ? latestHostPowerActivation : null}
          />
        ) : null}
        {ui.playerInput ? (
          <PlayerInputPanel
            model={ui.playerInput}
            onSubmitWord={handleSubmitWord}
            onRecordMistake={handleRecordMistake}
            preMatch={!ui.matchHud || ui.matchHud.phase === 'PreGame'}
            activePowerId={ui.matchHud?.activePowerId ?? ''}
          />
        ) : null}
        {ui.role === 'host' && ui.hostPanel ? (
          <HostPowerPanel
            hostPowerMeter={ui.matchHud?.hostPowerMeter ?? 0}
            powers={ui.hostPanel.powers}
            cooldownsByPowerId={hostPowerCooldownStatesByPowerId}
            onActivatePower={handleActivatePower}
          />
        ) : null}
      </>
    );

  const secondary =
    ui.phase !== 'landing' && ui.role === 'host' && ui.lobby ? (
      <HostControlsPanel
        lobby={ui.lobby}
        hud={ui.matchHud}
        hostPanel={ui.hostPanel}
        cameraEnabled={webcamMesh.cameraEnabled}
        cameraToggleEnabled={webcamMesh.cameraToggleEnabled}
        cameraBusy={webcamMesh.cameraBusy}
        onStartMatch={handleStartMatch}
        onResetLobby={handleResetLobby}
        onEndMatch={handleEndMatch}
        onSetCameraEnabled={webcamMesh.toggleCamera}
      />
    ) : null;

  const showCountdownOverlay =
    ui.matchHud?.phase === 'PreGame' &&
    ui.matchHud.secondsRemaining != null &&
    ui.matchHud.secondsRemaining > 0;

  return (
    <ToastProvider duration={2200} swipeDirection="right">
      <AppShell
        backgroundClassName={backgroundClassName}
        banner={<ConnectionBanner state={state} errorMessage={errorMessage} />}
        header={
          <HeaderBar
            lobbyCode={ui.lobby?.joinCode ?? ''}
            onCopyLobbyCode={() => {
              void handleCopyLobbyCode();
            }}
            onLeaveLobby={() => {
              handleLeaveLobbyClick();
            }}
            musicControls={headerMusicControls}
          />
        }
        primary={primary}
        secondary={secondary}
      />
      <CountdownOverlay
        visible={showCountdownOverlay}
        secondsRemaining={ui.matchHud?.secondsRemaining ?? null}
      />
      <ConfettiBurst burstKey={confettiBurstKey} visible={confettiVisible} />
      <RpsTieBreakModal
        model={ui.rpsTieBreak}
        role={ui.role}
        onVote={handleVoteRps}
        onContinue={handleContinueTieBreak}
      />
      <PostGameStatsModal
        open={postGameModalOpen}
        onClose={() => {
          void handleClosePostGame();
        }}
        onResetMatch={handleResetLobby}
        role={ui.role}
        lobby={ui.lobby}
        hud={ui.matchHud}
        hostAccuracy={hostAccuracy}
        waitingForHostSeconds={ui.role === 'player' ? postGameCloseSecondsRemaining : null}
      />
      {leaveLobbyConfirmOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-neo-ink/45 p-3">
          <Card role="dialog" aria-modal="true" className="relative z-[87] w-full max-w-md">
            <CardContent className="space-y-3">
              <p className="text-center font-display text-2xl font-black uppercase tracking-wide text-neo-ink">
                Leave Lobby?
              </p>
              <p className="ui-subtext text-center">
                You are the host. Leaving will close this lobby for everyone.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="neutral"
                  onClick={() => {
                    setLeaveLobbyConfirmOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" variant="danger" onClick={handleConfirmLeaveLobby}>
                  Leave Lobby
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          open
          onOpenChange={(open) => {
            if (!open) {
              dismissToast(toast.id);
            }
          }}
          tone={toast.tone}
        >
          <ToastTitle>{toast.title}</ToastTitle>
          <ToastDescription>{toast.description}</ToastDescription>
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
