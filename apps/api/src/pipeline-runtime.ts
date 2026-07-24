import { randomUUID } from 'node:crypto';
import { providerConfiguration } from './fixture-provider.js';
import { OLYMPIAN_ENGINE_VERSION } from './god-picks.js';
import { predictionWindow, syncUpcomingPredictions } from './prediction-service.js';
import { setPipelineRunning } from './pipeline-state.js';

type PipelineTrigger = 'startup' | 'daily' | 'public-refresh' | 'admin-sync';
type PipelineRunStatus = 'running' | 'succeeded' | 'failed';

type PipelineRun = {
  id: string;
  trigger: PipelineTrigger;
  status: PipelineRunStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  result?: Record<string, unknown>;
};

type PipelineRequestResult = {
  accepted: boolean;
  joined: boolean;
  coolingDown: boolean;
  retryAfterSeconds: number;
  run: PipelineRun;
};

const recentRuns: PipelineRun[] = [];
let activeRunPromise: Promise<PipelineRun> | null = null;
let activeRun: PipelineRun | null = null;
let scheduler: NodeJS.Timeout | null = null;
let lastDailyDate = '';
let lastPublicRefreshAcceptedAt = 0;

function booleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  return value == null ? fallback : String(value).toLowerCase() !== 'false';
}

function numberEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function timezoneParts(date = new Date()) {
  const timeZone = process.env.PREDICTION_TIMEZONE || 'Africa/Accra';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function compactResult(value: Awaited<ReturnType<typeof syncUpcomingPredictions>>) {
  return {
    window: value.window,
    fixtures: value.fixtures,
    fixturesWith1X2: value.fixturesWith1X2,
    fixtureLeagues: value.fixtureLeagues,
    predictions: value.predictions,
    godPicksPublished: value.godPicksPublished,
    chronosPicks: value.chronosPicks,
    athenaPicks: value.athenaPicks,
    aresPicks: value.aresPicks,
    zeusAutoPicks: value.zeusAutoPicks,
    providerMode: value.providers.mode,
    apiFootballFixtures: value.providers.apiFootball.fixtures,
    oddsApiFallbackUsed: value.providers.oddsApi.usedAsFallback,
    oddsApiFixtures: value.providers.oddsApi.fixtures,
    oddsApiTriggerReasons: value.providers.oddsApi.triggerReasons,
    apiFootball1X2Coverage: value.providers.oddsApi.primaryCoverage,
    apiFootballExtendedCoverage: value.providers.oddsApi.extendedCoverage,
    warnings: value.providers.warnings
  };
}

function pushRun(run: PipelineRun) {
  recentRuns.unshift(run);
  if (recentRuns.length > 20) recentRuns.length = 20;
}

async function executePipeline(trigger: PipelineTrigger) {
  const run: PipelineRun = {
    id: randomUUID(),
    trigger,
    status: 'running',
    startedAt: new Date().toISOString()
  };
  activeRun = run;
  setPipelineRunning(true);
  pushRun(run);
  const started = Date.now();
  console.log(`[Betynz pipeline] ${trigger} rebuild ${run.id} started.`);
  try {
    const result = await syncUpcomingPredictions();
    run.status = 'succeeded';
    run.result = compactResult(result);
    console.log(`[Betynz pipeline] ${trigger} rebuild ${run.id} completed with ${result.zeusAutoPicks} Zeus picks.`);
  } catch (error) {
    run.status = 'failed';
    run.error = error instanceof Error ? error.message : String(error);
    console.error(`[Betynz pipeline] ${trigger} rebuild ${run.id} failed:`, error);
  } finally {
    run.completedAt = new Date().toISOString();
    run.durationMs = Date.now() - started;
    activeRun = null;
    setPipelineRunning(false);
  }
  return run;
}

export async function requestPipelineRebuild(trigger: PipelineTrigger, force = false): Promise<PipelineRequestResult> {
  if (activeRunPromise) {
    const joinedRun = await activeRunPromise;
    return { accepted: true, joined: true, coolingDown: false, retryAfterSeconds: 0, run: joinedRun };
  }

  const cooldownMs = numberEnv('PIPELINE_PUBLIC_REFRESH_COOLDOWN_MS', 300_000, 15_000, 3_600_000);
  if (trigger === 'public-refresh' && !force) {
    const elapsed = Date.now() - lastPublicRefreshAcceptedAt;
    if (lastPublicRefreshAcceptedAt && elapsed < cooldownMs) {
      const prior = recentRuns.find((run) => run.trigger === 'public-refresh') ?? recentRuns[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000));
      return {
        accepted: false,
        joined: false,
        coolingDown: true,
        retryAfterSeconds,
        run: prior ?? {
          id: 'cooldown',
          trigger,
          status: 'succeeded',
          startedAt: new Date(lastPublicRefreshAcceptedAt).toISOString(),
          completedAt: new Date(lastPublicRefreshAcceptedAt).toISOString()
        }
      };
    }
    lastPublicRefreshAcceptedAt = Date.now();
  }

  activeRunPromise = executePipeline(trigger);
  try {
    const run = await activeRunPromise;
    return { accepted: true, joined: false, coolingDown: false, retryAfterSeconds: 0, run };
  } finally {
    activeRunPromise = null;
  }
}

function checkDailySchedule() {
  if (!booleanEnv('PIPELINE_DAILY_REBUILD_ENABLED', true) || activeRunPromise) return;
  const current = timezoneParts();
  const hour = numberEnv('PIPELINE_DAILY_HOUR', 3, 0, 23);
  const minute = numberEnv('PIPELINE_DAILY_MINUTE', 15, 0, 59);
  if (current.date === lastDailyDate) return;
  if (current.hour < hour || (current.hour === hour && current.minute < minute)) return;
  lastDailyDate = current.date;
  void requestPipelineRebuild('daily');
}

export function startAutomaticPipeline() {
  if (scheduler) return;
  if (booleanEnv('PIPELINE_STARTUP_REBUILD_ENABLED', true)) {
    const current = timezoneParts();
    const hour = numberEnv('PIPELINE_DAILY_HOUR', 3, 0, 23);
    const minute = numberEnv('PIPELINE_DAILY_MINUTE', 15, 0, 59);
    if (current.hour > hour || (current.hour === hour && current.minute >= minute)) lastDailyDate = current.date;
    void requestPipelineRebuild('startup');
  }
  scheduler = setInterval(checkDailySchedule, 30_000);
  scheduler.unref();
  checkDailySchedule();
}

export function pipelineDiagnostics() {
  const successful = recentRuns.find((run) => run.status === 'succeeded');
  const failed = recentRuns.find((run) => run.status === 'failed');
  return {
    private: true,
    engineVersion: OLYMPIAN_ENGINE_VERSION,
    now: new Date().toISOString(),
    window: predictionWindow(),
    running: Boolean(activeRunPromise),
    activeRun,
    lastSuccessfulRun: successful ?? null,
    lastFailedRun: failed ?? null,
    recentRuns,
    schedule: {
      timezone: process.env.PREDICTION_TIMEZONE || 'Africa/Accra',
      startupEnabled: booleanEnv('PIPELINE_STARTUP_REBUILD_ENABLED', true),
      dailyEnabled: booleanEnv('PIPELINE_DAILY_REBUILD_ENABLED', true),
      dailyHour: numberEnv('PIPELINE_DAILY_HOUR', 3, 0, 23),
      dailyMinute: numberEnv('PIPELINE_DAILY_MINUTE', 15, 0, 59),
      publicRefreshCooldownMs: numberEnv('PIPELINE_PUBLIC_REFRESH_COOLDOWN_MS', 300_000, 15_000, 3_600_000)
    },
    providers: providerConfiguration()
  };
}
