'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    onContinue: () => void;
}

const RARITY_CONFIG: Record<string, { label: string; icon: string; color: string; border: string; bg: string; glow: string }> = {
    comum: {
        label: 'Comum',
        icon: 'poker_chip',
        color: 'text-gray-400',
        border: 'border-gray-500/30',
        bg: 'bg-gray-500/10',
        glow: 'shadow-none',
    },
    raro: {
        label: 'Raro',
        icon: 'diamond',
        color: 'text-accent-emerald',
        border: 'border-accent-emerald/50',
        bg: 'bg-accent-emerald/10',
        glow: 'shadow-[0_0_40px_rgba(0,230,118,0.2)]',
    },
    lendario: {
        label: 'Lendário',
        icon: 'auto_awesome',
        color: 'text-primary',
        border: 'border-primary/50',
        bg: 'bg-primary/10',
        glow: 'shadow-[0_0_60px_rgba(247,183,49,0.3)]',
    },
};

// Animated counter component
function AnimatedCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
    const [display, setDisplay] = useState(0);
    const frameRef = useRef<number>(0);

    useEffect(() => {
        const start = performance.now();
        const abs = Math.abs(value);

        function animate(time: number) {
            const elapsed = time - start;
            const progress = Math.min(elapsed / (duration * 1000), 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(eased * abs));

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            }
        }

        frameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameRef.current);
    }, [value, duration]);

    const sign = value < 0 ? '-' : '+';
    return <>{sign}{display}</>;
}

// Particle ring for legendary items
function ParticleRing({ count = 20, color }: { count?: number; color: string }) {
    return (
        <div className="absolute inset-0 pointer-events-none z-0">
            {Array.from({ length: count }).map((_, i) => {
                const angle = (360 / count) * i;
                const delay = (i / count) * 2;
                return (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0.5],
                            x: [0, Math.cos(angle * Math.PI / 180) * 120],
                            y: [0, Math.sin(angle * Math.PI / 180) * 120],
                        }}
                        transition={{
                            duration: 2,
                            delay: 0.8 + delay,
                            repeat: Infinity,
                            repeatDelay: 1,
                        }}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: color,
                            boxShadow: `0 0 8px ${color}`,
                        }}
                    />
                );
            })}
        </div>
    );
}

export default function RevealView({ gameState, onContinue }: Props) {
    const box = gameState?.revealBox
        || gameState?.boxes?.find((candidate: any) => candidate.id === gameState?.lastRevealedBoxId)
        || null;
    if (!box) return null;

    const rarity = RARITY_CONFIG[box.rarity] || RARITY_CONFIG.comum;
    const isPegadinha = box.points < 0;
    const isLendario = box.rarity === 'lendario';
    const deliveredByTeam = box.openedByTeamId
        ? gameState.teams?.[box.openedByTeamId]?.name || `Equipe ${box.openedByTeamId}`
        : null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center min-h-0 bg-background-dark text-white font-body p-4 rounded-3xl relative overflow-hidden"
        >
            {/* Background glow — pulsing for dramatic effect */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.6, 0.3],
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className={cn(
                    "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none",
                    isPegadinha ? "bg-accent-red/15" : rarity.bg
                )}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-background-dark/50 pointer-events-none" />

            {/* Legendary particle ring */}
            {isLendario && !isPegadinha && (
                <ParticleRing color="#F7B731" />
            )}

            <motion.div
                initial={{ scale: 0.5, y: 60 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0.35, duration: 0.8 }}
                className="relative z-10 flex flex-col items-center text-center max-w-lg"
            >
                {/* Rarity badge */}
                <motion.div
                    initial={{ scale: 0, rotateZ: -20 }}
                    animate={{ scale: 1, rotateZ: 0 }}
                    transition={{ delay: 0.3, type: 'spring', bounce: 0.5 }}
                    className={cn("chip-badge mb-6", rarity.border, rarity.bg, rarity.color)}
                >
                    <span className="material-icons text-base">{rarity.icon}</span>
                    {rarity.label}
                </motion.div>

                {/* Prize Icon — with rotation reveal */}
                <motion.div
                    initial={{ scale: 0, rotateZ: -45, rotateY: 90 }}
                    animate={{ scale: 1, rotateZ: 0, rotateY: 0 }}
                    transition={{ delay: 0.5, type: 'spring', bounce: 0.4, duration: 0.8 }}
                    className={cn(
                        "w-32 h-32 rounded-3xl grid place-items-center mb-8 border",
                        rarity.bg, rarity.border, rarity.glow,
                        isLendario && "animate-[revelationGlow_1.5s_ease-out_0.8s_forwards]"
                    )}
                    style={{ perspective: '600px' }}
                >
                    <motion.span
                        animate={isLendario ? { rotateZ: [0, 5, -5, 0] } : {}}
                        transition={isLendario ? { duration: 2, repeat: Infinity } : {}}
                        className={cn("material-icons text-7xl", rarity.color)}
                    >
                        {box.icon || 'redeem'}
                    </motion.span>
                </motion.div>

                {/* Prize Name */}
                <motion.h1
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className={cn("text-4xl md:text-5xl font-display font-black uppercase tracking-wider", rarity.color)}
                    style={rarity.color === 'text-primary' ? { textShadow: '0 0 30px rgba(247,183,49,0.4)' } : {}}
                >
                    {box.prizeLabel}
                </motion.h1>

                {/* Points — animated counter */}
                <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.0 }}
                    className="mt-4"
                >
                    {isPegadinha ? (
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 0.5, repeat: 3 }}
                            className="flex items-center gap-3"
                        >
                            <span className="material-icons text-3xl text-accent-red animate-pulse">warning</span>
                            <span className="text-5xl font-black text-accent-red text-glow-red">
                                <AnimatedCounter value={box.points} duration={1.2} /> pts
                            </span>
                        </motion.div>
                    ) : (
                        <span className="text-5xl font-black text-accent-emerald text-glow-green">
                            <AnimatedCounter value={box.points} duration={1.5} /> pts
                        </span>
                    )}
                </motion.div>

                {/* Delivered By */}
                {deliveredByTeam && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.2 }}
                        className="mt-6 text-sm text-white/40 font-bold uppercase tracking-wider"
                    >
                        Entregue por <span className="text-white/60">{deliveredByTeam}</span>
                    </motion.p>
                )}

                {/* Continue Button */}
                <motion.button
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.5 }}
                    onClick={onContinue}
                    className="btn-primary mt-10 px-10 py-5 text-lg"
                >
                    <span className="material-icons">arrow_forward</span>
                    Continuar
                </motion.button>
            </motion.div>
        </motion.div>
    );
}
