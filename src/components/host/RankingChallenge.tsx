'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RankingChallengeProps {
    question: string;
    items: string[];
    onSubmit: (order: number[]) => void;
    winnerName?: string;
}

export default function RankingChallenge({ question, items, onSubmit, winnerName }: RankingChallengeProps) {
    // Simple state management for items, mapped to id for Reorder
    const [orderedItems, setOrderedItems] = useState(() =>
        items.map((item, i) => ({ id: `item-${i}`, label: item, originalIndex: i }))
    );
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = useCallback(() => {
        if (submitted) return;
        setSubmitted(true);
        const order = orderedItems.map(item => item.originalIndex);
        onSubmit(order);
    }, [submitted, orderedItems, onSubmit]);

    const posLabels = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º'];

    return (
        <div className="flex-1 grid place-items-center animate-fade-in p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-panel rounded-[2rem] p-8 md:p-10 w-full max-w-3xl relative overflow-hidden"
            >
                {/* Header */}
                <header className="text-center mb-8 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-pink/10 border border-accent-pink/20 mb-4">
                        <span className="w-2 h-2 rounded-full bg-accent-pink animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-pink">Desafio de Ranking</span>
                    </div>

                    {winnerName && (
                        <motion.div
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="mb-6"
                        >
                            <span className="text-sm text-white/60 font-bold uppercase tracking-wider">Vez de</span>
                            <h2 className="text-2xl font-black text-white">{winnerName}</h2>
                        </motion.div>
                    )}

                    <h3 className="text-3xl md:text-4xl font-black uppercase leading-tight text-balance">
                        {question}
                    </h3>
                    <p className="text-white/40 mt-2 text-sm max-w-lg mx-auto">Arraste os itens para colocar na ordem correta</p>
                </header>

                {/* List */}
                <div className="max-w-xl mx-auto mb-8 relative z-10">
                    <Reorder.Group axis="y" values={orderedItems} onReorder={!submitted ? setOrderedItems : () => { }} className="space-y-3">
                        {orderedItems.map((item, index) => (
                            <Reorder.Item
                                key={item.id}
                                value={item}
                                dragListener={!submitted}
                                whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
                                className={cn(
                                    "rounded-xl p-4 flex items-center gap-4 transition-all relative overflow-hidden",
                                    submitted
                                        ? "bg-surface-dark/50 border border-white/5 opacity-80"
                                        : "bg-surface-dark border border-white/10 hover:border-white/30 cursor-grab active:cursor-grabbing shadow-lg"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg shadow-sm shrink-0",
                                    index === 0 ? "bg-amber-500 text-black" :
                                        index === 1 ? "bg-gray-400 text-black" :
                                            index === 2 ? "bg-orange-700 text-white" :
                                                "bg-white/5 text-white/30"
                                )}>
                                    {posLabels[index]}
                                </div>
                                <span className="flex-1 text-lg font-bold">{item.label}</span>
                                {!submitted && <span className="material-icons text-white/20">drag_handle</span>}
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                </div>

                {/* Actions */}
                <div className="text-center relative z-10">
                    <AnimatePresence mode="wait">
                        {!submitted ? (
                            <motion.button
                                key="submit"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                onClick={handleSubmit}
                                className="btn-primary px-10 py-4 text-lg rounded-2xl shadow-xl hover:shadow-primary/40"
                            >
                                Confirmar Ordem
                            </motion.button>
                        ) : (
                            <motion.div
                                key="processing"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-surface-dark border border-white/10"
                            >
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm font-bold uppercase tracking-wider text-white/60">Verificando...</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-pink/50 to-transparent opacity-20" />
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-accent-pink/10 blur-[80px] rounded-full pointer-events-none" />
            </motion.div>
        </div>
    );
}
