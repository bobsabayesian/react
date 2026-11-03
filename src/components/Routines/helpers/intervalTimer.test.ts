import {
    DEFAULT_INTERVAL_CONFIG,
    describeConfig,
    formatClock,
    IntervalPlan,
    phaseAt,
} from "@/components/Routines/helpers/intervalTimer";

// 2 x work 20 / rest 10, as the server builds it (no rest after the last round)
const plan: IntervalPlan = {
    config: { ...DEFAULT_INTERVAL_CONFIG, rounds: 2 },
    total_duration_s: 50,
    total_work_s: 40,
    phases: [
        { type: 'work', duration_s: 20, start_s: 0, set: 1, round: 1 },
        { type: 'rest', duration_s: 10, start_s: 20, set: 1, round: 1 },
        { type: 'work', duration_s: 20, start_s: 30, set: 1, round: 2 },
    ],
};

describe('phaseAt', () => {
    test('starts in the first phase', () => {
        const state = phaseAt(plan, 0)!;
        expect(state.index).toBe(0);
        expect(state.remainingMs).toBe(20000);
        expect(state.next?.type).toBe('rest');
        expect(state.finished).toBe(false);
    });

    test('switches exactly on the boundary', () => {
        expect(phaseAt(plan, 19999)!.index).toBe(0);
        expect(phaseAt(plan, 20000)!.index).toBe(1);
        expect(phaseAt(plan, 30000)!.index).toBe(2);
    });

    test('reports remaining time and progress', () => {
        const state = phaseAt(plan, 25000)!;
        expect(state.phase.type).toBe('rest');
        expect(state.remainingMs).toBe(5000);
        expect(state.progress).toBeCloseTo(0.5);
    });

    test('finishes at the end and clamps beyond it', () => {
        for (const elapsed of [50000, 99999]) {
            const state = phaseAt(plan, elapsed)!;
            expect(state.finished).toBe(true);
            expect(state.remainingMs).toBe(0);
            expect(state.progress).toBe(1);
            expect(state.next).toBeNull();
        }
    });

    test('negative elapsed time is treated as zero', () => {
        expect(phaseAt(plan, -500)!.index).toBe(0);
    });

    test('empty plan', () => {
        expect(phaseAt({ ...plan, phases: [], total_duration_s: 0 }, 0)).toBeNull();
    });
});

describe('formatClock', () => {
    test.each([
        [0, '0:00'],
        [1, '0:01'],
        [1000, '0:01'],
        [59001, '1:00'],
        [125000, '2:05'],
        [-5, '0:00'],
    ])('%i ms -> %s', (ms, expected) => {
        expect(formatClock(ms)).toBe(expected);
    });
});

describe('describeConfig', () => {
    test('single and multiple sets', () => {
        expect(describeConfig(DEFAULT_INTERVAL_CONFIG)).toBe('20s / 10s x 8');
        expect(describeConfig({ ...DEFAULT_INTERVAL_CONFIG, sets: 3 })).toBe('20s / 10s x 8, 3 sets');
    });
});
