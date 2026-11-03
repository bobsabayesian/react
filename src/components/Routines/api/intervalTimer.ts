import { IntervalConfig, IntervalPlan, IntervalPreset } from "@/components/Routines/helpers/intervalTimer";
import { ApiPath } from "@/core/lib/consts";
import { makeHeader, makeUrl } from "@/core/lib/url";
import axios from 'axios';

/* Ready-made timer configurations, keyed by preset id */
export const getIntervalPresets = async (): Promise<Record<string, IntervalPreset>> => {
    const response = await axios.get(
        makeUrl(ApiPath.DAY, { objectMethod: 'interval-presets' }),
        { headers: makeHeader() }
    );
    return response.data;
};

/* Expand a config into timed phases without saving anything. Rejects with a 400 for invalid configs. */
export const getIntervalPlan = async (config: Partial<IntervalConfig>): Promise<IntervalPlan> => {
    const response = await axios.post(
        makeUrl(ApiPath.DAY, { objectMethod: 'interval-plan' }),
        config,
        { headers: makeHeader() }
    );
    return response.data;
};
