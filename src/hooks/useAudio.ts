'use client';

import { useCallback, useEffect, useRef } from 'react';

// ===== Web Audio API Synthesized SFX =====

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// --- Low-level synth helpers ---

function playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.3,
    fadeOut = true,
) {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    if (fadeOut) {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    }
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.1) {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * volume;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
}

// ===== SFX Library =====

const SFX = {
    /** Correct trivia answer — ascending happy chime */
    correct() {
        playTone(523, 0.12, 'sine', 0.25);          // C5
        setTimeout(() => playTone(659, 0.12, 'sine', 0.25), 80);  // E5
        setTimeout(() => playTone(784, 0.2, 'sine', 0.3), 160);   // G5
        setTimeout(() => playTone(1047, 0.35, 'sine', 0.2), 260); // C6
    },

    /** Wrong answer — descending buzz */
    wrong() {
        playTone(350, 0.15, 'square', 0.15);
        setTimeout(() => playTone(250, 0.25, 'square', 0.12), 120);
        setTimeout(() => playTone(180, 0.35, 'sawtooth', 0.08), 240);
    },

    /** Card flip — quick whoosh */
    flip() {
        playNoise(0.08, 0.12);
        playTone(800, 0.06, 'sine', 0.1);
        setTimeout(() => playTone(1200, 0.06, 'sine', 0.08), 40);
    },

    /** Key found — magical sparkle */
    key() {
        playTone(880, 0.1, 'sine', 0.2);
        setTimeout(() => playTone(1108, 0.1, 'sine', 0.2), 60);
        setTimeout(() => playTone(1318, 0.1, 'sine', 0.2), 120);
        setTimeout(() => playTone(1760, 0.3, 'triangle', 0.25), 180);
        setTimeout(() => playTone(2093, 0.4, 'sine', 0.15), 280);
    },

    /** Distractor — dull thud */
    distractor() {
        playTone(200, 0.15, 'sine', 0.2);
        playNoise(0.06, 0.08);
        setTimeout(() => playTone(150, 0.2, 'sine', 0.1), 80);
    },

    /** Lost turn — dramatic descending crash */
    lostTurn() {
        playTone(600, 0.08, 'sawtooth', 0.2);
        setTimeout(() => playTone(400, 0.1, 'sawtooth', 0.2), 60);
        setTimeout(() => playTone(250, 0.15, 'sawtooth', 0.2), 140);
        setTimeout(() => playTone(120, 0.4, 'sawtooth', 0.15), 220);
        setTimeout(() => playNoise(0.3, 0.1), 300);
    },

    /** Duel start — battle horn */
    duel() {
        playTone(220, 0.15, 'sawtooth', 0.15);
        setTimeout(() => playTone(330, 0.15, 'sawtooth', 0.18), 150);
        setTimeout(() => playTone(440, 0.25, 'sawtooth', 0.2), 300);
        setTimeout(() => {
            playTone(440, 0.1, 'sawtooth', 0.15);
            playTone(554, 0.1, 'sawtooth', 0.15);
        }, 500);
        setTimeout(() => playTone(660, 0.4, 'sawtooth', 0.2), 600);
    },

    /** Box reveal — suspenseful build + reveal */
    reveal() {
        for (let i = 0; i < 6; i++) {
            setTimeout(() => playTone(300 + i * 80, 0.08, 'triangle', 0.12), i * 70);
        }
        setTimeout(() => {
            playTone(800, 0.15, 'sine', 0.25);
            playTone(1000, 0.15, 'sine', 0.2);
        }, 500);
        setTimeout(() => {
            playTone(1200, 0.4, 'sine', 0.3);
            playTone(1500, 0.4, 'triangle', 0.15);
        }, 650);
    },

    /** Pegadinha reveal — ominous fail */
    pegadinha() {
        playTone(300, 0.2, 'sawtooth', 0.12);
        setTimeout(() => playTone(280, 0.2, 'sawtooth', 0.12), 200);
        setTimeout(() => playTone(250, 0.25, 'sawtooth', 0.15), 400);
        setTimeout(() => playTone(200, 0.5, 'sawtooth', 0.12), 600);
        setTimeout(() => playNoise(0.4, 0.06), 700);
    },

    /** Wildcard draw — mystical swirl */
    wildcard() {
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                playTone(400 + Math.sin(i * 0.8) * 200, 0.1, 'triangle', 0.1);
            }, i * 60);
        }
        setTimeout(() => playTone(700, 0.3, 'sine', 0.2), 500);
        setTimeout(() => playTone(900, 0.4, 'triangle', 0.15), 600);
    },

    /** Timer tick — subtle clock */
    tick() {
        playTone(1800, 0.03, 'square', 0.06);
    },

    /** Timer urgent — rapid alarming beeps */
    urgent() {
        playTone(880, 0.08, 'square', 0.15);
        setTimeout(() => playTone(880, 0.08, 'square', 0.15), 150);
    },

    /** Countdown tick (3, 2, 1) */
    countdownTick() {
        playTone(600, 0.12, 'sine', 0.2);
        playTone(1200, 0.06, 'sine', 0.1);
    },

    /** Countdown GO! */
    countdownGo() {
        playTone(523, 0.1, 'sine', 0.25);
        playTone(659, 0.1, 'sine', 0.25);
        playTone(784, 0.1, 'sine', 0.25);
        setTimeout(() => {
            playTone(1047, 0.3, 'sine', 0.3);
            playTone(1318, 0.3, 'triangle', 0.15);
        }, 100);
    },

    /** Game start — fanfare */
    gameStart() {
        const notes = [523, 659, 784, 1047, 784, 1047, 1318];
        notes.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 0.15, 'sine', 0.2), i * 100);
        });
        setTimeout(() => {
            playTone(1047, 0.5, 'sine', 0.25);
            playTone(1318, 0.5, 'triangle', 0.15);
            playTone(1568, 0.5, 'sine', 0.1);
        }, 700);
    },

    /** Game over — final dramatic chord */
    gameOver() {
        playTone(261, 0.6, 'sine', 0.2);
        playTone(329, 0.6, 'sine', 0.2);
        playTone(392, 0.6, 'sine', 0.2);
        setTimeout(() => {
            playTone(349, 0.8, 'sine', 0.2);
            playTone(440, 0.8, 'sine', 0.2);
            playTone(523, 0.8, 'sine', 0.2);
        }, 500);
        setTimeout(() => {
            playTone(523, 1.2, 'sine', 0.25);
            playTone(659, 1.2, 'sine', 0.2);
            playTone(784, 1.2, 'triangle', 0.15);
        }, 1200);
    },

    /** Reaction emoji pop */
    reaction() {
        playTone(1200, 0.05, 'sine', 0.08);
        setTimeout(() => playTone(1600, 0.05, 'sine', 0.06), 40);
    },

    /** Ranking submit */
    rankingSubmit() {
        playTone(440, 0.1, 'sine', 0.15);
        setTimeout(() => playTone(554, 0.1, 'sine', 0.15), 80);
        setTimeout(() => playTone(660, 0.15, 'sine', 0.2), 160);
    },

    /** Box select — selection whoosh */
    boxSelect() {
        playTone(400, 0.08, 'triangle', 0.15);
        setTimeout(() => playTone(600, 0.08, 'triangle', 0.15), 60);
        setTimeout(() => playTone(800, 0.12, 'sine', 0.2), 120);
    },
};

// ===== BGM System (subtle ambient loops) =====

type BGMPhase = 'lobby' | 'trivia' | 'card_open' | 'duel' | 'reveal' | 'wildcard' | 'game_over' | 'silent';

interface BGMConfig {
    baseFreq: number;
    type: OscillatorType;
    volume: number;
    beatInterval: number;
    secondFreq?: number;
}

const BGM_CONFIGS: Record<BGMPhase, BGMConfig | null> = {
    lobby: { baseFreq: 130, type: 'sine', volume: 0.03, beatInterval: 2000 },
    trivia: { baseFreq: 200, type: 'triangle', volume: 0.04, beatInterval: 800 },
    card_open: { baseFreq: 160, type: 'sine', volume: 0.04, beatInterval: 1200, secondFreq: 200 },
    duel: { baseFreq: 220, type: 'sawtooth', volume: 0.03, beatInterval: 500 },
    reveal: null,
    wildcard: { baseFreq: 180, type: 'triangle', volume: 0.03, beatInterval: 1500 },
    game_over: null,
    silent: null,
};

// ===== Hook =====

export function useAudio() {
    const mutedRef = useRef(false);
    const bgmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentBgmPhaseRef = useRef<BGMPhase>('silent');

    const isMuted = useCallback(() => mutedRef.current, []);

    const playSFX = useCallback((name: keyof typeof SFX) => {
        if (mutedRef.current) return;
        try {
            SFX[name]();
        } catch (e) {
            console.warn('[Audio] SFX error:', e);
        }
    }, []);

    const stopBGM = useCallback(() => {
        if (bgmIntervalRef.current) {
            clearInterval(bgmIntervalRef.current);
            bgmIntervalRef.current = null;
        }
        currentBgmPhaseRef.current = 'silent';
    }, []);

    const startBGM = useCallback((phase: BGMPhase) => {
        if (phase === currentBgmPhaseRef.current) return;
        stopBGM();
        currentBgmPhaseRef.current = phase;

        const config = BGM_CONFIGS[phase];
        if (!config || mutedRef.current) return;

        bgmIntervalRef.current = setInterval(() => {
            if (mutedRef.current) return;
            try {
                playTone(config.baseFreq, 0.3, config.type, config.volume, true);
                if (config.secondFreq) {
                    setTimeout(() => playTone(config.secondFreq!, 0.2, config.type, config.volume * 0.7, true), config.beatInterval / 3);
                }
            } catch {
                // ignore
            }
        }, config.beatInterval);
    }, [stopBGM]);

    const toggleMute = useCallback(() => {
        mutedRef.current = !mutedRef.current;
        if (mutedRef.current) {
            stopBGM();
        }
        return mutedRef.current;
    }, [stopBGM]);

    const setMuted = useCallback((val: boolean) => {
        mutedRef.current = val;
        if (val) stopBGM();
    }, [stopBGM]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopBGM();
        };
    }, [stopBGM]);

    return {
        playSFX,
        startBGM,
        stopBGM,
        toggleMute,
        setMuted,
        isMuted,
    };
}

export type { BGMPhase };
export { SFX };
