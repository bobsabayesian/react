import { GeneratedWorkout } from "@/components/Coach/api/coach";
import { MuscleFreshness, statusFor } from "@/components/Coach/helpers/freshness";
import { GenerateWorkout } from "@/components/Coach/screens/GenerateWorkout";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const muscle = (id: number, pct: number): MuscleFreshness => ({
     
    muscle_id: id, name: `m${id}`, freshness_pct: pct, status: statusFor(pct),
});

const freshness = [
    muscle(4, 28), muscle(2, 55), muscle(5, 41),
    muscle(12, 95), muscle(9, 92), muscle(1, 90), muscle(13, 90),
    muscle(10, 80), muscle(11, 76), muscle(8, 70), muscle(7, 90), muscle(15, 90),
];

const workout: GeneratedWorkout = {
     
    routine_id: null,
     
    day_id: null,
    split: 'pull',
    seed: 1234,
    exercises: [
         
        { exercise_id: 1, name: 'Barbell row', slot: 1, sets: 4, target_reps: 8, prescribed_weight_kg: '70.00', e1rm_basis_kg: '87.5' },
         
        { exercise_id: 2, name: 'Hammer curl', slot: 2, sets: 3, target_reps: 10, prescribed_weight_kg: null, e1rm_basis_kg: null },
    ],
};

const mutate = vi.fn();
let profiles: unknown[] = [];
let generateState: Record<string, unknown> = {};

vi.mock('@/components/Coach/queries/coach', () => ({
    useEquipmentProfilesQuery: () => ({ data: profiles, isSuccess: true }),
    useAddEquipmentProfileQuery: () => ({ mutate: vi.fn(), isError: false, isPending: false }),
    useMuscleFreshnessQuery: () => ({ data: freshness, isError: false }),
    useGenerateWorkoutQuery: () => ({ mutate, isPending: false, isError: false, ...generateState }),
}));

vi.mock('@/components/Exercises', () => ({
    useEquipmentQuery: () => ({ data: [{ id: 1, name: 'Barbell', translatedName: 'Barbell' }] }),
}));

const gym = { id: 7, name: 'Gym', equipment: [1], is_active: true };  

describe('GenerateWorkout', () => {
    beforeEach(() => {
        mutate.mockReset();
        profiles = [gym];
        generateState = {};
    });

    test('asks for a training space when there is none', () => {
        profiles = [];
        render(<GenerateWorkout />);
        expect(screen.getByText('coach.noProfiles')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'coach.generate' })).toBeDisabled();
    });

    test('shows grouped freshness with a text status', () => {
        render(<GenerateWorkout />);
        expect(screen.getByText('28% coach.status.fatigued')).toBeInTheDocument();
        expect(screen.getByText('95% coach.status.ready')).toBeInTheDocument();
    });

    test('suggests the freshest split on the auto chip', () => {
        render(<GenerateWorkout />);
        expect(screen.getByRole('button', { name: 'coach.autoChip' })).toBeInTheDocument();
    });

    test('generate sends the chosen options', () => {
        render(<GenerateWorkout />);
        fireEvent.click(screen.getByRole('button', { name: 'coach.split.legs' }));
        // translations are keys here, so the four duration buttons share a name: the first is 30 min
        fireEvent.click(screen.getAllByRole('button', { name: 'coach.minutes' })[0]);
        fireEvent.click(screen.getByRole('button', { name: 'coach.generate' }));
        expect(mutate).toHaveBeenCalledTimes(1);
        const request = mutate.mock.calls[0][0];
        expect(request.split).toBe('legs');
        expect(request.equipment_profile_id).toBe(7);
        expect(request.duration_min).toBe(30);
    });

    test('shows the generated session, with a calibrate hint for lifts without history', () => {
        mutate.mockImplementation((_request, options) => options.onSuccess(workout));
        render(<GenerateWorkout />);
        fireEvent.click(screen.getByRole('button', { name: 'coach.generate' }));

        expect(screen.getByText('Barbell row')).toBeInTheDocument();
        expect(screen.getByText('coach.prescription.weighted')).toBeInTheDocument();
        expect(screen.getByText('coach.prescription.calibrate')).toBeInTheDocument();
    });

    test('saving repeats the previewed session with its seed', () => {
        mutate.mockImplementation((_request, options) => options.onSuccess(workout));
        render(<GenerateWorkout />);
        fireEvent.click(screen.getByRole('button', { name: 'coach.generate' }));
        mutate.mockClear();

        fireEvent.click(screen.getByRole('button', { name: 'coach.saveRoutine' }));
        const request = mutate.mock.calls[0][0];
        expect(request.seed).toBe(1234);
        expect(request.save_as_routine).toBe(true);
        expect(request.split).toBe('auto');
    });

    test('shuffle asks for a new session without a seed', () => {
        mutate.mockImplementation((_request, options) => options.onSuccess(workout));
        render(<GenerateWorkout />);
        fireEvent.click(screen.getByRole('button', { name: 'coach.generate' }));
        mutate.mockClear();

        fireEvent.click(screen.getByRole('button', { name: 'coach.shuffle' }));
        expect(mutate.mock.calls[0][0].seed).toBeUndefined();
        expect(mutate.mock.calls[0][0].save_as_routine).toBeUndefined();
    });

    test('links to the routine once saved', () => {
        mutate.mockImplementation((_request, options) =>
             
            options.onSuccess({ ...workout, routine_id: 55 }));
        render(<GenerateWorkout />);
        fireEvent.click(screen.getByRole('button', { name: 'coach.generate' }));

        expect(screen.getByText('coach.saved')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'coach.openRoutine' })).toHaveAttribute('href', expect.stringContaining('/routine/55/view'));
    });

    test('shows the error', () => {
        generateState = { isError: true, error: new Error('boom') };
        render(<GenerateWorkout />);
        expect(screen.getByText('coach.error')).toBeInTheDocument();
    });
});
