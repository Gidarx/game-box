'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { GameState } from '@/shared/types';

type CardGridState = Pick<GameState, 'cardGrid' | 'lockedKeys' | 'chances' | 'triviaWinnerId' | 'players'>;
type GridCard = CardGridState['cardGrid'][number];

interface CardGridProps {
    gameState: CardGridState | null;
    roomCode: string;
    onOpenCard: (cardId: number) => void;
}

export default function CardGrid({ gameState, onOpenCard }: CardGridProps) {
    const grid = gameState?.cardGrid || [];
    const lockedKeys = gameState?.lockedKeys || 0;
    const chances = gameState?.chances || 0;
    const winnerName = gameState?.triviaWinnerId
        ? gameState?.players?.[gameState.triviaWinnerId]?.name
        : '';

    const canOpen = chances > 0;

    return (
        <div className="flex-1 flex flex-col gap-5 animate-fade-in min-h-0 bg-background-dark text-white font-body p-4 rounded-3xl">
            {/* Header */}
            <header className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-xl bg-surface-dark border border-white/10 flex items-center gap-3">
                        <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-8 h-8 rounded-lg border grid place-items-center transition-all",
                                        i < lockedKeys
                                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                            : "bg-white/5 border-white/10 text-white/20"
                                    )}
                                >
                                    <span className="material-icons text-sm">{i < lockedKeys ? 'vpn_key' : 'lock'}</span>
                                </div>
                            ))}
                        </div>
                        <div className="h-8 w-[1px] bg-white/10" />
                        <p className="text-xs font-black uppercase tracking-wider text-white/50">Chaves do Cofre</p>
                    </div>

                    {winnerName && (
                        <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                            <p className="text-xs font-black uppercase tracking-wider text-primary">Vez de {winnerName}</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Chances Restantes</p>
                    <div className="flex gap-1.5">
                        {[0, 1, 2].map(i => (
                            <motion.span
                                key={i}
                                initial={false}
                                animate={{ scale: i < chances ? 1 : 0.8, opacity: i < chances ? 1 : 0.3 }}
                                className={cn(
                                    "w-10 h-10 rounded-full border-2 grid place-items-center transition-all",
                                    i < chances
                                        ? "bg-amber-500 text-black border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                                        : "bg-transparent border-white/10 text-white/20"
                                )}
                            >
                                <span className="material-icons text-lg">touch_app</span>
                            </motion.span>
                        ))}
                    </div>
                </div>
            </header>

            {/* Grid */}
            <div className="grid grid-cols-4 grid-rows-3 gap-4 flex-1 min-h-0">
                {grid.map((card: GridCard, i: number) => {
                    const isHidden = card.status === 'hidden';
                    const isRevealed = card.status === 'revealed';
                    const isLocked = card.status === 'locked';

                    let bgClass = "bg-surface-dark border-white/5";
                    let content = null;

                    if (isLocked) {
                        bgClass = "bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]";
                        content = (
                            <>
                                <span className="material-icons text-4xl text-emerald-400 mb-1">vpn_key</span>
                                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">{card.word}</span>
                            </>
                        );
                    } else if (isRevealed) {
                        switch (card.type) {
                            case 'distractor':
                                bgClass = "bg-red-500/10 border-red-500/30";
                                content = (
                                    <>
                                        <span className="material-icons text-4xl text-red-400 mb-1">close</span>
                                        <span className="text-xs font-black uppercase tracking-wider text-red-400">{card.word}</span>
                                    </>
                                );
                                break;
                            case 'lost_turn':
                                bgClass = "bg-orange-500/10 border-orange-500/30";
                                content = (
                                    <>
                                        <span className="material-icons text-4xl text-orange-400 mb-1">block</span>
                                        <span className="text-xs font-black uppercase tracking-wider text-orange-400">Perdeu a Vez</span>
                                    </>
                                );
                                break;
                            case 'duel':
                                bgClass = "bg-purple-500/10 border-purple-500/30";
                                content = (
                                    <>
                                        <span className="material-icons text-4xl text-purple-400 mb-1">swords</span>
                                        <span className="text-xs font-black uppercase tracking-wider text-purple-400">Duelo</span>
                                    </>
                                );
                                break;
                            default:
                                content = <span className="text-sm">{card.word}</span>;
                        }
                    } else {
                        // Hidden
                        content = (
                            <>
                                <span className="text-3xl font-black font-mono text-white/5 group-hover:text-white/10 transition-colors">{card.id}</span>
                                <span className="material-icons text-white/10 absolute bottom-3 right-3 text-xl">help_outline</span>
                            </>
                        );
                    }

                    return (
                        <motion.button
                            key={card.id}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                            whileHover={isHidden && canOpen ? { scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
                            whileTap={isHidden && canOpen ? { scale: 0.98 } : {}}
                            onClick={() => isHidden && canOpen && onOpenCard(card.id)}
                            disabled={!isHidden || !canOpen}
                            className={cn(
                                "rounded-2xl border relative flex flex-col items-center justify-center p-2 transition-all duration-300 group",
                                bgClass,
                                isHidden && canOpen ? "cursor-pointer hover:border-primary/30" : "cursor-default",
                                isHidden && !canOpen && "opacity-50"
                            )}
                        >
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={isRevealed ? 'revealed' : 'hidden'}
                                    initial={{ rotateY: 90, opacity: 0 }}
                                    animate={{ rotateY: 0, opacity: 1 }}
                                    exit={{ rotateY: -90, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="flex flex-col items-center"
                                >
                                    {content}
                                </motion.div>
                            </AnimatePresence>
                        </motion.button>
                    );
                })}
            </div>

            {/* Empty State / Message */}
            {!canOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center"
                >
                    <p className="text-xs font-bold uppercase tracking-wider text-red-300">
                        <span className="material-icons align-middle text-sm mr-2">highlight_off</span>
                        Sem chances restantes. Aguardando próximo turno...
                    </p>
                </motion.div>
            )}
        </div>
    );
}
