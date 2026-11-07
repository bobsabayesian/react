import {
    addEquipmentProfile,
    generateWorkout,
    getEquipmentProfiles,
    getMuscleFreshness,
} from "@/components/Coach/api/coach";
import { QueryKey } from "@/core/lib/consts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useEquipmentProfilesQuery = () => useQuery({
    queryKey: [QueryKey.COACH_PROFILES],
    queryFn: getEquipmentProfiles,
});

export const useAddEquipmentProfileQuery = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ name, equipment }: { name: string, equipment: number[] }) =>
            addEquipmentProfile(name, equipment),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKey.COACH_PROFILES] }),
    });
};

export const useMuscleFreshnessQuery = () => useQuery({
    queryKey: [QueryKey.COACH_FRESHNESS],
    queryFn: getMuscleFreshness,
});

/* Generating is a POST, but a preview changes nothing; saving one adds a routine */
export const useGenerateWorkoutQuery = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: generateWorkout,
        onSuccess: (data) => {
            if (data.routine_id !== null) {
                void queryClient.invalidateQueries({ queryKey: [QueryKey.ROUTINE_OVERVIEW] });
            }
        },
    });
};
