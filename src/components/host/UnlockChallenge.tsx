'use client';

import { useEffect, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    onAnswer: (stageIndex: number, answer: number) => void;
    onForceNext: () => void;
}

export default function UnlockChallenge({ gameState, onAnswer, onForceNext }: Props) {
    const [timeLeft, setTimeLeft] = useState(20);
    const stages = gameState.miniChallenge || [];
    const currentStage = gameState.currentStage || 0;
    const stage = stages[currentStage];
    const attackerName = gameState.attackerTeamId
        ? Object.values(gameState.teams as Record<string, any>).find((t: any) => t.id === gameState.attackerTeamId)?.name
        : '???';

    // Timer
    useEffect(() => {
        if (!gameState.timerEndAt) return;
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((gameState.timerEndAt - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [gameState.timerEndAt]);

    return (
        <div className="flex-grow flex gap-6 animate-fade-in">
            {/* Left: Stage status */}
            <div className="w-72 flex flex-col gap-4 justify-center shrink-0">
                {stages.map((s: any, i: number) => (
                    <div
                        key={s.id}
                        className={`glass-panel p-5 rounded-xl border-l-4 transition-all ${i === currentStage
                                ? 'border-primary glow-active'
                                : i < currentStage
                                    ? 'border-green-500 opacity-70'
                                    : 'border-slate-700 opacity-40'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${i === currentStage
                                    ? 'text-primary bg-primary/10'
                                    : i < currentStage
                                        ? 'text-green-500 bg-green-500/10'
                                        : 'text-slate-500 bg-slate-800'
                                }`}>
                                Etapa {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="material-icons text-sm">
                                {s.completed ? 'lock_open' : i === currentStage ? 'sync' : 'lock'}
                            </span>
                        </div>
                        <h3 className="text-xl font-bold mb-1">{s.title}</h3>
                        <p className="text-sm text-slate-400">{s.description}</p>
                        {i === currentStage && (
                            <div className="mt-3">
                                <div className="w-full bg-primary/10 h-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-primary h-full rounded-full shadow-[0_0_15px_#3713ec] transition-all"
                                        style={{ width: `${Math.max(0, (timeLeft / (s.timeLimit || 20)) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        {s.completed && (
                            <div className="mt-2">
                                <span className="text-green-400 text-xs font-bold uppercase tracking-widest">✓ Concluída</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Center: Lock visual + challenge */}
            <div className="flex-grow flex flex-col items-center justify-center">
                {/* Lock circle */}
                <div className="relative w-64 h-64 flex items-center justify-center mb-8">
                    <div className="absolute inset-0 border-8 border-primary/5 rounded-full scale-110" />
                    <div className="absolute inset-0 border-[16px] border-primary/10 rounded-full scale-100" />
                    <div className="w-full h-full glass-panel rounded-full flex items-center justify-center border-4 border-primary/30 relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/5" />
                        <div className="scanning-line opacity-50" />
                        <div className="w-3/4 h-3/4 border-2 border-dashed border-primary/40 rounded-full flex items-center justify-center">
                            <div className="w-4/5 h-4/5 bg-[#131022] border-4 border-primary rounded-full flex flex-col items-center justify-center glow-active">
                                <span className="material-icons text-6xl text-primary mb-1">
                                    {stages.every((s: any) => s.completed) ? 'lock_open' : 'lock'}
                                </span>
                                <span className="text-2xl font-black tracking-tighter">
                                    {currentStage + 1}/{stages.length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Current attacker */}
                <div className="text-center mb-6">
                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Atacante</p>
                    <p className="text-2xl font-black text-primary">{attackerName}</p>
                </div>

                {/* Stage challenge content */}
                {stage && !stage.completed && (
                    <div className="glass-panel p-6 rounded-2xl w-full max-w-xl text-center border-t-2 border-primary/50">
                        <h4 className="text-primary font-bold text-xs uppercase tracking-widest mb-3">
                            {stage.title}
                        </h4>

                        {stage.type === 'sequence' && (
                            <div className="mb-6">
                                <p className="text-lg text-white/80 mb-4">Qual é o próximo número?</p>
                                <div className="flex justify-center gap-3 mb-6">
                                    {stage.data.sequence?.map((n: number, i: number) => (
                                        <span key={i} className="bg-primary/20 px-4 py-2 rounded-lg font-bold text-xl text-primary">
                                            {n}
                                        </span>
                                    ))}
                                    <span className="bg-primary/10 px-4 py-2 rounded-lg font-bold text-xl text-primary/50 border-2 border-dashed border-primary/30">
                                        ?
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {stage.data.options?.map((opt: number, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => onAnswer(currentStage, i)}
                                            className="bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 rounded-xl py-3 font-bold text-lg transition-all active:scale-95"
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {stage.type === 'pattern' && (
                            <div className="mb-6">
                                <p className="text-lg text-white/80 mb-4">{stage.data.question}</p>
                                <div className="flex justify-center gap-4 mb-6">
                                    {stage.data.pairs?.map((p: string, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => onAnswer(currentStage, i)}
                                            className="w-16 h-16 bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 rounded-xl flex items-center justify-center text-3xl transition-all active:scale-95"
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {stage.type === 'estimation' && (
                            <div className="mb-6">
                                <p className="text-lg text-white/80 mb-6">{stage.data.question}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {stage.data.options?.map((opt: number, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => onAnswer(currentStage, i)}
                                            className="bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 rounded-xl py-3 font-bold text-lg transition-all active:scale-95"
                                        >
                                            {opt.toLocaleString('pt-BR')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Force next button */}
                <button
                    onClick={onForceNext}
                    className="mt-6 text-white/30 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                    <span className="material-icons text-sm">skip_next</span>
                    Pular Desafio
                </button>
            </div>

            {/* Right: Timer */}
            <div className="w-64 flex flex-col gap-6 justify-center shrink-0">
                <div className="timer-gradient p-6 rounded-2xl glow-primary text-center border-2 border-primary/30">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Tempo Restante</p>
                    <div className="text-6xl font-black tracking-tighter text-white font-mono">
                        {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                    </div>
                    <div className="mt-4">
                        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="bg-white h-full transition-all"
                                style={{ width: `${Math.max(0, (timeLeft / (stage?.timeLimit || 20)) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
