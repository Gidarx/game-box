'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    onStageComplete: (stageId: number, answer: any) => void;
}

interface Stage {
    id: number;
    title: string;
    description: string;
    type: string;
    timeLimit: number;
    data: any;
}

export default function UnlockChallenge({ gameState, onStageComplete }: Props) {
    const stages = (gameState?.unlockStages || []) as Stage[];
    const currentStageIndex = gameState?.currentStageIndex || 0;
    const stage = stages[currentStageIndex];
    const [timeLeft, setTimeLeft] = useState(stage?.timeLimit || 30);
    const [answer, setAnswer] = useState<any>(null);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 0) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [currentStageIndex]);

    const handleSubmit = () => {
        if (stage && !submitted) {
            onStageComplete(stage.id, answer);
            setSubmitted(true);
        }
    };

    const isUrgent = timeLeft <= 10;
    const progress = stage?.timeLimit ? (timeLeft / stage.timeLimit) * 100 : 0;

    return (
        <div className="flex-1 flex flex-col gap-5 animate-fade-in min-h-0 bg-background-dark text-white font-body p-4 rounded-3xl">
            {/* Header */}
            <header className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="chip-badge">
                        <span className="material-icons text-[14px] text-primary">lock_open</span>
                        Desafio de Desbloqueio
                    </div>

                    <div className={cn(
                        "flex items-center gap-3 px-4 py-2 rounded-xl border transition-all",
                        isUrgent
                            ? "bg-accent-red/15 border-accent-red/30 shadow-[0_0_15px_rgba(255,23,68,0.15)]"
                            : "bg-surface-dark border-primary/10"
                    )}>
                        <span className={cn(
                            "material-icons text-lg",
                            isUrgent ? "text-accent-red animate-pulse" : "text-primary"
                        )}>timer</span>
                        <span className={cn(
                            "text-2xl font-mono font-black tabular-nums",
                            isUrgent ? "text-accent-red" : "text-primary"
                        )}>{timeLeft}s</span>
                    </div>
                </div>

                {/* Stage Progress */}
                <div className="flex items-center gap-3">
                    {stages.map((_, i) => (
                        <div key={i} className="flex items-center gap-2 flex-1">
                            <div className={cn(
                                "w-10 h-10 rounded-xl grid place-items-center border font-black text-sm transition-all",
                                i < currentStageIndex
                                    ? "bg-accent-emerald/15 border-accent-emerald/40 text-accent-emerald"
                                    : i === currentStageIndex
                                        ? "bg-primary/15 border-primary/40 text-primary shadow-[0_0_15px_rgba(247,183,49,0.2)]"
                                        : "bg-surface-dark border-white/5 text-white/20"
                            )}>
                                {i < currentStageIndex ? (
                                    <span className="material-icons text-sm">check</span>
                                ) : (
                                    i + 1
                                )}
                            </div>
                            {i < stages.length - 1 && (
                                <div className={cn(
                                    "flex-1 h-1 rounded-full",
                                    i < currentStageIndex ? "bg-accent-emerald/30" : "bg-white/5"
                                )} />
                            )}
                        </div>
                    ))}
                </div>
            </header>

            {/* Stage Content */}
            {stage && (
                <motion.div
                    key={currentStageIndex}
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex-1 flex flex-col gap-4 min-h-0"
                >
                    <div className="glass-panel rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/3 to-transparent pointer-events-none" />

                        <h2 className="text-3xl font-display font-black uppercase tracking-wide mb-3 relative z-10">{stage.title}</h2>
                        <p className="text-white/50 max-w-md relative z-10">{stage.description}</p>

                        {/* Timer progress bar */}
                        <div className="w-full max-w-md h-2 mt-6 bg-black/30 rounded-full overflow-hidden relative z-10">
                            <motion.div
                                initial={false}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5 }}
                                className={cn(
                                    "h-full rounded-full",
                                    isUrgent
                                        ? "bg-gradient-to-r from-accent-red to-orange-500"
                                        : "bg-gradient-to-r from-primary to-accent-emerald"
                                )}
                            />
                        </div>
                    </div>

                    {/* Challenge Area */}
                    <div className="flex-1 glass-panel rounded-2xl p-8 flex flex-col items-center justify-center min-h-0 relative overflow-hidden">
                        <div className="scanning-line" />

                        {stage.type === 'sequence' && stage.data?.options && (
                            <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
                                {stage.data.options.map((opt: string, i: number) => (
                                    <motion.button
                                        key={i}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setAnswer(opt)}
                                        className={cn(
                                            "p-5 rounded-xl border text-center font-bold text-lg transition-all",
                                            answer === opt
                                                ? "bg-primary/15 border-primary/40 text-primary shadow-[0_0_15px_rgba(247,183,49,0.2)]"
                                                : "bg-surface-dark border-primary/5 text-white hover:border-primary/20"
                                        )}
                                    >
                                        {opt}
                                    </motion.button>
                                ))}
                            </div>
                        )}

                        {stage.type === 'pattern' && stage.data?.grid && (
                            <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
                                {stage.data.grid.map((cell: any, i: number) => (
                                    <button
                                        key={i}
                                        onClick={() => setAnswer(i)}
                                        className={cn(
                                            "aspect-square rounded-xl border grid place-items-center transition-all",
                                            answer === i
                                                ? "bg-primary/15 border-primary/40 text-primary"
                                                : cell.active
                                                    ? "bg-accent-emerald/10 border-accent-emerald/30 text-accent-emerald"
                                                    : "bg-surface-dark border-primary/5 hover:border-primary/20"
                                        )}
                                    >
                                        {cell.icon && <span className="material-icons text-2xl">{cell.icon}</span>}
                                    </button>
                                ))}
                            </div>
                        )}

                        {stage.type === 'estimation' && (
                            <div className="w-full max-w-md flex flex-col items-center gap-6">
                                <input
                                    type="number"
                                    value={answer || ''}
                                    onChange={e => setAnswer(e.target.value)}
                                    className="w-full bg-surface-dark border border-primary/10 rounded-xl px-5 py-4 text-3xl font-mono font-black text-center text-primary focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                    placeholder="?"
                                />
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Footer */}
            <footer className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="text-xs text-white/30 font-bold uppercase tracking-wider">
                    Etapa {currentStageIndex + 1} de {stages.length}
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={submitted || answer === null}
                    className="btn-primary px-8 py-3"
                >
                    <span className="material-icons">send</span>
                    {submitted ? 'Enviado' : 'Confirmar'}
                </button>
            </footer>
        </div>
    );
}
