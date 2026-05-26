'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    onForceNext: () => void;
}

export default function Leaderboard({ gameState, onForceNext }: Props) {

    const teams = Object.entries(gameState?.teams || {})
        .map(([id, team]: [string, any]) => ({ id, ...team }))
        .sort((a, b) => (b.score || 0) - (a.score || 0));

    const connectedPlayers = Object.values(gameState?.players || {}).filter((p: any) => p.isConnected).length;
    const metrics = gameState?.metrics || {};
    const avgRoundTimeSec = Math.round((Number(metrics.avgRoundDurationMs || 0) / 1000) * 10) / 10;
    const accuracyPct = Math.round((Number(metrics.triviaAccuracyRate || 0) * 1000)) / 10;
    const topDeadlyCard = Array.isArray(metrics.deadliestCards) && metrics.deadliestCards.length > 0
        ? metrics.deadliestCards[0]
        : null;

    return (
        <motion.aside
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="w-80 xl:w-96 min-h-0 glass-panel rounded-2xl flex flex-col relative overflow-hidden"
        >
            {/* Gold top line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            {/* Header */}
            <div className="p-6 pb-4 border-b border-primary/5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary/40 font-black mb-2">♦ VIP Scoreboard</p>
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-display font-black uppercase tracking-wider">Placar Geral</h3>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                        <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                        {connectedPlayers} online
                    </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
                    <span>Rodada <span className="text-primary font-bold">{gameState?.round}</span>/{gameState?.maxRounds}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                    <div className="rounded-lg bg-primary/5 border border-primary/10 px-2 py-1">
                        <p className="text-white/30 uppercase tracking-wider">Tempo medio</p>
                        <p className="font-bold text-white">{avgRoundTimeSec || 0}s</p>
                    </div>
                    <div className="rounded-lg bg-primary/5 border border-primary/10 px-2 py-1">
                        <p className="text-white/30 uppercase tracking-wider">Precisao</p>
                        <p className="font-bold text-white">{accuracyPct || 0}%</p>
                    </div>
                    <div className="rounded-lg bg-primary/5 border border-primary/10 px-2 py-1">
                        <p className="text-white/30 uppercase tracking-wider">Carta letal</p>
                        <p className="font-bold text-white truncate">{topDeadlyCard?.word || '--'}</p>
                    </div>
                </div>
            </div>

            {/* Rankings */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {teams.map((team, index) => {
                    const isFirst = index === 0;
                    const players = Object.values(gameState?.players || {})
                        .filter((p: any) => p.teamId === team.id && p.isConnected) as any[];

                    return (
                        <motion.div
                            key={team.id}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.08 }}
                            className={cn(
                                "rounded-xl border p-4 transition-all relative overflow-hidden",
                                isFirst
                                    ? "bg-primary/8 border-primary/25 shadow-[0_0_25px_rgba(247,183,49,0.1)]"
                                    : "bg-surface-dark/50 border-primary/5"
                            )}
                        >
                            {isFirst && (
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                            )}

                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-4">
                                    <span className={cn(
                                        "text-2xl font-black font-mono flex-shrink-0",
                                        isFirst ? "text-primary text-glow" : "text-white/15"
                                    )}>
                                        {isFirst ? '♛' : `#${index + 1}`}
                                    </span>

                                    <div
                                        className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center border text-lg font-black",
                                            isFirst
                                                ? "bg-primary/15 border-primary/30 text-primary"
                                                : "bg-white/5 border-white/10 text-white/30"
                                        )}
                                        style={team.color ? { borderColor: team.color + '50', color: team.color } : {}}
                                    >
                                        <span className="material-icons">groups</span>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-base truncate max-w-[120px]">{team.name || `Equipe ${team.id}`}</h4>
                                        <p className="text-[10px] text-white/25 font-medium uppercase tracking-wider">{players.length} jogador{players.length !== 1 ? 'es' : ''}</p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className={cn(
                                        "text-2xl font-black tabular-nums",
                                        isFirst ? "text-primary" : "text-white"
                                    )}>
                                        {team.score || 0}
                                    </p>
                                    <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium">pts</p>
                                </div>
                            </div>

                            {/* Inventory summary */}
                            {team.inventory && team.inventory.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-primary/5">
                                    {team.inventory.slice(0, 5).map((item: any, idx: number) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10 text-[10px] font-bold uppercase tracking-wider text-white/40"
                                        >
                                            {item.prizeLabel || item.label || String(item.boxId || item)}
                                        </span>
                                    ))}
                                    {team.inventory.length > 5 && (
                                        <span className="px-2 py-0.5 rounded-md bg-primary/5 text-[10px] font-bold text-primary/40">+{team.inventory.length - 5}</span>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-primary/5">
                <button
                    onClick={onForceNext}
                    className="w-full btn-secondary py-3 text-xs"
                >
                    <span className="material-icons text-sm">skip_next</span>
                    Forçar Próxima Fase
                </button>
            </div>
        </motion.aside>
    );
}
