'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Props {
    question: string;
    onSubmit: (guess: number) => void;
    winnerName?: string;
}

export default function EstimationChallenge({ question, onSubmit, winnerName }: Props) {
    const [guess, setGuess] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Focus input on mount
        setTimeout(() => inputRef.current?.focus(), 300);
    }, []);

    const handleSubmit = () => {
        const numValue = Number(guess);
        if (submitted || isNaN(numValue)) return;
        setSubmitted(true);
        onSubmit(numValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit();
    };

    return (
        <div className="flex-1 flex flex-col gap-5 animate-fade-in min-h-0 bg-background-dark text-white font-body p-4 rounded-3xl">
            <header className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="chip-badge">
                        <span className="material-icons text-[14px] text-primary">calculate</span>
                        Estimativa
                    </div>
                    {winnerName && (
                        <span className="text-xs uppercase tracking-[0.18em] text-white/40 font-bold">
                            Vez de {winnerName}
                        </span>
                    )}
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-black uppercase tracking-wide">{question}</h2>
                <p className="text-sm text-white/40 mt-2">Digite sua melhor estimativa</p>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="w-full max-w-md relative"
                >
                    {/* Decorative glow */}
                    <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-xl" />

                    <div className="relative bg-surface-dark border border-primary/20 rounded-3xl p-8 text-center">
                        <span className="material-icons text-6xl text-primary/20 mb-4 block">help_outline</span>

                        <input
                            ref={inputRef}
                            type="number"
                            value={guess}
                            onChange={(e) => !submitted && setGuess(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={submitted}
                            placeholder="???"
                            className="w-full text-center text-5xl md:text-6xl font-mono font-black bg-transparent border-b-4 border-primary/30 focus:border-primary outline-none py-4 text-primary placeholder:text-primary/15 transition-colors disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />

                        <p className="text-sm text-white/30 mt-4 font-bold uppercase tracking-wider">
                            {submitted ? 'Aguardando resultado...' : 'Quanto mais perto, mais chances!'}
                        </p>
                    </div>
                </motion.div>

                {/* Visual hint: accuracy meter */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center gap-3 text-white/20"
                >
                    <span className="material-icons text-sm">info</span>
                    <span className="text-xs font-bold uppercase tracking-wider">
                        Precisão define as chances: 🎯 Exato = máximo | 📏 Perto = bom | 🤔 Longe = mínimo
                    </span>
                </motion.div>
            </div>

            <footer className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-4">
                <p className="text-xs text-white/30 font-bold uppercase tracking-wider">
                    {guess ? `Sua estimativa: ${Number(guess).toLocaleString('pt-BR')}` : 'Digite um número'}
                </p>
                <button
                    onClick={handleSubmit}
                    disabled={submitted || !guess || isNaN(Number(guess))}
                    className="btn-primary px-8 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <span className="material-icons">send</span>
                    {submitted ? 'Enviado' : 'Confirmar'}
                </button>
            </footer>
        </div>
    );
}
