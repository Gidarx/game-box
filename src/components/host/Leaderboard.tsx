'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    roomCode: string;
    onForceNext: () => void;
}

export default function Leaderboard({ gameState, roomCode, onForceNext }: Props) {
    const teams = Object.values(gameState.teams || {}) as any[];
    // Sort logic handled in render to allow animation
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    const connectedPlayers = Object.values(gameState.players || {}).filter((p: any) => p.isConnected).length;

    return (
        <aside className="w-[340px] shrink-0 flex flex-col h-full bg-background-dark text-white font-body py-2 pr-4">
            <div className="glass-panel rounded-2xl h-full flex flex-col overflow-hidden border-white/10">

                {/* Header */}
                <div className="p-5 border-b border-white/5 bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-black uppercase tracking-wide flex items-center gap-2">
                            <span className="material-icons text-accent-lime">leaderboard</span>
                            Placar
                        </h3>
                        <div className="px-2 py-1 bg-white/10 rounded-lg border border-white/5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">Round {gameState.round}</span>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
                    <AnimatePresence>
                        {sorted.map((team: any, i: number) => (
                            <motion.article
                                key={team.id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className={cn(
                                    "rounded-xl p-4 border relative overflow-hidden group transition-all",
                                    i === 0
                                        ? "bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/30"
                                        : "bg-surface-dark border-white/5 hover:border-white/20"
                                )}
                            >
                                {/* Rank Badge */}
                                <div className={cn(
                                    "absolute top-0 right-0 px-2 py-1 rounded-bl-xl text-[10px] font-black font-mono",
                                    i === 0 ? "bg-amber-500 text-black" : "bg-white/5 text-white/30"
                                )}>
                                    #{i + 1}
                                </div>

                                <div className="flex items-center gap-3 mb-3">
                                    <div
                                        className="w-10 h-10 rounded-lg border grid place-items-center text-sm font-black shadow-lg"
                                        style={{
                                            borderColor: team.color,
                                            backgroundColor: `${team.color}15`,
                                            boxShadow: `0 0 15px ${team.color}15`
                                        }}
                                    >
                                        <span style={{ color: team.color }}>{team.name?.[0]?.toUpperCase()}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-bold text-sm truncate uppercase tracking-tight">{team.name}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-white/40 font-medium">{team.playerIds?.length || 0} players</span>
                                            {team.frozenUntilRound !== null && team.frozenUntilRound >= gameState.round && (
                                                <span className="text-[10px] px-1.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                                    <span className="material-icons text-[10px]">ac_unit</span>
                                                    Congelado
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-end justify-between">
                                    {/* Inventory Mini */}
                                    <div className="flex items-center -space-x-1.5 pl-1.5">
                                        {(team.inventory || []).slice(0, 3).map((item: any, idx: number) => (
                                            <div
                                                key={idx}
                                                title={item.prizeLabel}
                                                className={cn(
                                                    "w-6 h-6 rounded-full border-2 border-surface-dark grid place-items-center text-[10px] relative z-10",
                                                    item.rarity === 'lendario' ? 'bg-amber-500 text-black' :
                                                        item.rarity === 'raro' ? 'bg-cyan-500 text-black' :
                                                            'bg-slate-600 text-white'
                                                )}
                                            >
                                                {item.icon ? <span className="material-icons text-[10px]">{item.icon}</span> : '?'}
                                            </div>
                                        ))}
                                        {(team.inventory || []).length > 3 && (
                                            <div className="w-6 h-6 rounded-full border-2 border-surface-dark bg-white/10 grid place-items-center text-[8px] font-black z-20">
                                                +{team.inventory.length - 3}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-right">
                                        <p className="text-2xl font-black font-mono leading-none tracking-tight">{team.score}</p>
                                    </div>
                                </div>
                            </motion.article>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-white/5 bg-black/20">
                    <button
                        onClick={onForceNext}
                        className="btn-secondary w-full py-3 text-xs justify-between group"
                    >
                        <span>Forçar Próxima Fase</span>
                        <span className="material-icons text-base group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                    <div className="flex justify-between items-center mt-3 px-1">
                        <span className="text-[10px] uppercase tracking-wider text-white/30">
                            {connectedPlayers} Conectados
                        </span>
                        <span className="text-[10px] font-mono text-white/30">
                            {roomCode}
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
