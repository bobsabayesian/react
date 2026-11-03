import { DEFAULT_INTERVAL_CONFIG, IntervalPlan } from "@/components/Routines/helpers/intervalTimer";
import { IntervalTimer } from "@/components/Routines/screens/Timer/IntervalTimer";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

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

const mutate = vi.fn();

vi.mock('@/components/Routines/queries/intervalTimer', () => ({
    useIntervalPresetsQuery: () => ({
        data: { tabata: { name: 'Classic Tabata', type: 'tabata', config: { ...DEFAULT_INTERVAL_CONFIG, rounds: 2 } } },
    }),
    useIntervalPlanQuery: () => ({ data: plan, isError: false, isPlaceholderData: false }),
}));

vi.mock('@/components/Routines/queries/sessions', () => ({
    useAddSessionQuery: () => ({ mutate, isPending: false }),
}));

vi.mock('@/components/Routines/helpers/timerAudio', () => ({
    TimerAudio: class {
        start = vi.fn();
        pause = vi.fn();
        resume = vi.fn();
        stop = vi.fn();
    },
}));

describe('IntervalTimer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mutate.mockClear();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    const display = () => screen.getByTestId('timer-display');

    test('shows the total time before starting', () => {
        render(<IntervalTimer />);
        expect(display()).toHaveTextContent('0:50');
        expect(screen.getByText('routines.timer.start')).toBeEnabled();
    });

    test('counts down, moves through phases and finishes', () => {
        render(<IntervalTimer />);
        fireEvent.click(screen.getByText('routines.timer.start'));

        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(display()).toHaveTextContent('routines.timer.phase.work');
        expect(display()).toHaveTextContent('0:15');

        act(() => {
            vi.advanceTimersByTime(17000);
        });
        expect(display()).toHaveTextContent('routines.timer.phase.rest');

        act(() => {
            vi.advanceTimersByTime(40000);
        });
        expect(display()).toHaveTextContent('routines.timer.done');
        expect(screen.getByText('routines.timer.save')).toBeEnabled();
    });

    test('pausing stops the clock', () => {
        render(<IntervalTimer />);
        fireEvent.click(screen.getByText('routines.timer.start'));
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        fireEvent.click(screen.getByText('routines.timer.pause'));
        act(() => {
            vi.advanceTimersByTime(30000);
        });
        expect(display()).toHaveTextContent('0:15');

        fireEvent.click(screen.getByText('routines.timer.resume'));
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(display()).toHaveTextContent('0:14');
    });

    test('reset returns to the idle state', () => {
        render(<IntervalTimer />);
        fireEvent.click(screen.getByText('routines.timer.start'));
        act(() => {
            vi.advanceTimersByTime(3000);
        });
        fireEvent.click(screen.getByText('routines.timer.reset'));
        expect(display()).toHaveTextContent('0:50');
        expect(screen.getByText('routines.timer.start')).toBeEnabled();
    });

    test('saves a finished timer as a workout session without routine or day', () => {
        render(<IntervalTimer />);
        fireEvent.click(screen.getByText('routines.timer.start'));
        act(() => {
            vi.advanceTimersByTime(51000);
        });
        fireEvent.click(screen.getByText('routines.timer.save'));
        expect(mutate).toHaveBeenCalledTimes(1);
        const session = mutate.mock.calls[0][0];
        expect(session.dayId).toBeNull();
        expect(session.routineId).toBeNull();
        expect(session.notes).toContain('20s / 10s x 2');
    });
});
