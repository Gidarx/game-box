'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    roomCode: string;
}

export default function TriviaView({ gameState, roomCode }: Props) {
    const { on, emit } = useSocket();
    const [triviaResult, setTriviaResult] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(12);
    const [answeredCount, setAnsweredCount] = useState(0);

    const question = gameState.currentQuestion;
    const connectedPlayers = Object.values(gameState.players || {}).filter((p: any) => p.isConnected).length;
    const totalPlayers = gameState.eligibleCount ?? connectedPlayers;

    // Timer Logic
    useEffect(() => {
        if (!gameState.timerEndAt) return;
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((gameState.timerEndAt - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearInterval(interval);
                emit('trivia:forceResolve', { roomCode });
            }
        }, 100);
        return () => clearInterval(interval);
    }, [gameState.timerEndAt, roomCode, emit]);

    // Socket Events
    useEffect(() => {
        const unsubs: (() => void)[] = [];
        unsubs.push(on('trivia:playerAnswered', (data: any) => setAnsweredCount(data.totalAnswered)));
        unsubs.push(on('trivia:result', (data: any) => setTriviaResult(data)));
        return () => unsubs.forEach(u => u());
    }, [on]);

    // Reset State on New Question
    useEffect(() => {
        const id = setTimeout(() => {
            setTriviaResult(null);
            setAnsweredCount(gameState.answeredCount || 0);
        }, 0);
        return () => clearTimeout(id);
    }, [question?.id, gameState.answeredCount]);

    if (!question) {
        return (
            <div className="flex-grow grid place-items-center glass-panel rounded-2xl">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const timerProgress = Math.min(100, (timeLeft / 12) * 100);

    return (
        <div className="flex-grow flex flex-col gap-6 animate-fade-in min-h-0 bg-background-dark text-white font-body p-4 rounded-3xl">
            {/* Header */}
            <header className="glass-panel rounded-2xl px-8 py-5 flex items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-cyan to-transparent opacity-50" />

                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center relative">
                        <span className="w-3 h-3 rounded-full bg-accent-cyan absolute -top-1 -right-1 animate-pulse shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
                        <span className="material-icons text-accent-cyan">quiz</span>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Fase Ativa</p>
                        <h2 className="text-2xl font-black uppercase tracking-wide">Trivia Geral</h2>
                    </div>
                </div>

                {/* Progress / Status */}
                <div className={cn(
                    "px-6 py-3 rounded-xl border flex items-center gap-3 transition-all",
                    triviaResult
                        ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'bg-surface-dark border-white/10'
                )}>
                    {triviaResult ? (
                        <>
                            <span className="material-icons text-emerald-400">emoji_events</span>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-emerald-400/60 font-bold">Vencedor</p>
                                <p className="text-sm font-black text-emerald-400">{triviaResult.winnerName || 'Ninguém acertou'}</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="material-icons text-white/40">groups</span>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Respostas</p>
                                <p className="text-sm font-black text-white">{answeredCount} <span className="text-white/40">/ {totalPlayers}</span></p>
                            </div>
                        </>
                    )}
                </div>

                <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Rodada</p>
                    <p className="text-3xl font-black text-glow">{gameState.round}</p>
                </div>
            </header>

            {/* Main Content */}
            <div className="glass-panel rounded-2xl p-8 md:p-12 flex-grow flex flex-col items-center justify-center min-h-0 relative">
                {/* Timer Bar */}
                <div className="absolute top-0 left-0 w-full h-2 bg-surface-dark">
                    <motion.div
                        initial={{ width: '100%' }}
                        animate={{ width: `${timerProgress}%` }}
                        transition={{ duration: 0.1, ease: 'linear' }}
                        className={cn(
                            "h-full shadow-[0_0_15px_currentColor]",
                            timeLeft <= 3 ? "bg-red-500 text-red-500" : "bg-primary text-primary"
                        )}
                    />
                </div>

                {/* Timer Display */}
                <div className="absolute top-8 right-8">
                    <div className={cn(
                        "flex flex-col items-center justify-center w-20 h-20 rounded-2xl border transition-all",
                        timeLeft <= 3 ? "bg-red-500/10 border-red-500/50 animate-pulse" : "bg-surface-dark border-white/10"
                    )}>
                        <span className="text-[10px] uppercase tracking-wider font-bold opacity-50">Tempo</span>
                        <span className={cn("text-3xl font-mono font-black", timeLeft <= 3 ? "text-red-400" : "text-white")}>
                            {timeLeft}s
                        </span>
                    </div>
                </div>

                {/* Category Pill */}
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mb-8"
                >
                    <span className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-black uppercase tracking-[0.2em] text-accent-cyan shadow-neon">
                        {question.category}
                    </span>
                </motion.div>

                {/* Question */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-4xl text-center mb-12"
                >
                    <h1 className="text-3xl md:text-5xl font-black leading-tight text-balance drop-shadow-lg">
                        {question.text}
                    </h1>
                </motion.div>

                {/* Options / Result */}
                <div className="w-full max-w-5xl">
                    <AnimatePresence mode="wait">
                        {triviaResult ? (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="grid grid-cols-2 gap-4"
                            >
                                {question.options?.map((opt: string, i: number) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "rounded-xl p-6 text-center border-2 transition-all flex items-center gap-4",
                                            i === triviaResult.correctIndex
                                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                                                : "bg-surface-dark border-white/5 text-white/30 opacity-50"
                                        )}
                                    >
                                        <span className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg",
                                            i === triviaResult.correctIndex ? "bg-emerald-500 text-black" : "bg-white/10"
                                        )}>
                                            {['A', 'B', 'C', 'D'][i]}
                                        </span>
                                        <span className="text-xl font-bold text-left">{opt}</span>
                                        {i === triviaResult.correctIndex && <span className="material-icons ml-auto text-3xl">check_circle</span>}
                                    </div>
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="waiting"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center gap-6"
                            >
                                <div className="flex flex-wrap justify-center gap-3">
                                    {Array.from({ length: totalPlayers }).map((_, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ delay: i * 0.05 }}
                                            className={cn(
                                                "w-12 h-12 rounded-xl border-2 grid place-items-center transition-all duration-300",
                                                i < answeredCount
                                                    ? "bg-primary text-white border-primary shadow-[0_0_15px_rgba(112,0,255,0.4)] scale-110"
                                                    : "bg-surface-dark border-white/10 text-white/20"
                                            )}
                                        >
                                            <span className="material-icons">
                                                {i < answeredCount ? 'check' : 'person'}
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>
                                <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/40 animate-pulse">
                                    Aguardando respostas...
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
