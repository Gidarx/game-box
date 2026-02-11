'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { GameState } from '@/shared/types';
import { useState, useEffect, useRef } from 'react';

type CardGridState = Pick<GameState, 'cardGrid' | 'lockedKeys' | 'chances' | 'triviaWinnerId' | 'players'>;
type GridCard = CardGridState['cardGrid'][number];

interface CardGridProps {
    gameState: CardGridState | null;
    roomCode: string;
    onOpenCard: (cardId: number) => void;
}

// Particle component for key discovery
function Particles({ color, count = 12 }: { color: string; count?: number }) {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
            {Array.from({ length: count }).map((_, i) => {
                const angle = (360 / count) * i;
                const distance = 40 + Math.random() * 30;
                const dx = Math.cos((angle * Math.PI) / 180) * distance;
                const dy = Math.sin((angle * Math.PI) / 180) * distance;
                const size = 4 + Math.random() * 4;
                return (
                    <motion.div
                        key={i}
                        initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                        animate={{ x: dx, y: dy, scale: [0, 1.5, 0], opacity: [1, 1, 0] }}
                        transition={{ duration: 0.6 + Math.random() * 0.3, delay: Math.random() * 0.1 }}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: size,
                            height: size,
                            borderRadius: '50%',
                            background: color,
                            boxShadow: `0 0 6px ${color}`,
                        }}
                    />
                );
            })}
        </div>
    );
}

export default function CardGrid({ gameState, onOpenCard }: CardGridProps) {
    const grid = gameState?.cardGrid || [];
    const lockedKeys = gameState?.lockedKeys || 0;
    const chances = gameState?.chances || 0;
    const winnerName = gameState?.triviaWinnerId
        ? gameState?.players?.[gameState.triviaWinnerId]?.name
        : '';

    const canOpen = chances > 0;

    // Track newly revealed cards for particle effects
    const [particleCards, setParticleCards] = useState<Set<number>>(new Set());
    const prevGridRef = useRef<GridCard[]>([]);

    useEffect(() => {
        if (prevGridRef.current.length > 0) {
            const newParticles = new Set<number>();
            grid.forEach(card => {
                const prev = prevGridRef.current.find(c => c.id === card.id);
                if (prev && prev.status === 'hidden' && card.status !== 'hidden') {
                    newParticles.add(card.id);
                }
            });
            if (newParticles.size > 0) {
                setParticleCards(newParticles);
                setTimeout(() => setParticleCards(new Set()), 1000);
            }
        }
        prevGridRef.current = [...grid];
    }, [grid]);

    // Card flip animation variants
    const cardFlipVariants = {
        hidden: {
            rotateY: 0,
            scale: 1,
        },
        flipping: {
            rotateY: [0, 90, 0],
            scale: [1, 1.05, 1],
            transition: { duration: 0.5, ease: 'easeInOut' as const }
        },
        revealed: {
            rotateY: 0,
            scale: 1,
        },
    };

    return (
        <div className="flex-1 flex flex-col gap-5 animate-fade-in min-h-0 bg-background-dark text-white font-body p-4 rounded-3xl">
            {/* Header */}
            <header className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent-emerald/40 to-transparent" />

                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-xl bg-surface-dark border border-primary/10 flex items-center gap-3">
                        <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    animate={{
                                        scale: i < lockedKeys ? [1, 1.3, 1] : 1,
                                        backgroundColor: i < lockedKeys ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)',
                                        borderColor: i < lockedKeys ? 'rgba(0,230,118,0.5)' : 'rgba(247,183,49,0.05)',
                                    }}
                                    transition={i < lockedKeys ? { scale: { duration: 0.4, delay: 0.1 } } : {}}
                                    className={cn(
                                        "w-8 h-8 rounded-lg border grid place-items-center transition-all",
                                        i < lockedKeys
                                            ? "shadow-[0_0_10px_rgba(0,230,118,0.2)]"
                                            : ""
                                    )}
                                >
                                    <span className={cn(
                                        "material-icons text-sm",
                                        i < lockedKeys ? "text-accent-emerald" : "text-white/15"
                                    )}>
                                        {i < lockedKeys ? 'vpn_key' : 'lock'}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                        <div className="h-8 w-[1px] bg-primary/10" />
                        <p className="text-xs font-black uppercase tracking-wider text-white/40">Chaves do Cofre</p>
                    </div>

                    {winnerName && (
                        <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                            <p className="text-xs font-black uppercase tracking-wider text-primary">♠ Vez de {winnerName}</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-bold">Chances</p>
                    <div className="flex gap-1.5">
                        {[0, 1, 2].map(i => (
                            <motion.span
                                key={i}
                                initial={false}
                                animate={{ scale: i < chances ? 1 : 0.8, opacity: i < chances ? 1 : 0.3 }}
                                className={cn(
                                    "w-10 h-10 rounded-full border-2 grid place-items-center transition-all",
                                    i < chances
                                        ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(247,183,49,0.4)]"
                                        : "bg-transparent border-primary/10 text-white/15"
                                )}
                            >
                                <span className="material-icons text-lg">poker_chip</span>
                            </motion.span>
                        ))}
                    </div>
                </div>
            </header>

            {/* Grid */}
            <div className="grid grid-cols-4 grid-rows-3 gap-4 flex-1 min-h-0" style={{ perspective: '1200px' }}>
                {grid.map((card: GridCard, i: number) => {
                    const isHidden = card.status === 'hidden';
                    const isRevealed = card.status === 'revealed';
                    const isLocked = card.status === 'locked';
                    const showParticles = particleCards.has(card.id);

                    let bgClass = "bg-surface-dark border-primary/5";
                    let content = null;
                    let particleColor = '';

                    if (isLocked) {
                        bgClass = "bg-accent-emerald/15 border-accent-emerald/40 shadow-[0_0_20px_rgba(0,230,118,0.15)]";
                        particleColor = '#00E676';
                        content = (
                            <>
                                <motion.span
                                    initial={{ rotateZ: -30, scale: 0 }}
                                    animate={{ rotateZ: 0, scale: 1 }}
                                    transition={{ type: 'spring', bounce: 0.5 }}
                                    className="material-icons text-4xl text-accent-emerald mb-1"
                                >
                                    vpn_key
                                </motion.span>
                                <span className="text-xs font-black uppercase tracking-wider text-accent-emerald">{card.word}</span>
                            </>
                        );
                    } else if (isRevealed) {
                        switch (card.type) {
                            case 'distractor':
                                bgClass = "bg-accent-red/10 border-accent-red/30";
                                particleColor = '#FF1744';
                                content = (
                                    <>
                                        <motion.span
                                            initial={{ rotateZ: 45 }}
                                            animate={{ rotateZ: 0 }}
                                            className="material-icons text-4xl text-accent-red mb-1"
                                        >
                                            close
                                        </motion.span>
                                        <span className="text-xs font-black uppercase tracking-wider text-accent-red">{card.word}</span>
                                    </>
                                );
                                break;
                            case 'lost_turn':
                                bgClass = "bg-orange-500/10 border-orange-500/30";
                                particleColor = '#FF9800';
                                content = (
                                    <>
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: [0, 1.3, 1] }}
                                            transition={{ duration: 0.4 }}
                                            className="material-icons text-4xl text-orange-400 mb-1"
                                        >
                                            block
                                        </motion.span>
                                        <span className="text-xs font-black uppercase tracking-wider text-orange-400">Perdeu a Vez</span>
                                    </>
                                );
                                break;
                            case 'duel':
                                bgClass = "bg-purple-500/15 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]";
                                particleColor = '#A855F7';
                                content = (
                                    <>
                                        <motion.span
                                            animate={{ scale: [1, 1.15, 1] }}
                                            transition={{ duration: 0.6, repeat: 2 }}
                                            className="material-icons text-4xl text-purple-400 mb-1"
                                        >
                                            swords
                                        </motion.span>
                                        <span className="text-xs font-black uppercase tracking-wider text-purple-400">Duelo</span>
                                    </>
                                );
                                break;
                            default:
                                content = <span className="text-sm">{card.word}</span>;
                        }
                    } else {
                        // Hidden — card back
                        content = (
                            <>
                                <span className="text-3xl font-black font-mono text-primary/5 group-hover:text-primary/15 transition-colors">{card.id}</span>
                                <span className="material-icons text-primary/5 absolute bottom-3 right-3 text-xl group-hover:text-primary/10 transition-colors">help_outline</span>
                            </>
                        );
                    }

                    return (
                        <motion.button
                            key={card.id}
                            initial={{ scale: 0.85, opacity: 0, rotateY: -15 }}
                            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                            transition={{ delay: i * 0.04, type: 'spring', stiffness: 200, damping: 20 }}
                            whileHover={isHidden && canOpen ? {
                                scale: 1.04,
                                rotateY: 5,
                                boxShadow: '0 0 25px rgba(247,183,49,0.15)',
                                transition: { duration: 0.2 }
                            } : {}}
                            whileTap={isHidden && canOpen ? { scale: 0.96 } : {}}
                            onClick={() => isHidden && canOpen && onOpenCard(card.id)}
                            disabled={!isHidden || !canOpen}
                            style={{ transformStyle: 'preserve-3d' }}
                            className={cn(
                                "rounded-2xl border relative flex flex-col items-center justify-center p-2 transition-colors duration-300 group overflow-visible",
                                bgClass,
                                isHidden && canOpen ? "cursor-pointer hover:border-primary/30" : "cursor-default",
                                isHidden && !canOpen && "opacity-50"
                            )}
                        >
                            {/* Particle effects */}
                            {showParticles && particleColor && (
                                <Particles color={particleColor} count={card.type === 'key' || isLocked ? 16 : 8} />
                            )}

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`${card.id}-${card.status}`}
                                    variants={cardFlipVariants}
                                    initial="hidden"
                                    animate={showParticles ? "flipping" : "revealed"}
                                    exit={{ rotateY: 90, opacity: 0, transition: { duration: 0.2 } }}
                                    style={{ transformStyle: 'preserve-3d' }}
                                    className="flex flex-col items-center"
                                >
                                    {content}
                                </motion.div>
                            </AnimatePresence>
                        </motion.button>
                    );
                })}
            </div>

            {/* Empty State */}
            {!canOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="bg-accent-red/10 border border-accent-red/20 rounded-xl p-3 text-center"
                >
                    <p className="text-xs font-bold uppercase tracking-wider text-accent-red/80">
                        <span className="material-icons align-middle text-sm mr-2">highlight_off</span>
                        Sem chances restantes. Aguardando próximo turno...
                    </p>
                </motion.div>
            )}
        </div>
    );
}
