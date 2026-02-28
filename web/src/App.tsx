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
import { Button } from '@/components/shared/ui/button';
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/shared/ui/toast';
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
  const [roundMinutes, setRoundMinutes] = useState(1);
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
  const confettiTimeoutRef = useRef<number | null>(null);

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
    const roundSeconds = Math.max(1, Math.min(60, Math.trunc(roundMinutes))) * 60;
    const tieZonePercent = TIE_ZONE_PERCENT_BY_SIZE[tieZoneSize];
    await withActionErrorToast('Could not create lobby', () =>
      actions.createLobby(GAME_TYPE_TUG_OF_WAR, roundSeconds, tieZonePercent)
    );
    setPendingRoundSeconds(roundSeconds);
  }, [actions, roundMinutes, tieZoneSize, withActionErrorToast]);

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

  const primary =
    ui.phase === 'landing' ? (
      <LandingPanel
        displayName={displayName}
        joinCode={joinCode}
        roundMinutes={roundMinutes}
        tieZoneSize={tieZoneSize}
        onDisplayNameChange={setDisplayName}
        onJoinCodeChange={setJoinCode}
        onRoundMinutesChange={setRoundMinutes}
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
            role={ui.role}
            phase={ui.phase}
            lobbyCode={ui.lobby?.joinCode ?? ''}
            lobbyStatus={ui.lobby?.status ?? ''}
            controls={
              ui.role === 'host' ? (
                <HostControlsPanel
                  lobby={ui.lobby}
                  hud={ui.matchHud}
                  hostPanel={ui.hostPanel}
                  onStartMatch={handleStartMatch}
                  onResetLobby={handleResetLobby}
                  onEndMatch={handleEndMatch}
                  variant="inline"
                />
              ) : null
            }
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
