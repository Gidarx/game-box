'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { GameState } from '@/shared/types';
import { useState, useEffect, useMemo, useRef } from 'react';

type CardGridState = Pick<GameState, 'cardGrid' | 'lockedKeys' | 'chances' | 'triviaWinnerId' | 'players' | 'pendingKeywordCardId' | 'unlockPhraseProgress' | 'solveAttempts'>;
type GridCard = CardGridState['cardGrid'][number];

interface CardGridProps {
    gameState: CardGridState | null;
    roomCode: string;
    onOpenCard: (cardId: number) => void;
    onTestKeyword: (cardId: number) => void;
    onSkipKeywordTest: (cardId: number) => void;
}

function pseudoRandom(seed: number) {
    const value = Math.sin(seed) * 10000;
    return value - Math.floor(value);
}

// Particle component for key discovery
function Particles({ color, count = 12 }: { color: string; count?: number }) {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
            {Array.from({ length: count }).map((_, i) => {
                const angle = (360 / count) * i;
                const distance = 40 + pseudoRandom((i + 1) * 1.37 + count) * 30;
                const dx = Math.cos((angle * Math.PI) / 180) * distance;
                const dy = Math.sin((angle * Math.PI) / 180) * distance;
                const size = 4 + pseudoRandom((i + 1) * 2.11 + count * 3) * 4;
                const duration = 0.6 + pseudoRandom((i + 1) * 2.93 + count * 5) * 0.3;
                const delay = pseudoRandom((i + 1) * 4.21 + count * 7) * 0.1;
                return (
                    <motion.div
                        key={i}
                        initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                        animate={{ x: dx, y: dy, scale: [0, 1.5, 0], opacity: [1, 1, 0] }}
                        transition={{ duration, delay }}
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

export default function CardGrid({ gameState, onOpenCard, onTestKeyword, onSkipKeywordTest }: CardGridProps) {
    const grid = useMemo(() => gameState?.cardGrid ?? [], [gameState?.cardGrid]);
    const lockedKeys = gameState?.lockedKeys || 0;
    const chances = gameState?.chances || 0;
    const pendingKeywordCardId = Number(gameState?.pendingKeywordCardId) || null;
    const phraseProgress = Array.isArray(gameState?.unlockPhraseProgress) ? gameState.unlockPhraseProgress : [];
    const solveAttempts = Number(gameState?.solveAttempts || 0);
    const winnerName = gameState?.triviaWinnerId
        ? gameState?.players?.[gameState.triviaWinnerId]?.name
        : '';

    const hasPendingKeywordDecision = pendingKeywordCardId !== null;
    const canOpen = chances > 0 && !hasPendingKeywordDecision;
    const pendingCard = pendingKeywordCardId
        ? grid.find((card) => card.id === pendingKeywordCardId) || null
        : null;

    // Track newly revealed cards for particle effects
    const [particleCards, setParticleCards] = useState<Set<number>>(new Set());
    const prevGridRef = useRef<GridCard[]>([]);
    const clearParticlesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let frame = 0;
        if (prevGridRef.current.length > 0) {
            const newParticles = new Set<number>();
            grid.forEach(card => {
                const prev = prevGridRef.current.find(c => c.id === card.id);
                if (prev && prev.status === 'hidden' && card.status !== 'hidden') {
                    newParticles.add(card.id);
                }
            });
            if (newParticles.size > 0) {
                frame = requestAnimationFrame(() => {
                    setParticleCards(newParticles);
                });
                if (clearParticlesTimeoutRef.current) {
                    clearTimeout(clearParticlesTimeoutRef.current);
                }
                clearParticlesTimeoutRef.current = setTimeout(() => {
                    setParticleCards(new Set());
                    clearParticlesTimeoutRef.current = null;
                }, 1000);
            }
        }
        prevGridRef.current = [...grid];
        return () => {
            if (frame) {
                cancelAnimationFrame(frame);
            }
        };
    }, [grid]);

    useEffect(() => {
        return () => {
            if (clearParticlesTimeoutRef.current) {
                clearTimeout(clearParticlesTimeoutRef.current);
            }
        };
    }, []);

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
                    {phraseProgress.length > 0 && (
                        <div className="hidden xl:flex items-center gap-2 px-4 py-2 rounded-xl bg-black/30 border border-primary/10">
                            <span className="material-icons text-primary/50 text-lg">password</span>
                            <div className="flex gap-1">
                                {phraseProgress.map((word, index) => (
                                    <span
                                        key={index}
                                        className={cn(
                                            "min-w-14 px-2 py-1 rounded-lg text-center text-xs font-black uppercase tracking-wider border",
                                            word
                                                ? "bg-accent-emerald/10 border-accent-emerald/30 text-accent-emerald"
                                                : "bg-white/5 border-white/10 text-white/20"
                                        )}
                                    >
                                        {word || '???'}
                                    </span>
                                ))}
                            </div>
                            {solveAttempts > 0 && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                                    {solveAttempts} tentativa{solveAttempts !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    )}
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
                    const isPendingChoice = pendingKeywordCardId === card.id && isRevealed && !card.type;

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
                        if (isPendingChoice) {
                            bgClass = "bg-primary/10 border-primary/40 shadow-[0_0_18px_rgba(247,183,49,0.22)]";
                            content = (
                                <>
                                    <span className="material-icons text-4xl text-primary mb-1">help</span>
                                    <span className="text-xs font-black uppercase tracking-wider text-primary text-center">{card.word}</span>
                                </>
                            );
                        } else if (card.type === null) {
                            bgClass = "bg-white/5 border-white/15";
                            content = (
                                <>
                                    <span className="material-icons text-4xl text-white/35 mb-1">visibility</span>
                                    <span className="text-xs font-black uppercase tracking-wider text-white/60 text-center">{card.word}</span>
                                </>
                            );
                        } else {
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

            {hasPendingKeywordDecision && pendingCard && chances > 0 && (
                <motion.div
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="glass-panel rounded-2xl p-4 border border-primary/20 flex flex-wrap items-center justify-between gap-4"
                >
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-black">Palavra Revelada</p>
                        <p className="text-lg font-black mt-1">{pendingCard.word}</p>
                        <p className="text-xs text-white/45 mt-1">Chave nao gasta chance. Distrator gasta 1 chance.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onSkipKeywordTest(pendingCard.id)}
                            className="btn-secondary px-4 py-2 text-xs h-10"
                        >
                            Pular
                        </button>
                        <button
                            onClick={() => onTestKeyword(pendingCard.id)}
                            className="btn-primary px-4 py-2 text-xs h-10"
                        >
                            Testar Palavra
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Empty State */}
            {chances <= 0 && (
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
