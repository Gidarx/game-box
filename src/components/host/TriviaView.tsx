'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
}

function CountdownOverlay({ onComplete }: { onComplete: () => void }) {
    const [count, setCount] = useState(3);

    useEffect(() => {
        if (count <= 0) {
            onComplete();
            return;
        }
        const timer = setTimeout(() => setCount(c => c - 1), 700);
        return () => clearTimeout(timer);
    }, [count, onComplete]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-background-dark/80 backdrop-blur-md rounded-3xl"
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={count}
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.175, 0.885, 0.32, 1.275] }}
                    className="flex flex-col items-center"
                >
                    {count > 0 ? (
                        <span className="text-[12rem] font-black font-display text-primary leading-none"
                            style={{ textShadow: '0 0 60px rgba(247,183,49,0.5), 0 0 120px rgba(247,183,49,0.2)' }}
                        >
                            {count}
                        </span>
                    ) : (
                        <span className="text-8xl font-black font-display text-accent-emerald uppercase tracking-widest"
                            style={{ textShadow: '0 0 40px rgba(0,230,118,0.6)' }}
                        >
                            GO!
                        </span>
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
}

export default function TriviaView({ gameState }: Props) {
    const question = gameState?.currentQuestion;
    const totalTime = Math.max(1, Number(question?.timeLimit) || 12);
    const [now, setNow] = useState(() => Date.now());
    const [showCountdown, setShowCountdown] = useState(false);
    const questionIdRef = useRef<string | null>(null);

    // Trigger countdown on new question
    useEffect(() => {
        const qId = question?.id || question?.text;
        if (qId && qId !== questionIdRef.current) {
            questionIdRef.current = qId;
            setShowCountdown(true);
        }
    }, [question?.id, question?.text]);

    useEffect(() => {
        const timerEndAt = Number(gameState?.timerEndAt) || 0;
        if (!timerEndAt || gameState?.phase !== 'trivia_all') return;

        const interval = setInterval(() => {
            setNow(Date.now());
        }, 100);

        return () => clearInterval(interval);
    }, [gameState?.timerEndAt, gameState?.phase]);

    const timerEndAt = Number(gameState?.timerEndAt) || 0;
    const timeLeft = timerEndAt
        ? Math.max(0, Math.ceil((timerEndAt - now) / 1000))
        : totalTime;

    const progress = useMemo(() => {
        return Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));
    }, [timeLeft, totalTime]);

    const isUrgent = timeLeft <= 4;
    const options = Array.isArray(question?.options) ? question.options : [];
    const answeredCount = Number(gameState?.answeredCount) || 0;
    const eligibleCount = Number(gameState?.eligibleCount) || 0;
    const cardSuits = ['♠', '♥', '♦', '♣'];

    // SVG circular timer
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress / 100);

    return (
        <div className="flex-1 flex flex-col gap-5 animate-fade-in min-h-0 bg-background-dark text-white font-body p-4 rounded-3xl relative">
            {/* Countdown Overlay */}
            <AnimatePresence>
                {showCountdown && (
                    <CountdownOverlay onComplete={() => setShowCountdown(false)} />
                )}
            </AnimatePresence>

            <header className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                <div className="flex items-center gap-4">
                    <div className="chip-badge py-2 px-4">
                        <span className="material-icons text-[14px] text-primary">category</span>
                        {question?.category || 'Geral'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/40">
                        <span className="material-icons text-base text-accent-emerald">groups</span>
                        <span className="font-bold text-white">{answeredCount}</span>/<span>{eligibleCount}</span>
                        <span className="text-xs">responderam</span>
                    </div>
                </div>

                {/* Circular Timer */}
                <div className={cn(
                    'flex items-center gap-4 px-5 py-3 rounded-xl border transition-all',
                    isUrgent
                        ? 'bg-accent-red/15 border-accent-red/40 shadow-[0_0_20px_rgba(255,23,68,0.2)]'
                        : 'bg-surface-dark border-primary/10'
                )}>
                    <div className={cn("relative w-20 h-20", isUrgent && "animate-[urgentShake_0.4s_ease-in-out_infinite]")}>
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 84 84">
                            {/* Background circle */}
                            <circle cx="42" cy="42" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                            {/* Progress circle */}
                            <motion.circle
                                cx="42" cy="42" r={radius}
                                fill="none"
                                stroke={isUrgent ? '#FF1744' : '#F7B731'}
                                strokeWidth="5"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={false}
                                animate={{ strokeDashoffset }}
                                transition={{ duration: 0.2 }}
                                style={{
                                    filter: isUrgent
                                        ? 'drop-shadow(0 0 8px rgba(255,23,68,0.5))'
                                        : 'drop-shadow(0 0 5px rgba(247,183,49,0.3))',
                                }}
                            />
                        </svg>
                        {/* Center number */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <motion.span
                                key={timeLeft}
                                initial={{ scale: 1.3 }}
                                animate={{ scale: 1 }}
                                className={cn(
                                    'text-2xl font-mono font-black tabular-nums',
                                    isUrgent ? 'text-accent-red text-glow-red' : 'text-primary text-glow'
                                )}
                            >
                                {timeLeft}
                            </motion.span>
                        </div>
                    </div>
                </div>
            </header>

            <motion.div
                key={question?.id || 'no-question'}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="glass-panel rounded-2xl p-10 text-center relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-b from-primary/3 to-transparent pointer-events-none" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary/30 mb-4 font-black">Pergunta</p>
                <h2 className="text-2xl md:text-4xl font-display font-black uppercase tracking-wide leading-snug max-w-4xl mx-auto">
                    {question?.text || 'Aguardando pergunta...'}
                </h2>
            </motion.div>

            <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                {options.map((opt: string, i: number) => (
                    <motion.div
                        key={`${question?.id || 'q'}-${i}`}
                        initial={{ x: i % 2 === 0 ? -40 : 40, rotateZ: i % 2 === 0 ? -3 : 3, opacity: 0 }}
                        animate={{ x: 0, rotateZ: 0, opacity: 1 }}
                        transition={{ delay: 0.15 + i * 0.1, type: 'spring', stiffness: 150, damping: 15 }}
                        className="rounded-2xl border p-6 flex items-center gap-6 transition-all duration-300 bg-surface-dark border-primary/5 hover:border-primary/15"
                    >
                        <span className="text-3xl font-black font-display flex-shrink-0 text-primary/20">
                            {cardSuits[i] || '•'}
                        </span>
                        <p className="text-lg md:text-xl font-bold leading-snug text-white">
                            {opt}
                        </p>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
