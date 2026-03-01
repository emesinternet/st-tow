import fs from 'node:fs';
import path from 'node:path';
import type { BotMetrics, LiveRunMetrics, StressConfig, StressRunReport } from './types';

export function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function mapToObjectNumeric(map: Map<string, number>): Record<string, number> {
  const entries = Array.from(map.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  return Object.fromEntries(entries);
}

function topEventCounts(
  eventCounts: Map<string, number>,
  topN = 10
): Array<{ type: string; count: number }> {
  return Array.from(eventCounts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, topN)
    .map(([type, count]) => ({ type, count }));
}

export function buildStressReport(
  config: StressConfig,
  run: LiveRunMetrics,
  bots: BotMetrics[],
  submitPerMinute: Map<number, number>
): StressRunReport {
  const joinAttempted = bots.filter((bot) => bot.joinAttempted).length;
  const joined = bots.filter((bot) => bot.joinSucceeded).length;
  const joinLatencies = bots
    .map((bot) => bot.joinLatencyMs)
    .filter((value): value is number => value != null && value >= 0);

  const submitAttempts = bots.reduce((sum, bot) => sum + bot.submitAttempts, 0);
  const submitSuccesses = bots.reduce((sum, bot) => sum + bot.submitSuccesses, 0);
  const submitErrors = bots.reduce((sum, bot) => sum + bot.submitErrors, 0);

  const voteAttempts = bots.reduce((sum, bot) => sum + bot.voteAttempts, 0);
  const voteSuccesses = bots.reduce((sum, bot) => sum + bot.voteSuccesses, 0);
  const voteErrors = bots.reduce((sum, bot) => sum + bot.voteErrors, 0);

  const disconnects = bots.reduce((sum, bot) => sum + bot.disconnects, 0);
  const reconnects = bots.reduce((sum, bot) => sum + bot.reconnects, 0);

  const perMinuteObject: Record<string, number> = {};
  for (const [minute, count] of Array.from(submitPerMinute.entries()).sort((a, b) => a[0] - b[0])) {
    perMinuteObject[String(minute)] = count;
  }

  const successRate = submitAttempts > 0 ? submitSuccesses / submitAttempts : 0;

  return {
    config,
    generatedAtIso: new Date().toISOString(),
    join: {
      attempted: joinAttempted,
      succeeded: joined,
      failed: Math.max(0, joinAttempted - joined),
      medianLatencyMs: median(joinLatencies),
    },
    submit: {
      attempts: submitAttempts,
      successes: submitSuccesses,
      errors: submitErrors,
      successRate,
      perMinute: perMinuteObject,
    },
    vote: {
      attempts: voteAttempts,
      successes: voteSuccesses,
      errors: voteErrors,
    },
    connection: {
      disconnects,
      reconnects,
    },
    matchFlow: {
      lobbyDetectedAtIso: run.lobbyDetectedAtMs
        ? new Date(run.lobbyDetectedAtMs).toISOString()
        : null,
      matchDetectedAtIso: run.matchDetectedAtMs
        ? new Date(run.matchDetectedAtMs).toISOString()
        : null,
      inGameStartedAtIso: run.inGameStartedAtMs
        ? new Date(run.inGameStartedAtMs).toISOString()
        : null,
      runEndedAtIso: new Date(run.runEndedAtMs).toISOString(),
      rpsEntered: run.rpsEntered,
      rpsRoundsSeen: run.rpsRoundsSeen.size,
      phaseDurationsMs: mapToObjectNumeric(run.phaseDurationsMs),
    },
    eventCountsTop: topEventCounts(run.eventCounts),
    bots,
  };
}

function formatRate(numerator: number, denominator: number): string {
  if (denominator <= 0) {
    return '0%';
  }
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export function renderStressReport(report: StressRunReport): string {
  const lines: string[] = [];

  lines.push('=== Typing Fever Live Stress Report ===');
  lines.push(`Generated: ${report.generatedAtIso}`);
  lines.push(`Host: ${report.config.host}`);
  lines.push(`DB: ${report.config.dbName}`);
  lines.push(`Bots: ${report.config.bots}`);
  lines.push(`Duration (min): ${report.config.durationMin}`);
  lines.push('');

  lines.push('[Join]');
  lines.push(
    `attempted=${report.join.attempted} succeeded=${report.join.succeeded} failed=${report.join.failed} median_latency_ms=${report.join.medianLatencyMs.toFixed(
      1
    )}`
  );
  lines.push('');

  lines.push('[Submit]');
  lines.push(
    `attempts=${report.submit.attempts} successes=${report.submit.successes} errors=${report.submit.errors} success_rate=${formatRate(
      report.submit.successes,
      report.submit.attempts
    )}`
  );
  lines.push(`per_minute=${JSON.stringify(report.submit.perMinute)}`);
  lines.push('');

  lines.push('[RPS Votes]');
  lines.push(
    `attempts=${report.vote.attempts} successes=${report.vote.successes} errors=${report.vote.errors}`
  );
  lines.push('');

  lines.push('[Connections]');
  lines.push(
    `disconnects=${report.connection.disconnects} reconnects=${report.connection.reconnects}`
  );
  lines.push('');

  lines.push('[Match Flow]');
  lines.push(
    `lobby=${report.matchFlow.lobbyDetectedAtIso ?? '-'} match=${report.matchFlow.matchDetectedAtIso ?? '-'} ingame=${report.matchFlow.inGameStartedAtIso ?? '-'} ended=${report.matchFlow.runEndedAtIso}`
  );
  lines.push(
    `rps_entered=${report.matchFlow.rpsEntered} rps_rounds_seen=${report.matchFlow.rpsRoundsSeen}`
  );
  lines.push(`phase_durations_ms=${JSON.stringify(report.matchFlow.phaseDurationsMs)}`);

  if (report.eventCountsTop.length > 0) {
    lines.push('');
    lines.push('[Top Events]');
    for (const eventCount of report.eventCountsTop) {
      lines.push(`${eventCount.type}: ${eventCount.count}`);
    }
  }

  return lines.join('\n');
}

export function writeReportJson(report: StressRunReport, reportPath: string): void {
  const absolutePath = path.isAbsolute(reportPath)
    ? reportPath
    : path.resolve(process.cwd(), reportPath);
  const parentDir = path.dirname(absolutePath);
  fs.mkdirSync(parentDir, { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
