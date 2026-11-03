import { getIntervalPlan, getIntervalPresets } from "@/components/Routines/api/intervalTimer";
import { IntervalConfig } from "@/components/Routines/helpers/intervalTimer";
import { QueryKey } from "@/core/lib/consts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const useIntervalPresetsQuery = () => useQuery({
    queryKey: [QueryKey.INTERVAL_PRESETS],
    queryFn: getIntervalPresets,
    staleTime: Infinity,
});

export const useIntervalPlanQuery = (config: IntervalConfig) => useQuery({
    queryKey: [QueryKey.INTERVAL_PLAN, config],
    queryFn: () => getIntervalPlan(config),
    placeholderData: keepPreviousData,
    retry: false,
});
