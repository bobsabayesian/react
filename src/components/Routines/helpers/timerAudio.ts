import { IntervalPlan } from "@/components/Routines/helpers/intervalTimer";

/*
 * Beeps for the interval timer.
 *
 * Every sound is scheduled up front on the Web Audio clock instead of from
 * setTimeout, because timers get throttled when the tab is in the background or
 * the screen is off, while already scheduled audio keeps its timing. Pausing
 * suspends the whole context, which freezes that clock together with the timer.
 * Browsers only allow starting audio from a user gesture, so call `start` from a
 * click handler. Locked-screen playback is browser dependent, especially on iOS.
 */

const COUNTDOWN_SECONDS = 3;

export class TimerAudio {
    private ctx: AudioContext | null = null;

    private beep(at: number, frequency: number, length = 0.18, volume = 0.4) {
        if (!this.ctx) {
            return;
        }
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(volume, at + 0.01);
        gain.gain.linearRampToValueAtTime(0, at + length);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(at);
        osc.stop(at + length + 0.02);
    }

    /* Schedule all cues for `plan`, with phase zero starting `offsetMs` ago */
    start(plan: IntervalPlan, offsetMs = 0) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
            return;
        }
        this.stop();
        this.ctx = new Ctor();
        void this.ctx.resume();

        const t0 = this.ctx.currentTime - offsetMs / 1000;
        const now = this.ctx.currentTime;

        for (const phase of plan.phases) {
            const startAt = t0 + phase.start_s;
            const endAt = startAt + phase.duration_s;

            if (startAt >= now) {
                if (phase.type === 'work') {
                    this.beep(startAt, 988, 0.35, 0.5);
                } else {
                    this.beep(startAt, 523, 0.25);
                }
            }
            // Short ticks for the last seconds, if the phase is long enough to have them
            if (phase.duration_s > COUNTDOWN_SECONDS + 1) {
                for (let i = COUNTDOWN_SECONDS; i >= 1; i--) {
                    const at = endAt - i;
                    if (at >= now) {
                        this.beep(at, 660, 0.08, 0.3);
                    }
                }
            }
        }

        const end = t0 + plan.total_duration_s;
        for (let i = 0; i < 3; i++) {
            if (end + i * 0.3 >= now) {
                this.beep(end + i * 0.3, 1175, 0.2, 0.5);
            }
        }
    }

    pause() {
        void this.ctx?.suspend();
    }

    resume() {
        void this.ctx?.resume();
    }

    stop() {
        void this.ctx?.close();
        this.ctx = null;
    }
}
