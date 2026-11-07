/*
 * Display helpers for the muscle freshness endpoint.
 *
 * The split definitions mirror wger/dynamic_coach/services/session_builder.py.
 * They only drive the "Auto would pick ..." hint, the server makes the real choice.
 */

export type Split = 'auto' | 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body';
export type ConcreteSplit = Exclude<Split, 'auto'>;
export type FreshnessStatus = 'fatigued' | 'recovering' | 'ready';

export interface MuscleFreshness {
     
    muscle_id: number;
    name: string;
     
    freshness_pct: number;
    status: FreshnessStatus;
}

export type MuscleGroupKey =
    'chest' | 'shoulders' | 'triceps' | 'lats' | 'upperBack' | 'biceps' | 'quads' | 'hamstrings'
    | 'glutes' | 'calves' | 'core';

export interface MuscleGroup {
    key: MuscleGroupKey;
    muscleIds: number[];
}

/* Muscle ids of the standard wger muscle fixtures, grouped for display */
export const MUSCLE_GROUPS: MuscleGroup[] = [
    { key: 'chest', muscleIds: [4] },
    { key: 'shoulders', muscleIds: [2] },
    { key: 'triceps', muscleIds: [5] },
    { key: 'lats', muscleIds: [12] },
    { key: 'upperBack', muscleIds: [9] },
    { key: 'biceps', muscleIds: [1, 13] },
    { key: 'quads', muscleIds: [10] },
    { key: 'hamstrings', muscleIds: [11] },
    { key: 'glutes', muscleIds: [8] },
    { key: 'calves', muscleIds: [7, 15] },
    { key: 'core', muscleIds: [3, 6, 14, 16] },
];

const SPLIT_MUSCLES: Record<'push' | 'pull' | 'legs', number[]> = {
    push: [4, 2, 5],
    pull: [12, 9, 1, 13],
    legs: [10, 11, 8, 7, 15],
};

export const SPLITS: Split[] = ['auto', 'push', 'pull', 'legs', 'upper', 'lower', 'full_body'];

export interface GroupFreshness {
    key: MuscleGroupKey;
    pct: number;
    status: FreshnessStatus;
}

export const statusFor = (pct: number): FreshnessStatus =>
    pct < 40 ? 'fatigued' : pct < 75 ? 'recovering' : 'ready';

/* Mean freshness of each display group; groups the server did not report are left out */
export const groupFreshness = (muscles: MuscleFreshness[]): GroupFreshness[] => {
    const byId = new Map(muscles.map(m => [m.muscle_id, m.freshness_pct]));
    const out: GroupFreshness[] = [];
    for (const group of MUSCLE_GROUPS) {
        const values = group.muscleIds.filter(id => byId.has(id)).map(id => byId.get(id)!);
        if (values.length === 0) {
            continue;
        }
        const pct = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        out.push({ key: group.key, pct, status: statusFor(pct) });
    }
    return out;
};

/* The push/pull/legs group with the highest mean freshness, and that mean. Null without data. */
export const suggestSplit = (muscles: MuscleFreshness[]): { split: ConcreteSplit, pct: number } | null => {
    const byId = new Map(muscles.map(m => [m.muscle_id, m.freshness_pct]));
    let best: { split: ConcreteSplit, pct: number } | null = null;
    for (const split of ['push', 'pull', 'legs'] as const) {
        // muscles with no data count as fully fresh, like the server does
        const values = SPLIT_MUSCLES[split].map(id => byId.get(id) ?? 100);
        const pct = values.reduce((a, b) => a + b, 0) / values.length;
        if (best === null || pct > best.pct) {
            best = { split, pct };
        }
    }
    return muscles.length === 0 ? null : best;
};

/* Mirrors the server's NumExercises = clamp(duration / 10, 3, 7) */
export const exerciseCount = (durationMin: number): number =>
    Math.max(3, Math.min(7, Math.floor(durationMin / 10)));
