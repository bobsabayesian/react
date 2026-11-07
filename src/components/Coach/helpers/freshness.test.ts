import {
    exerciseCount,
    groupFreshness,
    MuscleFreshness,
    statusFor,
    suggestSplit,
} from "@/components/Coach/helpers/freshness";

const muscle = (id: number, pct: number): MuscleFreshness => ({
     
    muscle_id: id,
    name: `m${id}`,
     
    freshness_pct: pct,
    status: statusFor(pct),
});

describe('freshness helpers', () => {
    test('status thresholds match the server', () => {
        expect(statusFor(39.9)).toBe('fatigued');
        expect(statusFor(40)).toBe('recovering');
        expect(statusFor(74.9)).toBe('recovering');
        expect(statusFor(75)).toBe('ready');
    });

    test('groups average their muscles and skip unreported groups', () => {
        const groups = groupFreshness([muscle(1, 80), muscle(13, 60), muscle(4, 28)]);
        expect(groups).toEqual([
            { key: 'chest', pct: 28, status: 'fatigued' },
            { key: 'biceps', pct: 70, status: 'recovering' },
        ]);
    });

    test('suggests the freshest of push, pull and legs', () => {
        const data = [
            muscle(4, 20), muscle(2, 30), muscle(5, 40),
            muscle(12, 90), muscle(9, 90), muscle(1, 90), muscle(13, 90),
            muscle(10, 50), muscle(11, 50), muscle(8, 50), muscle(7, 50), muscle(15, 50),
        ];
        expect(suggestSplit(data)).toEqual({ split: 'pull', pct: 90 });
    });

    test('has no suggestion without data', () => {
        expect(suggestSplit([])).toBeNull();
    });

    test('exercise count is clamped to 3-7', () => {
        expect([10, 30, 45, 60, 90, 200].map(exerciseCount)).toEqual([3, 3, 4, 6, 7, 7]);
    });
});
