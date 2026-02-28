import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { HeaderBar } from '@/components/layout/HeaderBar';
import { HostControlsPanel } from '@/components/host/HostControlsPanel';
import { LandingPanel } from '@/components/lobby/LandingPanel';
import { MatchHud } from '@/components/match/MatchHud';
import { PlayerInputPanel } from '@/components/player/PlayerInputPanel';
import { EventFeed } from '@/components/shared/EventFeed';
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
import type { MatchHudViewModel, ToastMessage } from '@/types/ui';

const GAME_TYPE_TUG_OF_WAR = 'tug_of_war';
const DEFAULT_ROUND_SECONDS = 90;

function makeToastId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseSettingInt(valueJson: string): number | null {
  try {
    const parsed = JSON.parse(valueJson);
    const number = Number(parsed);
    return Number.isFinite(number) ? Math.trunc(number) : null;
  } catch {
    const number = Number(valueJson);
    return Number.isFinite(number) ? Math.trunc(number) : null;
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
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  const [selectedLobbyId, setSelectedLobbyId] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const ui = useMemo(
    () =>
      selectUiViewModel({
        connectionState: state,
        snapshot,
        identity,
        selectedLobbyId,
        pendingJoinCode,
      }),
    [identity, pendingJoinCode, selectedLobbyId, snapshot, state]
  );

  useEffect(() => {
    if (ui.lobby && ui.lobby.lobbyId !== selectedLobbyId) {
      setSelectedLobbyId(ui.lobby.lobbyId);
    }
  }, [selectedLobbyId, ui.lobby]);

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
    await withActionErrorToast('Could not create lobby', () =>
      actions.createLobby(GAME_TYPE_TUG_OF_WAR)
    );
  }, [actions, withActionErrorToast]);

  const handleJoinLobby = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      pushToast('Missing join code', 'Enter a valid lobby code first.', 'neutral');
      return;
    }

    const nextName = displayName.trim() || 'Player';
    setPendingJoinCode(code);

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

  const preMatchRoundSeconds = useMemo(() => {
    if (!ui.lobby) {
      return DEFAULT_ROUND_SECONDS;
    }

    const row = snapshot.lobbySettings.find(
      setting =>
        setting.lobbyId === ui.lobby!.lobbyId &&
        setting.key === 'round_seconds'
    );
    if (!row) {
      return DEFAULT_ROUND_SECONDS;
    }

    return parseSettingInt(row.valueJson) ?? DEFAULT_ROUND_SECONDS;
  }, [snapshot.lobbySettings, ui.lobby]);

  const preMatchHud: MatchHudViewModel = {
    matchId: ui.lobby?.lobbyId ?? 'preview',
    phase: 'PreGame',
    secondsRemaining: preMatchRoundSeconds,
    winnerTeam: '',
    ropePosition: 0,
    normalizedRopePosition: 50,
    winThreshold: 100,
    teamAForce: 0,
    teamBForce: 0,
    aliveTeamA: 0,
    aliveTeamB: 0,
    currentWord: '',
    wordVersion: 0,
    mode: 'Normal',
    suddenDeathDeadlineMicros: null,
  };
  const hideTypingPanel = ui.role === 'host' && ui.matchHud != null;
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
        onDisplayNameChange={setDisplayName}
        onJoinCodeChange={setJoinCode}
        onJoin={handleJoinLobby}
        onCreateLobby={handleCreateLobby}
      />
    ) : (
      <>
        <MatchHud hud={ui.matchHud ?? preMatchHud} />
        {!hideTypingPanel ? (
          <PlayerInputPanel
            model={ui.playerInput}
            onSubmitWord={handleSubmitWord}
            preMatch={!ui.matchHud}
          />
        ) : null}
      </>
    );

  const secondary = (
    <EventFeed
      events={ui.events}
      headerAction={
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
      }
    />
  );

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
