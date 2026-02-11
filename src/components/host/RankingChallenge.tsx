'use client';

import { useState } from 'react';
import { Reorder } from 'framer-motion';

type RankedItem = {
    id: number;
    label: string;
};

interface Props {
    question: string;
    items: string[];
    onSubmit: (order: number[]) => void;
    winnerName?: string;
}

export default function RankingChallenge({ question, items, onSubmit, winnerName }: Props) {
    const [rankedItems, setRankedItems] = useState<RankedItem[]>(
        () => items.map((label, index) => ({ id: index, label }))
    );
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = () => {
        if (submitted) return;
        setSubmitted(true);
        onSubmit(rankedItems.map((item) => item.id));
    };

    const positionIcons = ['filter_1', 'filter_2', 'filter_3', 'filter_4', 'filter_5'];

    return (
        <div className="flex-1 flex flex-col gap-5 animate-fade-in min-h-0 bg-background-dark text-white font-body p-4 rounded-3xl">
            <header className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="chip-badge">
                        <span className="material-icons text-[14px] text-primary">sort</span>
                        Desafio de Ranking
                    </div>
                    {winnerName && (
                        <span className="text-xs uppercase tracking-[0.18em] text-white/40 font-bold">
                            Vez de {winnerName}
                        </span>
                    )}
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-black uppercase tracking-wide">{question}</h2>
                <p className="text-sm text-white/40 mt-2">Arraste os itens para ordená-los corretamente</p>
            </header>

            <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto px-2">
                <Reorder.Group axis="y" values={rankedItems} onReorder={setRankedItems} className="space-y-3">
                    {rankedItems.map((item, index) => (
                        <Reorder.Item
                            key={item.id}
                            value={item}
                            className="bg-surface-dark border border-primary/5 rounded-xl p-5 cursor-grab active:cursor-grabbing flex items-center gap-5 group transition-all hover:border-primary/20 hover:bg-primary/5"
                        >
                            <span className="material-icons text-2xl flex-shrink-0 text-primary/30">
                                {positionIcons[index] || 'tag'}
                            </span>

                            <span className="text-lg font-bold flex-1">{item.label}</span>

                            <span className="material-icons text-white/10 group-hover:text-primary/30 transition-colors">
                                drag_indicator
                            </span>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            </div>

            <footer className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-4">
                <p className="text-xs text-white/30 font-bold uppercase tracking-wider">
                    {submitted ? 'Aguardando resultado...' : 'Ordene e confirme no telão'}
                </p>
                <button
                    onClick={handleSubmit}
                    disabled={submitted}
                    className="btn-primary px-8 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <span className="material-icons">send</span>
                    {submitted ? 'Enviado' : 'Confirmar Ordem'}
                </button>
            </footer>
        </div>
    );
}
