'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    onApply: (targetTeamId: string) => void;
    onSkip: () => void;
}

const WILDCARD_ICONS: Record<string, string> = {
    FREEZE: 'ac_unit',
    STEAL: 'swap_horizontal_circle',
    SHIELD: 'shield',
    SWAP: 'swap_horiz',
    DUEL: 'swords',
    WHOS_NEXT: 'person_search',
};

const WILDCARD_COLORS: Record<string, string> = {
    FREEZE: 'text-cyan-400',
    STEAL: 'text-purple-400',
    SHIELD: 'text-emerald-400',
    SWAP: 'text-pink-400',
    DUEL: 'text-red-400',
    WHOS_NEXT: 'text-amber-400',
};

export default function WildcardOverlay({ gameState, onApply, onSkip }: Props) {
    const card = gameState.currentWildcard;
    const teams = Object.values(gameState.teams || {}) as any[];

    if (!card) return null;

    const icon = WILDCARD_ICONS[card.type] || 'style';
    const color = WILDCARD_COLORS[card.type] || 'text-white';

    return (
        <div className="flex-grow flex flex-col items-center justify-center relative animate-fade-in p-6 z-50">
            {/* Background Overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-background-dark/80 backdrop-blur-md z-0"
            />

            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.8 }}
                className="w-full max-w-4xl glass-panel rounded-[2.5rem] p-8 md:p-12 relative z-10 border-white/10 shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
                        <span className="material-icons text-sm text-white/60">bolt</span>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Evento Wildcard</span>
                    </div>

                    <motion.div
                        initial={{ rotate: -180, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring' }}
                        className="mb-6"
                    >
                        <span className={cn("material-icons text-9xl drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]", color)}>
                            {icon}
                        </span>
                    </motion.div>

                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-2 text-balance">{card.name}</h1>
                    <p className="text-xl text-white/60 max-w-2xl text-balance leading-relaxed">{card.description}</p>
                </div>

                {/* Team Selection */}
                <div className="bg-surface-dark/50 rounded-3xl p-6 border border-white/5">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <h3 className="text-lg font-black uppercase tracking-wide">Selecionar Alvo</h3>
                        <p className="text-xs uppercase tracking-[0.14em] text-white/40 font-bold">Times Ativos</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-8">
                        {teams.map((team: any, i: number) => (
                            <motion.button
                                key={team.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 + (i * 0.1) }}
                                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onApply(team.id)}
                                className="group relative rounded-2xl p-4 border border-white/10 bg-surface-dark transition-all text-left flex items-center gap-4 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                                <span
                                    className="w-12 h-12 rounded-xl border-2 grid place-items-center text-sm font-black shadow-lg"
                                    style={{ borderColor: team.color, backgroundColor: `${team.color}20`, color: team.color }}
                                >
                                    {team.name?.[0]?.toUpperCase() || '?'}
                                </span>
                                <div>
                                    <p className="font-black text-lg uppercase tracking-tight">{team.name}</p>
                                    <p className="text-sm text-white/40 font-bold">{team.score} pts</p>
                                </div>
                                <span className="material-icons ml-auto text-white/10 group-hover:text-primary transition-colors">target</span>
                            </motion.button>
                        ))}
                    </div>

                    <div className="text-center">
                        <button
                            onClick={onSkip}
                            className="text-xs font-bold uppercase tracking-[0.15em] text-white/30 hover:text-white/60 transition-colors border-b border-transparent hover:border-white/30 pb-0.5"
                        >
                            Pular este efeito
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
