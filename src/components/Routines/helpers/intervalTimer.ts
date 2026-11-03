/* eslint-disable camelcase */

/*
 * Pure helpers for the interval timer (tabata, HIIT, EMOM).
 *
 * The server expands a config into a flat list of timed phases (see
 * wger/manager/interval_timer.py), so this only has to find out which phase
 * is active at a given moment. The caller owns the clock.
 */

export type PhaseType = 'warmup' | 'work' | 'rest' | 'set_rest' | 'cooldown';

export interface IntervalConfig {
    version?: number;
    warmup_s: number;
    work_s: number;
    rest_s: number;
    rounds: number;
    sets: number;
    set_rest_s: number;
    cooldown_s: number;
}

export interface IntervalPhase {
    type: PhaseType;
    duration_s: number;
    start_s: number;
    set: number | null;
    round: number | null;
}

export interface IntervalPlan {
    config: IntervalConfig;
    total_duration_s: number;
    total_work_s: number;
    phases: IntervalPhase[];
}

export interface IntervalPreset {
    name: string;
    type: string;
    config: IntervalConfig;
}

export const DEFAULT_INTERVAL_CONFIG: IntervalConfig = {
    version: 1,
    warmup_s: 0,
    work_s: 20,
    rest_s: 10,
    rounds: 8,
    sets: 1,
    set_rest_s: 60,
    cooldown_s: 0,
};

export interface PhaseState {
    index: number;
    phase: IntervalPhase;
    next: IntervalPhase | null;
    /** milliseconds left in the current phase */
    remainingMs: number;
    /** 0..1 progress through the whole plan */
    progress: number;
    finished: boolean;
}

/*
 * The phase that is active `elapsedMs` after the start, or null for an empty plan
 */
export const phaseAt = (plan: IntervalPlan, elapsedMs: number): PhaseState | null => {
    const phases = plan.phases;
    if (phases.length === 0) {
        return null;
    }

    const totalMs = plan.total_duration_s * 1000;
    const elapsed = Math.max(0, elapsedMs);

    if (elapsed >= totalMs) {
        const last = phases[phases.length - 1];
        return { index: phases.length - 1, phase: last, next: null, remainingMs: 0, progress: 1, finished: true };
    }

    let index = 0;
    for (let i = 0; i < phases.length; i++) {
        if (phases[i].start_s * 1000 <= elapsed) {
            index = i;
        } else {
            break;
        }
    }

    const phase = phases[index];
    return {
        index,
        phase,
        next: phases[index + 1] ?? null,
        remainingMs: (phase.start_s + phase.duration_s) * 1000 - elapsed,
        progress: totalMs > 0 ? elapsed / totalMs : 1,
        finished: false,
    };
};

/* mm:ss, rounding partial seconds up so the display reaches 0:00 exactly at the end */
export const formatClock = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/* Short human readable summary, e.g. "20s / 10s x 8" or "20s / 10s x 8, 2 sets" */
export const describeConfig = (c: IntervalConfig): string => {
    const base = `${c.work_s}s / ${c.rest_s}s x ${c.rounds}`;
    return c.sets > 1 ? `${base}, ${c.sets} sets` : base;
};

/* Whole-number fields the form edits, in display order */
export const CONFIG_FIELDS = [
    'warmup_s', 'work_s', 'rest_s', 'rounds', 'sets', 'set_rest_s', 'cooldown_s',
] as const satisfies readonly (keyof IntervalConfig)[];
