import { MuscleFreshness, Split } from "@/components/Coach/helpers/freshness";
import { ApiPath } from "@/core/lib/consts";
import { makeHeader, makeUrl } from "@/core/lib/url";
import axios from 'axios';

export interface EquipmentProfile {
    id: number;
    name: string;
    equipment: number[];
     
    is_active: boolean;
}

export interface GeneratedExercise {
     
    exercise_id: number;
    name: string;
    slot: number;
    sets: number;
     
    target_reps: number;
     
    prescribed_weight: string | number | null;
     
    weight_unit: 'kg' | 'lb';
     
    prescribed_weight_kg: string | number | null;
     
    e1rm_basis_kg: string | number | null;
}

export interface GeneratedWorkout {
     
    routine_id: number | null;
     
    day_id: number | null;
    split: Exclude<Split, 'auto'>;
    seed: number;
    exercises: GeneratedExercise[];
}

export interface GenerateRequest {
     
    duration_min: number;
     
    equipment_profile_id: number;
    split: Split;
    seed?: number;
     
    save_as_routine?: boolean;
     
    routine_name?: string;
}

export const getEquipmentProfiles = async (): Promise<EquipmentProfile[]> => {
    const response = await axios.get(
        makeUrl(ApiPath.COACH_EQUIPMENT_PROFILE, { query: { limit: 100 } }),
        { headers: makeHeader() }
    );
    return response.data.results;
};

export const addEquipmentProfile = async (name: string, equipment: number[]): Promise<EquipmentProfile> => {
    const response = await axios.post(
        makeUrl(ApiPath.COACH_EQUIPMENT_PROFILE),
        { name, equipment },
        { headers: makeHeader() }
    );
    return response.data;
};

export const getMuscleFreshness = async (): Promise<MuscleFreshness[]> => {
    const response = await axios.get(
        makeUrl(ApiPath.COACH_FRESHNESS),
        { headers: makeHeader() }
    );
    return response.data.muscles;
};

export const generateWorkout = async (request: GenerateRequest): Promise<GeneratedWorkout> => {
    const response = await axios.post(
        makeUrl(ApiPath.COACH_GENERATE),
        request,
        { headers: makeHeader() }
    );
    return response.data;
};
