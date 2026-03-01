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
import { EventFeed } from '@/components/shared/EventFeed';
import { ConfettiBurst } from '@/components/shared/ConfettiBurst';
import { Badge } from '@/components/shared/ui/badge';
import { Button } from '@/components/shared/ui/button';
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
import funkyTrack from '@/assets/music/funky.mp3';
import { useSpacetimeSession } from '@/data/useSpacetimeSession';
import { selectUiViewModel } from '@/lib/selectors';
import type { RpsTieBreakViewModel, ToastMessage } from '@/types/ui';

const GAME_TYPE_TUG_OF_WAR = 'tug_of_war';
type DebugModal = 'none' | 'countdown' | 'rpsVoting' | 'rpsReveal' | 'postGame';
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
] as const;
type MusicTrackId = (typeof MUSIC_TRACKS)[number]['id'];

function toBigIntOrNull(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

function parsePostGameDismissAtMicros(payloadJson: string): bigint | null {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    return (
      toBigIntOrNull(payload.dismiss_at_micros) ??
      toBigIntOrNull(payload.dismissAtMicros) ??
      null
    );
  } catch {
    return null;
  }
}

function makeToastId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MUSIC_TRACK_STORAGE_KEY = 'sttow_music_track';
const MUSIC_MUTED_STORAGE_KEY = 'sttow_music_muted';

function loadStoredTrackId(): MusicTrackId {
  try {
    const stored = localStorage.getItem(MUSIC_TRACK_STORAGE_KEY);
    if (stored && MUSIC_TRACKS.some(track => track.id === stored)) {
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

function resolveTeamTone(
  lobby: NonNullable<ReturnType<typeof selectUiViewModel>['lobby']>
): 'teamA' | 'teamB' | 'neutral' {
  if (lobby.teamA.some(player => player.isYou)) {
    return 'teamA';
  }
  if (lobby.teamB.some(player => player.isYou)) {
    return 'teamB';
  }
  return 'neutral';
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
  const [debugModal, setDebugModal] = useState<DebugModal>('none');
  const [debugRpsVote, setDebugRpsVote] = useState<'rock' | 'paper' | 'scissors' | ''>('');
  const [nowMillis, setNowMillis] = useState(() => Date.now());
  const [selectedMusicTrackId, setSelectedMusicTrackId] = useState<MusicTrackId>(() =>
    loadStoredTrackId()
  );
  const [musicMuted, setMusicMuted] = useState<boolean>(() => loadStoredMuted());
  const confettiTimeoutRef = useRef<number | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicVolumeRampFrameRef = useRef<number | null>(null);
  const currentMusicVolumeRef = useRef(0.05);
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
      }),
    [dismissedLobbyId, identity, pendingJoinCode, selectedLobbyId, snapshot, state]
  );

  const selectedMusicTrack = useMemo(
    () =>
      MUSIC_TRACKS.find(track => track.id === selectedMusicTrackId) ?? MUSIC_TRACKS[0],
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
    audio.volume = currentMusicVolumeRef.current;
    musicAudioRef.current = audio;

    return () => {
      if (musicVolumeRampFrameRef.current != null) {
        window.cancelAnimationFrame(musicVolumeRampFrameRef.current);
        musicVolumeRampFrameRef.current = null;
      }
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
    const audio = musicAudioRef.current;
    if (!audio) {
      return;
    }
    const targetVolume = ui.phase === 'landing' ? 0.05 : 0.2;
    if (musicVolumeRampFrameRef.current != null) {
      window.cancelAnimationFrame(musicVolumeRampFrameRef.current);
      musicVolumeRampFrameRef.current = null;
    }

    if (musicMuted) {
      audio.muted = true;
      currentMusicVolumeRef.current = audio.volume;
      return;
    }

    audio.muted = false;
    attemptPlayMusic();

    const startVolume = audio.volume;
    if (Math.abs(startVolume - targetVolume) < 0.001) {
      audio.volume = targetVolume;
      currentMusicVolumeRef.current = targetVolume;
      return;
    }

    const rampDurationMs = 2000;
    const rampStart = performance.now();
    const easeOut = (t: number) => 1 - (1 - t) ** 3;
    const animateVolume = (now: number) => {
      const elapsed = now - rampStart;
      const progress = Math.max(0, Math.min(1, elapsed / rampDurationMs));
      const nextVolume = startVolume + (targetVolume - startVolume) * easeOut(progress);
      audio.volume = nextVolume;
      currentMusicVolumeRef.current = nextVolume;
      if (progress < 1) {
        musicVolumeRampFrameRef.current = window.requestAnimationFrame(animateVolume);
        return;
      }
      musicVolumeRampFrameRef.current = null;
      audio.volume = targetVolume;
      currentMusicVolumeRef.current = targetVolume;
    };

    musicVolumeRampFrameRef.current = window.requestAnimationFrame(animateVolume);

    return () => {
      if (musicVolumeRampFrameRef.current != null) {
        window.cancelAnimationFrame(musicVolumeRampFrameRef.current);
        musicVolumeRampFrameRef.current = null;
      }
    };
  }, [attemptPlayMusic, musicMuted, ui.phase]);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_TRACK_STORAGE_KEY, selectedMusicTrackId);
      localStorage.setItem(MUSIC_MUTED_STORAGE_KEY, musicMuted ? '1' : '0');
    } catch {
      // Ignore localStorage failures.
    }
  }, [musicMuted, selectedMusicTrackId]);

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
    if (ui.phase === 'landing' && debugModal !== 'none') {
      setDebugModal('none');
      setDebugRpsVote('');
    }
  }, [debugModal, ui.phase]);

  useEffect(() => {
    if (ui.phase === 'post' || debugModal === 'postGame') {
      return;
    }
    if (confettiTimeoutRef.current != null) {
      window.clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = null;
    }
    if (confettiVisible) {
      setConfettiVisible(false);
    }
  }, [confettiVisible, debugModal, ui.phase]);

  const pushToast = useCallback(
    (
      title: string,
      description: string,
      tone: ToastMessage['tone'] = 'neutral'
    ) => {
      setToasts(current => [
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
    setToasts(current => current.filter(toast => toast.id !== id));
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
      actions.createLobby(
        GAME_TYPE_TUG_OF_WAR,
        roundSeconds,
        lockLobby,
        tieZonePercent
      )
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
      actions.setLobbySetting(
        lobby.lobbyId,
        'round_seconds',
        JSON.stringify(pendingRoundSeconds)
      )
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

    await withActionErrorToast('Could not join lobby', () =>
      actions.joinLobby(code, nextName)
    );
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

    await withActionErrorToast('Could not end match', () =>
      actions.endMatch(ui.lobby!.lobbyId)
    );
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

    await withActionErrorToast('Could not close post-game', () =>
      actions.closePostGame(lobbyId)
    );

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
      await withActionErrorToast('Could not activate power', () =>
        actions.activatePower(ui.matchHud!.matchId, powerId)
      );
    },
    [actions, ui.matchHud, withActionErrorToast]
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
      if (debugModal === 'rpsVoting') {
        setDebugRpsVote(choice);
        return;
      }
      if (!ui.rpsTieBreak) {
        return;
      }
      await withActionErrorToast('Could not submit tie-break vote', () =>
        actions.voteRps(ui.rpsTieBreak!.matchId, choice)
      );
    },
    [actions, debugModal, ui.rpsTieBreak, withActionErrorToast]
  );
  const handleContinueTieBreak = useCallback(async () => {
    if (debugModal === 'rpsReveal') {
      setDebugModal('none');
      return;
    }
    if (!ui.rpsTieBreak) {
      return;
    }
    await withActionErrorToast('Could not continue to post-game', () =>
      actions.continueTieBreak(ui.rpsTieBreak!.matchId)
    );
  }, [actions, debugModal, ui.rpsTieBreak, withActionErrorToast]);
  const fireConfettiBurst = useCallback(() => {
    setConfettiBurstKey(current => current + 1);
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

  const myTeam = useMemo(() => {
    if (!ui.lobby) {
      return '';
    }
    if (ui.lobby.teamA.some(player => player.isYou)) {
      return 'A';
    }
    if (ui.lobby.teamB.some(player => player.isYou)) {
      return 'B';
    }
    return '';
  }, [ui.lobby]);
  const postGameCloseSecondsRemaining = useMemo(() => {
    if (ui.phase !== 'post' || !ui.lobby) {
      return null;
    }
    const matchId = ui.matchHud?.matchId ?? '';
    let latestAtMicros = 0n;
    let dismissAtMicros: bigint | null = null;

    for (const event of snapshot.events) {
      if (event.lobbyId !== ui.lobby.lobbyId || event.type !== 'postgame_close_started') {
        continue;
      }
      if (matchId && event.matchId && event.matchId !== matchId) {
        continue;
      }
      if (event.atMicros < latestAtMicros) {
        continue;
      }
      const parsedDismissAt = parsePostGameDismissAtMicros(event.payloadJson);
      if (parsedDismissAt == null) {
        continue;
      }
      latestAtMicros = event.atMicros;
      dismissAtMicros = parsedDismissAt;
    }

    if (dismissAtMicros == null) {
      return null;
    }

    const nowMicros = BigInt(Math.trunc(nowMillis)) * 1000n;
    const remainingMicros = dismissAtMicros > nowMicros ? dismissAtMicros - nowMicros : 0n;
    return Math.max(0, Math.ceil(Number(remainingMicros) / 1_000_000));
  }, [nowMillis, snapshot.events, ui.lobby, ui.matchHud?.matchId, ui.phase]);

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

  const debugRpsModel = useMemo<RpsTieBreakViewModel | null>(() => {
    if (debugModal !== 'rpsVoting' && debugModal !== 'rpsReveal') {
      return null;
    }
    const isVoting = debugModal === 'rpsVoting';
    return {
      matchId: ui.matchHud?.matchId ?? 'debug-match',
      roundNumber: 2,
      stage: isVoting ? 'Voting' : 'Reveal',
      secondsRemaining: isVoting ? 8 : 0,
      canVote: isVoting && ui.role === 'player' && (myTeam === 'A' || myTeam === 'B'),
      myTeam: myTeam as 'A' | 'B' | '',
      myVote: isVoting ? debugRpsVote : '',
      myTeamCounts:
        ui.role === 'player' && (myTeam === 'A' || myTeam === 'B')
          ? { rock: 2, paper: 1, scissors: 0 }
          : null,
      opponentTeamCounts: isVoting ? null : { rock: 1, paper: 0, scissors: 3 },
      teamAChoice: 'paper',
      teamBChoice: 'rock',
      winnerTeam: 'A',
      canHostContinue: !isVoting && ui.role === 'host',
    };
  }, [debugModal, debugRpsVote, myTeam, ui.matchHud?.matchId, ui.role]);
  const teamTone = ui.lobby ? resolveTeamTone(ui.lobby) : 'neutral';
  const backgroundClassName =
    teamTone === 'teamA'
      ? 'team-bg-a'
      : teamTone === 'teamB'
        ? 'team-bg-b'
        : '';

  const headerMusicControls = (
    <div className="flex items-center gap-2">
      <select
        value={selectedMusicTrackId}
        onChange={event =>
          setSelectedMusicTrackId(event.target.value as MusicTrackId)
        }
        className="neo-focus h-9 rounded-[10px] border-4 border-neo-ink bg-neo-paper px-2 font-display text-xs font-bold uppercase tracking-wide text-neo-ink shadow-neo-sm"
        aria-label="Music track"
      >
        {MUSIC_TRACKS.map(track => (
          <option key={track.id} value={track.id}>
            {track.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="icon"
        variant="neutral"
        className="h-9 w-9"
        onClick={() => {
          setMusicMuted(current => !current);
        }}
        aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
        title={musicMuted ? 'Unmute music' : 'Mute music'}
      >
        {musicMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
    </div>
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
          />
        ) : null}
        {ui.playerInput ? (
          <PlayerInputPanel
            model={ui.playerInput}
            onSubmitWord={handleSubmitWord}
            onRecordMistake={handleRecordMistake}
            preMatch={!ui.matchHud || ui.matchHud.phase === 'PreGame'}
          />
        ) : null}
        {ui.role === 'host' && ui.lobby ? (
          <HostControlsPanel
            lobby={ui.lobby}
            hud={ui.matchHud}
            hostPanel={ui.hostPanel}
            onStartMatch={handleStartMatch}
            onResetLobby={handleResetLobby}
            onEndMatch={handleEndMatch}
          />
        ) : null}
        {ui.role === 'host' &&
        ui.hostPanel &&
        ui.matchHud &&
        (ui.matchHud.phase === 'InGame' || ui.matchHud.phase === 'SuddenDeath') ? (
          <HostPowerPanel
            powers={ui.hostPanel.powers}
            onActivatePower={handleActivatePower}
          />
        ) : null}
      </>
    );

  const secondary = (
    <EventFeed
      events={ui.events}
      headerAction={
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Badge variant="neutral">Role {ui.role}</Badge>
          <Button
            type="button"
            size="sm"
            variant={debugModal === 'countdown' ? 'teamB' : 'neutral'}
            onClick={() => {
              setDebugModal(current => (current === 'countdown' ? 'none' : 'countdown'));
            }}
          >
            DBG Countdown
          </Button>
          <Button
            type="button"
            size="sm"
            variant={debugModal === 'rpsVoting' ? 'teamB' : 'neutral'}
            onClick={() => {
              setDebugRpsVote('');
              setDebugModal(current => (current === 'rpsVoting' ? 'none' : 'rpsVoting'));
            }}
          >
            DBG RPS Vote
          </Button>
          <Button
            type="button"
            size="sm"
            variant={debugModal === 'rpsReveal' ? 'teamB' : 'neutral'}
            onClick={() => {
              setDebugModal(current => (current === 'rpsReveal' ? 'none' : 'rpsReveal'));
            }}
          >
            DBG RPS Reveal
          </Button>
          <Button
            type="button"
            size="sm"
            variant={debugModal === 'postGame' ? 'teamB' : 'neutral'}
            disabled={!ui.lobby}
            onClick={() => {
              setDebugModal(current => (current === 'postGame' ? 'none' : 'postGame'));
            }}
          >
            DBG Post Game
          </Button>
          <Button
            type="button"
            size="sm"
            variant="neutral"
            onClick={() => {
              localStorage.removeItem('auth_token');
              window.location.reload();
            }}
          >
            Reset Session
          </Button>
        </div>
      }
    />
  );

  const showCountdownOverlay =
    debugModal === 'countdown' ||
    (ui.matchHud?.phase === 'PreGame' &&
      ui.matchHud.secondsRemaining != null &&
      ui.matchHud.secondsRemaining > 0);

  return (
    <ToastProvider duration={2200} swipeDirection="right">
      <AppShell
        backgroundClassName={backgroundClassName}
        banner={<ConnectionBanner state={state} errorMessage={errorMessage} />}
        header={
          <HeaderBar
            connectionState={state}
            lobbyCode={ui.lobby?.joinCode ?? ''}
            onCopyLobbyCode={() => {
              void handleCopyLobbyCode();
            }}
            musicControls={headerMusicControls}
          />
        }
        primary={primary}
        secondary={secondary}
      />
      <CountdownOverlay
        visible={showCountdownOverlay}
        secondsRemaining={debugModal === 'countdown' ? 3 : ui.matchHud?.secondsRemaining ?? null}
      />
      <ConfettiBurst burstKey={confettiBurstKey} visible={confettiVisible} />
      <RpsTieBreakModal
        model={debugRpsModel ?? ui.rpsTieBreak}
        role={ui.role}
        onVote={handleVoteRps}
        onContinue={handleContinueTieBreak}
      />
      <PostGameStatsModal
        open={debugModal === 'postGame' ? true : postGameModalOpen}
        onClose={() => {
          if (debugModal === 'postGame') {
            setDebugModal('none');
            return;
          }
          void handleClosePostGame();
        }}
        onResetMatch={handleResetLobby}
        onDebugConfetti={fireConfettiBurst}
        role={ui.role}
        lobby={ui.lobby}
        hud={ui.matchHud}
        waitingForHostSeconds={ui.role === 'player' ? postGameCloseSecondsRemaining : null}
      />

      {toasts.map(toast => (
        <Toast
          key={toast.id}
          open
          onOpenChange={open => {
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
