'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    onNext: () => void;
}

export default function RevealView({ gameState, onNext }: Props) {
    const revealBoxId = gameState.lastRevealedBoxId ?? gameState.selectedBoxId;
    const box = (gameState.boxes || []).find((b: any) => b.id === revealBoxId);
    const attackerTeamId = box?.openedByTeamId || gameState.attackerTeamId;
    const attackerTeam = attackerTeamId ? (gameState.teams as Record<string, any>)?.[attackerTeamId] : null;

    if (!box) return null;

    const rarityConfig: Record<string, { label: string; color: string; bg: string; shadow: string }> = {
        comum: { label: 'Comum', color: 'text-gray-300', bg: 'bg-gray-500/20', shadow: 'shadow-none' },
        raro: { label: 'Raro', color: 'text-cyan-300', bg: 'bg-cyan-500/20', shadow: 'shadow-[0_0_50px_rgba(6,182,212,0.3)]' },
        lendario: { label: 'Lendário', color: 'text-amber-300', bg: 'bg-amber-500/20', shadow: 'shadow-[0_0_80px_rgba(245,158,11,0.5)]' },
    };
    const config = rarityConfig[box.rarity] || rarityConfig.comum;

    return (
        <div className="flex-grow grid place-items-center animate-fade-in perspective-1000">
            <motion.div
                initial={{ rotateX: 20, opacity: 0, scale: 0.8 }}
                animate={{ rotateX: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", duration: 0.8 }}
                className="glass-panel rounded-[3rem] p-12 max-w-4xl w-full text-center relative overflow-hidden ring-1 ring-white/10"
            >
                {/* Background Glow */}
                <div className={cn("absolute inset-0 pointer-events-none opacity-50 blur-3xl", config.bg)} />
                <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full opacity-20 blur-[100px]", config.bg)} />

                <div className="relative z-10 flex flex-col items-center">
                    {/* Rarity Badge */}
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className={cn("px-6 py-2 rounded-full border mb-8 backdrop-blur-md", config.bg, config.color.replace('text', 'border'))}
                    >
                        <span className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                            <span className="material-icons text-base">
                                {box.rarity === 'lendario' ? 'auto_awesome' : box.rarity === 'raro' ? 'star' : 'inventory_2'}
                            </span>
                            {config.label}
                        </span>
                    </motion.div>

                    {/* Icon */}
                    <motion.div
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", bounce: 0.5, delay: 0.3 }}
                        className={cn(
                            "w-48 h-48 rounded-[3rem] border-4 flex items-center justify-center mb-8 bg-black/20 backdrop-blur-xl relative",
                            config.color.replace('text', 'border'),
                            config.shadow
                        )}
                    >
                        <div className={cn("absolute inset-0 opacity-30 animate-pulse", config.bg)} />
                        <span className={cn("material-icons text-9xl drop-shadow-2xl", config.color)}>{box.icon}</span>
                    </motion.div>

                    {/* Prize Name */}
                    <motion.h1
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-5xl md:text-7xl font-display font-black uppercase text-balance leading-none mb-4 text-glow"
                    >
                        {box.prizeLabel}
                    </motion.h1>

                    {/* Points */}
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.6, type: "spring" }}
                        className="mb-8"
                    >
                        <p className={cn(
                            "text-6xl md:text-8xl font-black font-mono tracking-tighter flex items-center justify-center gap-2",
                            box.points >= 0 ? "text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.6)]" : "text-red-400 drop-shadow-[0_0_30px_rgba(248,113,113,0.6)]"
                        )}>
                            {box.points > 0 ? '+' : ''}{box.points}
                            <span className="text-2xl font-body font-bold text-white/40 tracking-widest uppercase self-end mb-4">pts</span>
                        </p>
                    </motion.div>

                    {/* Team Info */}
                    {attackerTeam && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="bg-white/5 border border-white/10 rounded-2xl px-8 py-4 mb-8"
                        >
                            <p className="text-white/60 text-sm uppercase tracking-widest font-bold mb-1">Entregue para</p>
                            <p className="text-2xl font-black text-white">{attackerTeam.name}</p>
                        </motion.div>
                    )}

                    {/* Warnings */}
                    {box.points < 0 && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 'auto', opacity: 1 }}
                            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-red-500/20 border border-red-500/40 text-red-200 font-bold mb-8"
                        >
                            <span className="material-icons">warning_amber</span>
                            <span className="uppercase tracking-wide text-xs">Pegadinha! Pontos Negativos</span>
                        </motion.div>
                    )}

                    {/* Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onNext}
                        className="btn-primary px-12 py-5 text-lg rounded-2xl shadow-xl"
                    >
                        Continuar
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
}
