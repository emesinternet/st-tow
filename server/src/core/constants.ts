export const GAME_TYPE_TUG_OF_WAR = 'tug_of_war';

export const LOBBY_STATUS_WAITING = 'Waiting';
export const LOBBY_STATUS_RUNNING = 'Running';
export const LOBBY_STATUS_SUDDEN_DEATH = 'SuddenDeath';
export const LOBBY_STATUS_FINISHED = 'Finished';

export const MATCH_PHASE_PRE_GAME = 'PreGame';
export const MATCH_PHASE_IN_GAME = 'InGame';
export const MATCH_PHASE_SUDDEN_DEATH = 'SuddenDeath';
export const MATCH_PHASE_TIE_BREAK_RPS = 'TieBreakRps';
export const MATCH_PHASE_POST_GAME = 'PostGame';

export const PLAYER_STATUS_ACTIVE = 'Active';
export const PLAYER_STATUS_ELIMINATED = 'Eliminated';
export const PLAYER_STATUS_LEFT = 'Left';

export const TEAM_A = 'A';
export const TEAM_B = 'B';

export const TUG_MODE_NORMAL = 'Normal';
export const TUG_MODE_ELIMINATION = 'Elimination';

export const WORD_MODE_NORMAL = 'Normal';
export const WORD_MODE_TECH = 'Tech';
export const WORD_MODE_SYMBOLS = 'Symbols';

export const HOST_POWER_TECH_MODE_BURST = 'tech_mode_burst';
export const HOST_POWER_SYMBOLS_MODE_BURST = 'symbols_mode_burst';
export const HOST_POWER_DIFFICULTY_UP_BURST = 'difficulty_up_burst';

export const DEFAULT_LOBBY_SETTINGS: Record<string, number> = {
  round_seconds: 90,
  lock_in_progress_join: 0,
  tie_zone_percent: 10,
  win_threshold: 100,
  word_rotate_ms: 3000,
  elimination_word_time_ms: 1800,
  tick_rate_ms: 250,
};

export const LOBBY_SETTING_KEYS = {
  round_seconds: 'round_seconds',
  lock_in_progress_join: 'lock_in_progress_join',
  tie_zone_percent: 'tie_zone_percent',
  win_threshold: 'win_threshold',
  word_rotate_ms: 'word_rotate_ms',
  elimination_word_time_ms: 'elimination_word_time_ms',
  tick_rate_ms: 'tick_rate_ms',
} as const;
