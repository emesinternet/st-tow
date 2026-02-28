import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { HeaderBar } from '@/components/layout/HeaderBar';
import { HostControlsPanel } from '@/components/host/HostControlsPanel';
import { LandingPanel } from '@/components/lobby/LandingPanel';
import { LobbyOverview } from '@/components/lobby/LobbyOverview';
import { MatchHud } from '@/components/match/MatchHud';
import { PlayerInputPanel } from '@/components/player/PlayerInputPanel';
import { EventFeed } from '@/components/shared/EventFeed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/shared/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shared/ui/tabs';
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/shared/ui/toast';
import { useSpacetimeSession } from '@/data/useSpacetimeSession';
import { selectUiViewModel } from '@/lib/selectors';
import type { ToastMessage } from '@/types/ui';

const GAME_TYPE_TUG_OF_WAR = 'tug_of_war';

function makeToastId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const { state, identity, errorMessage, snapshot, actions } = useSpacetimeSession();

  const [displayName, setDisplayName] = useState('Player');
  const [joinCode, setJoinCode] = useState('');
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  const [selectedLobbyId, setSelectedLobbyId] = useState('');
  const [mobilePanelsOpen, setMobilePanelsOpen] = useState(false);
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
        {ui.lobby ? <LobbyOverview lobby={ui.lobby} /> : null}
        {ui.matchHud ? <MatchHud hud={ui.matchHud} /> : null}
        <PlayerInputPanel
          model={ui.playerInput}
          currentWord={ui.matchHud?.currentWord ?? ''}
          wordVersion={ui.matchHud?.wordVersion ?? 0}
          onSubmitWord={handleSubmitWord}
        />
        {ui.phase === 'post' ? (
          <Card className="bg-neo-yellow/70">
            <CardHeader>
              <CardTitle className="text-xl">Round Complete</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-body text-sm">
                {ui.matchHud?.winnerTeam
                  ? `Team ${ui.matchHud.winnerTeam} wins. Host can reset for a rematch.`
                  : 'Match ended. Host can reset for a rematch.'}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </>
    );

  const secondary = (
    <>
      <HostControlsPanel
        lobby={ui.lobby}
        hud={ui.matchHud}
        hostPanel={ui.hostPanel}
        onStartMatch={handleStartMatch}
        onResetLobby={handleResetLobby}
        onEndMatch={handleEndMatch}
      />
      <EventFeed events={ui.events} />
    </>
  );

  return (
    <ToastProvider duration={2200} swipeDirection="right">
      <AppShell
        banner={<ConnectionBanner state={state} errorMessage={errorMessage} />}
        header={
          <HeaderBar
            connectionState={state}
            role={ui.role}
            phase={ui.phase}
            lobbyCode={ui.lobby?.joinCode ?? ''}
            lobbyStatus={ui.lobby?.status ?? ''}
            onOpenPanels={() => setMobilePanelsOpen(true)}
          />
        }
        primary={primary}
        secondary={secondary}
      />

      <Sheet open={mobilePanelsOpen} onOpenChange={setMobilePanelsOpen}>
        <SheetContent side="right" className="lg:hidden">
          <SheetHeader>
            <SheetTitle>Role Panels</SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="controls">
            <TabsList>
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>
            <TabsContent value="controls">
              <HostControlsPanel
                lobby={ui.lobby}
                hud={ui.matchHud}
                hostPanel={ui.hostPanel}
                onStartMatch={handleStartMatch}
                onResetLobby={handleResetLobby}
                onEndMatch={handleEndMatch}
              />
            </TabsContent>
            <TabsContent value="events">
              <EventFeed events={ui.events} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

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

      <button
        type="button"
        className="neo-focus fixed bottom-3 left-3 z-[120] rounded-[10px] border-4 border-neo-ink bg-neo-paper px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-neo-ink shadow-neo-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-neo-pressed"
        onClick={() => {
          localStorage.removeItem('auth_token');
          window.location.reload();
        }}
      >
        Debug: Reset Session
      </button>
    </ToastProvider>
  );
}
