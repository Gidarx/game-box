'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    onApply: (teamId: string) => void;
    onSkip: () => void;
}

const WILDCARD_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    freeze: { bg: 'bg-accent-cyan/10', border: 'border-accent-cyan/30', text: 'text-accent-cyan', glow: 'shadow-[0_0_30px_rgba(0,229,255,0.2)]' },
    steal: { bg: 'bg-accent-red/10', border: 'border-accent-red/30', text: 'text-accent-red', glow: 'shadow-[0_0_30px_rgba(255,23,68,0.2)]' },
    boost: { bg: 'bg-accent-emerald/10', border: 'border-accent-emerald/30', text: 'text-accent-emerald', glow: 'shadow-[0_0_30px_rgba(0,230,118,0.2)]' },
    shield: { bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary', glow: 'shadow-[0_0_30px_rgba(247,183,49,0.2)]' },
};

export default function WildcardOverlay({ gameState, onApply, onSkip }: Props) {
    const wildcard = gameState?.activeWildcard;
    if (!wildcard) return null;

    const teams = Object.entries(gameState?.teams || {}).map(([id, team]: [string, any]) => ({ id, ...team }));
    const colors = WILDCARD_COLORS[wildcard.type] || WILDCARD_COLORS.shield;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg p-4"
            >
                {/* Background radial glow */}
                <div className={cn(
                    "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[150px] pointer-events-none",
                    colors.bg
                )} />

                <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: 30 }}
                    transition={{ type: 'spring', bounce: 0.3 }}
                    className={cn(
                        "relative max-w-xl w-full rounded-3xl border backdrop-blur-xl p-10 text-center",
                        colors.bg, colors.border, colors.glow
                    )}
                >
                    {/* Top Gold Line */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

                    {/* Joker Badge */}
                    <motion.div
                        initial={{ rotateZ: -15 }}
                        animate={{ rotateZ: [15, -15, 15] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="mb-6"
                    >
                        <span className={cn("text-[10px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border", colors.bg, colors.border, colors.text)}>
                            ♠ Wild Card ♠
                        </span>
                    </motion.div>

                    {/* Icon */}
                    <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={cn("w-24 h-24 mx-auto rounded-2xl grid place-items-center border mb-6", colors.bg, colors.border, colors.glow)}
                    >
                        <span className={cn("material-icons text-6xl", colors.text)}>
                            {wildcard.icon || 'style'}
                        </span>
                    </motion.div>

                    {/* Title & Description */}
                    <h2 className={cn("text-3xl font-display font-black uppercase tracking-wider", colors.text)}>
                        {wildcard.name}
                    </h2>
                    <p className="text-white/50 mt-3 max-w-sm mx-auto">
                        {wildcard.description}
                    </p>

                    {/* Team Selection */}
                    <div className="mt-8 space-y-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-black">Aplicar em qual equipe?</p>
                        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                            {teams.map((team) => (
                                <motion.button
                                    key={team.id}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => onApply(team.id)}
                                    className="bg-surface-dark border border-primary/10 hover:border-primary/30 rounded-xl p-4 text-left transition-all group"
                                >
                                    <p className="font-bold text-lg group-hover:text-primary transition-colors">{team.name || `Equipe ${team.id}`}</p>
                                    <p className="text-xs text-white/25 mt-1">{team.score || 0} pts</p>
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Skip */}
                    <button
                        onClick={onSkip}
                        className="mt-6 btn-ghost py-3 px-8 text-xs mx-auto"
                    >
                        <span className="material-icons text-sm">close</span>
                        Pular Wildcard
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
