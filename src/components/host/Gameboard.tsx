'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    onSelectBox: (boxId: number) => void;
    interactive: boolean;
    mini?: boolean;
}

const RARITY_STYLES: Record<string, string> = {
    comum: 'border-white/20 bg-white/5 text-white/60',
    raro: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]',
    lendario: 'border-amber-500/50 bg-amber-500/10 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse-glow',
};

export default function Gameboard({ gameState, onSelectBox, interactive, mini }: Props) {
    const boxes = (gameState.boxes || []) as any[];

    // Mini View (Sidebar/Footer)
    if (mini) {
        return (
            <div className="glass-panel rounded-2xl p-3 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                    {boxes.map((box: any) => (
                        <div
                            key={box.id}
                            className={cn(
                                "w-10 h-10 rounded-lg border grid place-items-center text-[10px] font-black transition-colors",
                                box.isOpen
                                    ? RARITY_STYLES[box.rarity] || 'border-primary/50 bg-primary/20 text-white'
                                    : "bg-surface-dark border-white/5 text-white/20"
                            )}
                        >
                            {box.isOpen ? <span className="material-icons text-xs">{box.icon}</span> : box.id}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Main Interactive View
    return (
        <div className="flex-grow flex flex-col gap-4 min-h-0 bg-background-dark text-white font-body p-4 rounded-3xl">
            <header className="glass-panel rounded-2xl p-6 flex items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-accent-pink animate-pulse" />
                        <p className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40">Fase Atual</p>
                    </div>
                    <h2 className="text-3xl font-display font-black uppercase tracking-wide text-glow">Escolha da Caixa</h2>
                </div>
                <div className="metric-pill bg-surface-dark border-white/10 text-sm py-2 px-4">
                    Sala <span className="text-primary ml-2 font-mono">{gameState.roomCode}</span>
                </div>
            </header>

            <div className="flex-grow grid grid-cols-4 grid-rows-4 gap-4 min-h-0 p-2">
                {boxes.slice(0, -1).map((box: any, i: number) => (
                    <motion.button
                        key={box.id}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        whileHover={interactive && !box.isOpen ? { scale: 1.05, y: -5 } : {}}
                        whileTap={interactive && !box.isOpen ? { scale: 0.95 } : {}}
                        onClick={() => interactive && !box.isOpen && onSelectBox(box.id)}
                        className={cn(
                            "relative rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 group",
                            box.isOpen
                                ? RARITY_STYLES[box.rarity] || 'border-primary/50 bg-primary/20 text-white'
                                : cn(
                                    "bg-surface-dark border-white/5",
                                    interactive ? "cursor-pointer hover:border-primary/50 hover:bg-white/5 hover:shadow-neon" : "cursor-default opacity-50"
                                ),
                            gameState.selectedBoxId === box.id && !box.isOpen && "ring-2 ring-primary ring-offset-2 ring-offset-background-dark scale-105 bg-primary/10 z-10"
                        )}
                    >
                        {box.isOpen ? (
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex flex-col items-center"
                            >
                                <span className="material-icons text-5xl mb-2 drop-shadow-lg">{box.icon}</span>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">{box.prizeLabel}</p>
                                <p className={cn("text-sm font-black", box.points > 0 ? "text-accent-lime" : "text-white")}>
                                    {box.points > 0 ? '+' : ''}{box.points} pts
                                </p>
                            </motion.div>
                        ) : (
                            <>
                                <span className={cn(
                                    "material-icons text-5xl transition-colors duration-300",
                                    interactive ? "text-white/10 group-hover:text-primary/50" : "text-white/5"
                                )}>
                                    help_outline
                                </span>
                                <p className="absolute bottom-3 right-4 text-2xl font-black font-mono text-white/10 group-hover:text-white/30 transition-colors">
                                    {String(box.id).padStart(2, '0')}
                                </p>
                            </>
                        )}
                    </motion.button>
                ))}

                {/* Final Box */}
                {boxes.length > 0 && (() => {
                    const finalBox = boxes[boxes.length - 1];
                    return (
                        <motion.button
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 1 }}
                            key={finalBox.id}
                            onClick={() => interactive && !finalBox.isOpen && onSelectBox(finalBox.id)}
                            className={cn(
                                "col-span-4 rounded-2xl border relative overflow-hidden p-4 transition-all duration-500",
                                finalBox.isOpen
                                    ? RARITY_STYLES[finalBox.rarity] || 'border-primary/50 bg-primary/20'
                                    : cn(
                                        "bg-gradient-to-r from-surface-dark via-white/5 to-surface-dark border-white/10",
                                        interactive ? "cursor-pointer hover:border-primary/50 hover:shadow-neon-strong" : "cursor-default"
                                    )
                            )}
                        >
                            {finalBox.isOpen ? (
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="flex items-center justify-center gap-8"
                                >
                                    <span className="material-icons text-5xl">{finalBox.icon}</span>
                                    <div className="text-left">
                                        <p className="font-black uppercase text-3xl tracking-wide">{finalBox.prizeLabel}</p>
                                        <p className="text-white/60 font-bold uppercase tracking-widest text-sm">Grande Prêmio Final</p>
                                    </div>
                                    <div className="px-6 py-3 rounded-xl bg-black/40 border border-white/10">
                                        <p className="text-2xl font-black text-accent-lime">
                                            {finalBox.points > 0 ? '+' : ''}{finalBox.points} pts
                                        </p>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="flex items-center justify-center gap-4 text-white/20 h-full group">
                                    <span className="material-icons text-3xl group-hover:text-primary transition-colors">diamond</span>
                                    <p className="font-display font-black uppercase tracking-[0.3em] text-xl group-hover:text-white transition-colors">Caixa Final</p>
                                    <span className="material-icons text-3xl group-hover:text-primary transition-colors">diamond</span>
                                </div>
                            )}
                        </motion.button>
                    );
                })()}
            </div>

            <footer className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between gap-4 text-sm mt-auto">
                <div className="flex items-center gap-8">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Progresso</p>
                        <p className="text-white font-black text-lg">
                            Rodada <span className="text-primary">{gameState.round}</span><span className="text-white/30 text-base font-medium">/{gameState.maxRounds}</span>
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Caixas</p>
                        <p className="text-white font-black text-lg">
                            <span className="text-accent-cyan">{gameState.boxesOpened}</span><span className="text-white/30 text-base font-medium">/{boxes.length} abertas</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white/60">Ao Vivo</span>
                </div>
            </footer>
        </div>
    );
}
