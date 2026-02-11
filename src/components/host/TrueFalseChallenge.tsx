'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Statement {
    text: string;
}

interface Props {
    question: string;
    statements: Statement[];
    onSubmit: (answers: boolean[]) => void;
    winnerName?: string;
}

export default function TrueFalseChallenge({ question, statements, onSubmit, winnerName }: Props) {
    const [answers, setAnswers] = useState<(boolean | null)[]>(
        () => statements.map(() => null)
    );
    const [submitted, setSubmitted] = useState(false);

    const toggleAnswer = (index: number, value: boolean) => {
        if (submitted) return;
        setAnswers(prev => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const allAnswered = answers.every(a => a !== null);

    const handleSubmit = () => {
        if (submitted || !allAnswered) return;
        setSubmitted(true);
        onSubmit(answers as boolean[]);
    };

    return (
        <div className="flex-1 flex flex-col gap-5 animate-fade-in min-h-0 bg-background-dark text-white font-body p-4 rounded-3xl">
            <header className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent-emerald/40 to-transparent" />
                <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="chip-badge">
                        <span className="material-icons text-[14px] text-accent-emerald">rule</span>
                        Verdadeiro ou Falso
                    </div>
                    {winnerName && (
                        <span className="text-xs uppercase tracking-[0.18em] text-white/40 font-bold">
                            Vez de {winnerName}
                        </span>
                    )}
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-black uppercase tracking-wide">{question}</h2>
                <p className="text-sm text-white/40 mt-2">Marque V ou F para cada afirmação</p>
            </header>

            <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto px-2">
                <AnimatePresence>
                    {statements.map((stmt, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.12 }}
                            className="bg-surface-dark border border-white/5 rounded-xl p-5 flex items-center gap-4 group"
                        >
                            <span className="text-white/20 font-mono font-black text-sm w-6 text-center shrink-0">
                                {idx + 1}.
                            </span>

                            <span className="text-base font-bold flex-1 leading-snug">{stmt.text}</span>

                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={() => toggleAnswer(idx, true)}
                                    disabled={submitted}
                                    className={`w-11 h-11 rounded-xl font-black text-sm flex items-center justify-center transition-all border-2 ${answers[idx] === true
                                            ? 'bg-accent-emerald/20 border-accent-emerald text-accent-emerald shadow-[0_0_12px_rgba(0,230,118,0.3)]'
                                            : 'bg-white/5 border-white/10 text-white/30 hover:border-accent-emerald/30 hover:text-accent-emerald/60'
                                        } disabled:cursor-not-allowed`}
                                >
                                    V
                                </button>
                                <button
                                    onClick={() => toggleAnswer(idx, false)}
                                    disabled={submitted}
                                    className={`w-11 h-11 rounded-xl font-black text-sm flex items-center justify-center transition-all border-2 ${answers[idx] === false
                                            ? 'bg-accent-red/20 border-accent-red text-accent-red shadow-[0_0_12px_rgba(255,23,68,0.3)]'
                                            : 'bg-white/5 border-white/10 text-white/30 hover:border-accent-red/30 hover:text-accent-red/60'
                                        } disabled:cursor-not-allowed`}
                                >
                                    F
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <footer className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-4">
                <p className="text-xs text-white/30 font-bold uppercase tracking-wider">
                    {submitted ? 'Aguardando resultado...' : `${answers.filter(a => a !== null).length}/${statements.length} respondidas`}
                </p>
                <button
                    onClick={handleSubmit}
                    disabled={submitted || !allAnswered}
                    className="btn-primary px-8 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <span className="material-icons">send</span>
                    {submitted ? 'Enviado' : 'Confirmar'}
                </button>
            </footer>
        </div>
    );
}
