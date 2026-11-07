import { EquipmentProfile, GenerateRequest, GeneratedWorkout } from "@/components/Coach/api/coach";
import {
    exerciseCount,
    groupFreshness,
    Split,
    SPLITS,
    suggestSplit,
} from "@/components/Coach/helpers/freshness";
import {
    useAddEquipmentProfileQuery,
    useEquipmentProfilesQuery,
    useGenerateWorkoutQuery,
    useMuscleFreshnessQuery,
} from "@/components/Coach/queries/coach";
import { useEquipmentQuery } from "@/components/Exercises";
import { WgerContainerRightSidebar } from "@/core/ui/Widgets/Container";
import { makeLink, WgerLink } from "@/core/lib/url";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    FormGroup,
    LinearProgress,
    MenuItem,
    Paper,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import Grid from '@mui/material/Grid';
import axios from "axios";
import { DateTime } from "luxon";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

const DURATIONS = [30, 45, 60, 90];
const ROUTINE_NAME_MAX = 25;
const STATUS_COLOR = { fatigued: 'error', recovering: 'warning', ready: 'success' } as const;

/* The error text the API sends back, or a generic one */
const errorMessage = (error: unknown, fallback: string): string => {
    if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (Array.isArray(detail) && detail.length > 0) {
            return String(detail[0]);
        }
        if (typeof detail === 'string') {
            return detail;
        }
    }
    return fallback;
};

const formatKg = (value: string | number): string => String(Number(value));

const AddProfileDialog = (props: { open: boolean, onClose: () => void, onCreated: (id: number) => void }) => {
    const { t } = useTranslation();
    const equipmentQuery = useEquipmentQuery();
    const addProfile = useAddEquipmentProfileQuery();
    const [name, setName] = useState('');
    const [selected, setSelected] = useState<number[]>([]);

    const toggle = (id: number) =>
        setSelected(current => current.includes(id) ? current.filter(e => e !== id) : [...current, id]);

    const save = () => addProfile.mutate({ name: name.trim(), equipment: selected }, {
        onSuccess: (profile) => {
            setName('');
            setSelected([]);
            props.onCreated(profile.id);
            props.onClose();
        },
    });

    return (
        <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
            <DialogTitle>{t('coach.addProfile.title')}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label={t('coach.addProfile.name')}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        slotProps={{ htmlInput: { maxLength: 64 } }}
                    />
                    <Typography variant="body2" color="text.secondary">
                        {t('coach.addProfile.hint')}
                    </Typography>
                    <FormGroup>
                        {(equipmentQuery.data ?? []).map(item => (
                            <FormControlLabel
                                key={item.id}
                                label={item.translatedName}
                                control={
                                    <Checkbox
                                        checked={selected.includes(item.id)}
                                        onChange={() => toggle(item.id)}
                                    />
                                }
                            />
                        ))}
                    </FormGroup>
                    {addProfile.isError && (
                        <Alert severity="error">
                            {errorMessage(addProfile.error, t('coach.addProfile.error'))}
                        </Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onClose}>{t('cancel')}</Button>
                <Button
                    variant="contained"
                    onClick={save}
                    disabled={name.trim() === '' || addProfile.isPending}
                >
                    {t('save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export const GenerateWorkout = () => {
    const { t, i18n } = useTranslation();

    const profilesQuery = useEquipmentProfilesQuery();
    const freshnessQuery = useMuscleFreshnessQuery();
    const generate = useGenerateWorkoutQuery();

    const [profileId, setProfileId] = useState<number | null>(null);
    const [split, setSplit] = useState<Split>('auto');
    const [duration, setDuration] = useState(45);
    const [result, setResult] = useState<GeneratedWorkout | null>(null);
    const [lastRequest, setLastRequest] = useState<GenerateRequest | null>(null);
    const [routineName, setRoutineName] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const profiles: EquipmentProfile[] = profilesQuery.data ?? [];
    const selectedProfile = profiles.find(p => p.id === profileId) ?? profiles[0];
    const muscles = freshnessQuery.data ?? [];
    const groups = groupFreshness(muscles);
    const suggestion = suggestSplit(muscles);

    const splitLabel = (s: Split) => t(`coach.split.${s}`);
    const defaultName = (s: Split) =>
        t('coach.defaultRoutineName', { split: splitLabel(s), date: DateTime.now().toFormat('LLL d') })
            .slice(0, ROUTINE_NAME_MAX);

    const run = (request: GenerateRequest) => generate.mutate(request, {
        onSuccess: (data) => {
            setResult(data);
            setLastRequest({ ...request, seed: data.seed });
            if (routineName === null || request.save_as_routine !== true) {
                setRoutineName(defaultName(data.split));
            }
        },
    });

    const onGenerate = () => {
        if (!selectedProfile) {
            return;
        }
        // eslint-disable-next-line camelcase
        run({ duration_min: duration, equipment_profile_id: selectedProfile.id, split });
    };

    const onSave = () => {
        if (!lastRequest) {
            return;
        }
        // eslint-disable-next-line camelcase
        run({ ...lastRequest, save_as_routine: true, routine_name: routineName ?? undefined });
    };

    const splitHint = suggestion === null
        ? ''
        : split === 'auto'
            ? t('coach.autoHint', { split: splitLabel(suggestion.split), pct: Math.round(suggestion.pct) })
            : t('coach.manualHint', { split: splitLabel(suggestion.split) });

    const form = (
        <Stack spacing={2}>
            <Paper sx={{ p: 2.5 }}>
                <Stack spacing={3}>
                    <Stack spacing={1}>
                        <Typography variant="subtitle2">{t('coach.whereTraining')}</Typography>
                        {profiles.length > 0 && (
                            <TextField
                                select
                                size="small"
                                value={selectedProfile?.id ?? ''}
                                onChange={e => setProfileId(Number(e.target.value))}
                                slotProps={{ htmlInput: { 'aria-label': t('coach.whereTraining') } }}
                            >
                                {profiles.map(p => (
                                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                                ))}
                            </TextField>
                        )}
                        {profilesQuery.isSuccess && profiles.length === 0 && (
                            <Alert severity="info">{t('coach.noProfiles')}</Alert>
                        )}
                        <Box>
                            <Button size="small" onClick={() => setDialogOpen(true)}>
                                {t('coach.addProfile.title')}
                            </Button>
                        </Box>
                    </Stack>

                    <Stack spacing={1}>
                        <Typography variant="subtitle2">{t('coach.splitLabel')}</Typography>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={split}
                            onChange={(_, value: Split | null) => value && setSplit(value)}
                            sx={{ flexWrap: 'wrap', gap: 1 }}
                        >
                            {SPLITS.map(s => (
                                <ToggleButton key={s} value={s} sx={{ borderRadius: 5, px: 2, border: 1 }}>
                                    {s === 'auto' && suggestion
                                        ? t('coach.autoChip', { split: splitLabel(suggestion.split) })
                                        : splitLabel(s)}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                        <Typography variant="caption" color="text.secondary">{splitHint}</Typography>
                    </Stack>

                    <Stack spacing={1}>
                        <Typography variant="subtitle2">{t('coach.timeLabel')}</Typography>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={duration}
                            onChange={(_, value: number | null) => value && setDuration(value)}
                            sx={{ flexWrap: 'wrap', gap: 1 }}
                        >
                            {DURATIONS.map(d => (
                                <ToggleButton key={d} value={d} sx={{ borderRadius: 5, px: 2, border: 1 }}>
                                    {t('coach.minutes', { count: d })}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                        <Typography variant="caption" color="text.secondary">
                            {t('coach.countHint', { count: exerciseCount(duration), minutes: duration })}
                        </Typography>
                    </Stack>

                    <Button
                        variant="contained"
                        size="large"
                        onClick={onGenerate}
                        disabled={!selectedProfile || generate.isPending}
                    >
                        {result ? t('coach.regenerate') : t('coach.generate')}
                    </Button>
                </Stack>
            </Paper>

            <Paper sx={{ p: 2.5 }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>{t('coach.freshness.title')}</Typography>
                {freshnessQuery.isError && <Alert severity="error">{t('coach.freshness.error')}</Alert>}
                <Stack spacing={1.25}>
                    {groups.map(g => (
                        <Box
                            key={g.key}
                            sx={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr) 110px', gap: 1.25, alignItems: 'center' }}
                        >
                            <Typography variant="body2">{t(`coach.muscles.${g.key}`)}</Typography>
                            <LinearProgress
                                variant="determinate"
                                value={g.pct}
                                color={STATUS_COLOR[g.status]}
                                aria-label={t(`coach.muscles.${g.key}`)}
                                sx={{ height: 10, borderRadius: 5 }}
                            />
                            <Typography variant="body2" sx={{ textAlign: 'right' }}>
                                {g.pct}% {t(`coach.status.${g.status}`)}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            </Paper>
        </Stack>
    );

    const preview = result === null ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6">{t('coach.empty.title')}</Typography>
            <Typography color="text.secondary">{t('coach.empty.body')}</Typography>
        </Paper>
    ) : (
        <Paper>
            <Stack
                direction="row"
                spacing={2}
                sx={{ p: 2.5, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', rowGap: 1.5 }}
            >
                <Box>
                    <Typography variant="h5">{t('coach.resultTitle', { split: splitLabel(result.split) })}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('coach.resultMeta', {
                            minutes: lastRequest?.duration_min ?? duration,
                            count: result.exercises.length,
                            profile: profiles.find(p => p.id === lastRequest?.equipment_profile_id)?.name ?? '',
                        })}
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    onClick={() => lastRequest && run({ ...lastRequest, seed: undefined })}
                    disabled={generate.isPending}
                >
                    {t('coach.shuffle')}
                </Button>
            </Stack>

            <Stack>
                {result.exercises.map(e => {
                    const tier = e.slot <= 2 ? 'heavy' : e.slot <= 4 ? 'secondary' : 'isolation';
                    const cold = e.prescribed_weight_kg === null;
                    return (
                        <Stack
                            key={e.exercise_id}
                            direction="row"
                            spacing={2}
                            sx={{ px: 2.5, py: 2, borderTop: 1, borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
                        >
                            <Box
                                aria-hidden
                                sx={{
                                    width: 32, height: 32, borderRadius: '50%', bgcolor: 'primary.main',
                                    color: 'primary.contrastText', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontWeight: 700, flex: 'none',
                                }}
                            >
                                {e.slot}
                            </Box>
                            <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 600 }}>{e.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t(`coach.tier.${tier}`)}
                                </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right', minWidth: 150 }}>
                                <Typography sx={{ fontWeight: 700 }}>
                                    {cold
                                        ? t('coach.prescription.calibrate', { sets: e.sets, reps: e.target_reps })
                                        : t('coach.prescription.weighted', {
                                            sets: e.sets,
                                            reps: e.target_reps,
                                            weight: formatKg(e.prescribed_weight_kg!),
                                        })}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {cold
                                        ? t('coach.basis.none')
                                        : e.e1rm_basis_kg !== null
                                            ? t('coach.basis.e1rm', { value: formatKg(e.e1rm_basis_kg) })
                                            : ''}
                                </Typography>
                            </Box>
                        </Stack>
                    );
                })}
            </Stack>

            <Stack spacing={1.5} sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
                {result.routine_id !== null ? (
                    <Alert
                        severity="success"
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                href={makeLink(WgerLink.ROUTINE_DETAIL, i18n.language, { id: result.routine_id })}
                            >
                                {t('coach.openRoutine')}
                            </Button>
                        }
                    >
                        {t('coach.saved')}
                    </Alert>
                ) : (
                    <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>
                        <TextField
                            size="small"
                            label={t('coach.routineName')}
                            value={routineName ?? ''}
                            onChange={e => setRoutineName(e.target.value)}
                            slotProps={{ htmlInput: { maxLength: ROUTINE_NAME_MAX } }}
                            sx={{ flex: '1 1 220px' }}
                        />
                        <Button variant="contained" onClick={onSave} disabled={generate.isPending}>
                            {t('coach.saveRoutine')}
                        </Button>
                    </Stack>
                )}
                <Typography variant="caption" color="text.secondary">{t('coach.footnote')}</Typography>
            </Stack>
        </Paper>
    );

    return (
        <WgerContainerRightSidebar
            title={t('coach.title')}
            subTitle={t('coach.subtitle')}
            mainContent={
                <Grid container spacing={2.5} sx={{ alignItems: 'flex-start' }}>
                    <Grid size={{ xs: 12, md: 5 }}>{form}</Grid>
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Stack spacing={2}>
                            {generate.isError && (
                                <Alert severity="error">
                                    {errorMessage(generate.error, t('coach.error'))}
                                </Alert>
                            )}
                            {preview}
                        </Stack>
                    </Grid>
                    <AddProfileDialog
                        open={dialogOpen}
                        onClose={() => setDialogOpen(false)}
                        onCreated={setProfileId}
                    />
                </Grid>
            }
        />
    );
};
