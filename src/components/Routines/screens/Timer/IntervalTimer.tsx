import {
    CONFIG_FIELDS,
    DEFAULT_INTERVAL_CONFIG,
    describeConfig,
    formatClock,
    IntervalConfig,
    PhaseType,
    phaseAt,
} from "@/components/Routines/helpers/intervalTimer";
import { TimerAudio } from "@/components/Routines/helpers/timerAudio";
import { WorkoutSession } from "@/components/Routines/models/WorkoutSession";
import { useIntervalPlanQuery, useIntervalPresetsQuery } from "@/components/Routines/queries/intervalTimer";
import { useAddSessionQuery } from "@/components/Routines/queries/sessions";
import { WgerContainerRightSidebar } from "@/core/ui/Widgets/Container";
import {
    Alert,
    Box,
    Button,
    FormControlLabel,
    LinearProgress,
    MenuItem,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import Grid from '@mui/material/Grid';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type Status = 'idle' | 'running' | 'paused' | 'finished';

const PHASE_COLORS: Record<PhaseType, string> = {
    warmup: '#f9a825',
    work: '#2e7d32',
    rest: '#1565c0',
    // eslint-disable-next-line camelcase
    set_rest: '#6a1b9a',
    cooldown: '#00838f',
};

const CUSTOM = 'custom';

/* Keep the screen on while `active`. Returns whether the browser supports it. */
const useWakeLock = (active: boolean): boolean => {
    const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    const lock = useRef<WakeLockSentinel | null>(null);

    useEffect(() => {
        if (!supported || !active) {
            return;
        }
        let cancelled = false;
        const acquire = async () => {
            try {
                const sentinel = await navigator.wakeLock.request('screen');
                if (cancelled) {
                    void sentinel.release();
                } else {
                    lock.current = sentinel;
                }
            } catch {
                // denied, e.g. low battery. The timer still works.
            }
        };
        // The lock is dropped automatically when the tab is hidden, so ask again when it returns
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void acquire();
            }
        };
        void acquire();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisible);
            void lock.current?.release();
            lock.current = null;
        };
    }, [supported, active]);

    return supported;
};

export const IntervalTimer = () => {
    const { t } = useTranslation();

    const [config, setConfig] = useState<IntervalConfig>(DEFAULT_INTERVAL_CONFIG);
    const [presetKey, setPresetKey] = useState<string>('tabata');
    const [status, setStatus] = useState<Status>('idle');
    const [elapsedMs, setElapsedMs] = useState(0);
    const [soundOn, setSoundOn] = useState(true);
    const [saved, setSaved] = useState(false);

    // The clock: time accumulated before the last resume + time since then
    const accumulated = useRef(0);
    const runStart = useRef<number | null>(null);
    const startedAt = useRef<Date | null>(null);
    const audio = useRef(new TimerAudio());
    const lastIndex = useRef(-1);

    const presetsQuery = useIntervalPresetsQuery();
    const planQuery = useIntervalPlanQuery(config);
    const addSession = useAddSessionQuery();

    const plan = planQuery.data;
    const planIsCurrent = plan !== undefined && !planQuery.isPlaceholderData;
    const locked = status !== 'idle';
    const keepAwakeSupported = useWakeLock(status === 'running');

    // Freeze the plan that was started so editing or refetching can't change it mid-workout
    const [runningPlan, setRunningPlan] = useState(plan);
    const activePlan = locked ? runningPlan : plan;

    const now = () => accumulated.current + (runStart.current !== null ? performance.now() - runStart.current : 0);

    const state = useMemo(
        () => (activePlan ? phaseAt(activePlan, locked ? elapsedMs : 0) : null),
        [activePlan, elapsedMs, locked],
    );

    // Tick. The clock is derived from performance.now, so throttled timers only cost display smoothness.
    useEffect(() => {
        if (status !== 'running') {
            return;
        }
        const id = window.setInterval(() => {
            const ms = now();
            setElapsedMs(ms);
            if (runningPlan && ms >= runningPlan.total_duration_s * 1000) {
                accumulated.current = runningPlan.total_duration_s * 1000;
                runStart.current = null;
                setStatus('finished');
            }
        }, 100);
        return () => window.clearInterval(id);
    }, [status, runningPlan]);

    // Vibrate on every phase change
    useEffect(() => {
        if (!state || !locked || state.index === lastIndex.current) {
            return;
        }
        lastIndex.current = state.index;
        if (status === 'running') {
            navigator.vibrate?.(state.phase.type === 'work' ? [200] : [100, 60, 100]);
        }
    }, [state, locked, status]);

    useEffect(() => {
        const a = audio.current;
        return () => a.stop();
    }, []);

    const start = () => {
        if (!plan || !planIsCurrent) {
            return;
        }
        setRunningPlan(plan);
        accumulated.current = 0;
        runStart.current = performance.now();
        startedAt.current = new Date();
        lastIndex.current = -1;
        setElapsedMs(0);
        setSaved(false);
        setStatus('running');
        if (soundOn) {
            audio.current.start(plan);
        }
    };

    const pause = () => {
        accumulated.current = now();
        runStart.current = null;
        audio.current.pause();
        setStatus('paused');
    };

    const resume = () => {
        runStart.current = performance.now();
        audio.current.resume();
        setStatus('running');
    };

    const reset = useCallback(() => {
        audio.current.stop();
        accumulated.current = 0;
        runStart.current = null;
        lastIndex.current = -1;
        setElapsedMs(0);
        setStatus('idle');
    }, []);

    const applyPreset = (key: string) => {
        setPresetKey(key);
        const preset = presetsQuery.data?.[key];
        if (preset) {
            setConfig(preset.config);
        }
    };

    const setField = (field: typeof CONFIG_FIELDS[number], raw: string) => {
        setPresetKey(CUSTOM);
        const value = raw === '' ? Number.NaN : Number(raw);
        setConfig({ ...config, [field]: value });
    };

    const save = () => {
        if (!startedAt.current || !runningPlan) {
            return;
        }
        const session = new WorkoutSession({
            id: null,
            dayId: null,
            routineId: null,
            datetimeStart: startedAt.current,
            datetimeEnd: new Date(),
            notes: `${t('routines.timer.title')}: ${describeConfig(runningPlan.config)}`,
            impression: '2',
        });
        addSession.mutate(session, { onSuccess: () => setSaved(true) });
    };

    const invalid = planQuery.isError;
    const phase = state?.phase;
    const color = phase && locked ? PHASE_COLORS[phase.type] : undefined;
    const sets = activePlan?.config.sets ?? 1;
    const rounds = activePlan?.config.rounds ?? 1;

    const form = (
        <Stack spacing={2}>
            <TextField
                select
                fullWidth
                size="small"
                label={t('routines.timer.preset')}
                value={presetKey}
                disabled={locked}
                onChange={e => applyPreset(e.target.value)}
            >
                <MenuItem value={CUSTOM}>{t('routines.timer.custom')}</MenuItem>
                {Object.entries(presetsQuery.data ?? {}).map(([key, preset]) => (
                    <MenuItem key={key} value={key}>{preset.name} ({describeConfig(preset.config)})</MenuItem>
                ))}
            </TextField>
            <Grid container spacing={2}>
                {CONFIG_FIELDS.map(field => (
                    <Grid key={field} size={{ xs: 6, sm: 4 }}>
                        <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label={t(`routines.timer.${field}`)}
                            disabled={locked}
                            value={Number.isNaN(config[field]) ? '' : config[field]}
                            onChange={e => setField(field, e.target.value)}
                            slotProps={{ htmlInput: { min: 0, step: 1, inputMode: 'numeric' } }}
                        />
                    </Grid>
                ))}
            </Grid>
            {invalid && <Alert severity="warning">{t('routines.timer.invalid')}</Alert>}
            {plan && !invalid && (
                <Typography variant="body2" color="text.secondary">
                    {t('routines.timer.total')}: {formatClock(plan.total_duration_s * 1000)} · {t('routines.timer.totalWork')}: {formatClock(plan.total_work_s * 1000)}
                </Typography>
            )}
        </Stack>
    );

    const display = (
        <Box
            data-testid="timer-display"
            sx={{
                bgcolor: color ?? 'action.hover',
                color: color ? '#fff' : 'text.primary',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                transition: 'background-color 0.2s',
            }}
        >
            <Typography variant="h5" sx={{ textTransform: 'uppercase', letterSpacing: 2 }}>
                {state?.finished ? t('routines.timer.done') : phase && locked ? t(`routines.timer.phase.${phase.type}`) : ' '}
            </Typography>
            <Typography
                component="div"
                sx={{ fontSize: { xs: '5rem', sm: '8rem' }, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}
            >
                {locked && state ? formatClock(state.remainingMs) : plan ? formatClock(plan.total_duration_s * 1000) : '–'}
            </Typography>
            <Typography variant="body1" sx={{ minHeight: '1.5em' }}>
                {locked && phase?.round && !state?.finished
                    ? [
                        t('routines.timer.roundOf', { round: phase.round, rounds }),
                        sets > 1 && phase.set ? t('routines.timer.setOf', { set: phase.set, sets }) : null,
                    ].filter(Boolean).join(' · ')
                    : ''}
            </Typography>
            <Typography variant="body2" sx={{ minHeight: '1.5em', opacity: 0.85 }}>
                {locked && state?.next ? t('routines.timer.next', { phase: t(`routines.timer.phase.${state.next.type}`) }) : ''}
            </Typography>
            <LinearProgress
                variant="determinate"
                value={(state?.progress ?? 0) * 100}
                sx={{ mt: 2, height: 8, borderRadius: 4 }}
            />
        </Box>
    );

    const controls = (
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            {status === 'idle' && (
                <Button variant="contained" size="large" onClick={start} disabled={!plan || !planIsCurrent || invalid}>
                    {t('routines.timer.start')}
                </Button>
            )}
            {status === 'running' && (
                <Button variant="contained" size="large" onClick={pause}>{t('routines.timer.pause')}</Button>
            )}
            {status === 'paused' && (
                <Button variant="contained" size="large" onClick={resume}>{t('routines.timer.resume')}</Button>
            )}
            {status !== 'idle' && (
                <Button variant="outlined" size="large" onClick={reset}>{t('routines.timer.reset')}</Button>
            )}
            {status === 'finished' && (
                <Button variant="outlined" size="large" onClick={save} disabled={saved || addSession.isPending}>
                    {saved ? t('routines.timer.saved') : t('routines.timer.save')}
                </Button>
            )}
            <FormControlLabel
                control={<Switch checked={soundOn} disabled={locked} onChange={e => setSoundOn(e.target.checked)} />}
                label={t('routines.timer.sound')}
            />
        </Stack>
    );

    return (
        <WgerContainerRightSidebar
            title={t('routines.timer.title')}
            subTitle={t('routines.timer.subtitle')}
            mainContent={
                <Stack spacing={3}>
                    {display}
                    {controls}
                    {form}
                    <Typography variant="caption" color="text.secondary">
                        {keepAwakeSupported ? t('routines.timer.keepAwake') : t('routines.timer.keepAwakeUnsupported')}
                    </Typography>
                </Stack>
            }
        />
    );
};
