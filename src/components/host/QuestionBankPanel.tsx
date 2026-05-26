'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    categoryLabels: Record<string, string>;
}

type QuestionStatus = 'all' | 'draft' | 'active' | 'rejected';

const STATUS_LABELS: Record<QuestionStatus, string> = {
    all: 'Todas',
    draft: 'Rascunho',
    active: 'Ativas',
    rejected: 'Rejeitadas',
};

function getStatusClass(status: string) {
    if (status === 'active') return 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30';
    if (status === 'rejected') return 'bg-red-500/10 text-red-300 border-red-500/25';
    return 'bg-primary/10 text-primary border-primary/25';
}

export default function QuestionBankPanel({ categoryLabels }: Props) {
    const [open, setOpen] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);
    const [storage, setStorage] = useState<'firestore' | 'local-sample' | 'unknown'>('unknown');
    const [canPersist, setCanPersist] = useState(false);
    const [openaiConfigured, setOpenaiConfigured] = useState(false);
    const [firebaseConfigured, setFirebaseConfigured] = useState(false);
    const [statusFilter, setStatusFilter] = useState<QuestionStatus>('all');
    const [category, setCategory] = useState('internet');
    const [count, setCount] = useState(8);
    const [theme, setTheme] = useState('');
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastGeneration, setLastGeneration] = useState<any | null>(null);

    const selectableCategories = useMemo(
        () => Object.entries(categoryLabels).filter(([key]) => key !== 'all'),
        [categoryLabels],
    );

    const fetchQuestions = async (status = statusFilter) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/content/questions?status=${status}&limit=160`);
            const data = await response.json();
            setQuestions(Array.isArray(data.questions) ? data.questions : []);
            setStorage(data.storage || 'unknown');
            setCanPersist(!!data.canPersist);
            setOpenaiConfigured(!!data.openaiConfigured);
            setFirebaseConfigured(!!data.firebaseConfigured);
        } catch {
            setError('Nao foi possivel carregar o banco de perguntas.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) fetchQuestions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, statusFilter]);

    const generateQuestions = async () => {
        setGenerating(true);
        setError(null);
        setMessage(null);
        setLastGeneration(null);
        try {
            const response = await fetch('/api/content/generate-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    count,
                    categories: [category],
                    theme,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Falha ao gerar perguntas com IA.');
            }
            setLastGeneration(data);
            setMessage(`${data.accepted?.length || 0} aprovadas, ${data.rejected?.length || 0} descartadas.`);
            await fetchQuestions(statusFilter);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao gerar perguntas com IA.');
        } finally {
            setGenerating(false);
        }
    };

    const updateStatus = async (id: string, status: 'active' | 'draft' | 'rejected') => {
        setError(null);
        try {
            const response = await fetch('/api/content/questions/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id], status }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Nao foi possivel atualizar a pergunta.');
            }
            await fetchQuestions(statusFilter);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nao foi possivel atualizar a pergunta.');
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="h-[34px] px-3 rounded-lg bg-black/30 border border-primary/10 text-primary/80 hover:text-primary hover:border-primary/30 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider transition-colors"
            >
                <span className="material-icons text-[15px]">database</span>
                Banco IA
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm p-4 md:p-8"
                    >
                        <motion.section
                            initial={{ y: 24, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 24, opacity: 0 }}
                            className="h-full max-w-[1500px] mx-auto bg-background-dark border border-primary/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            <header className="px-5 md:px-7 py-4 border-b border-primary/10 flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-display font-black uppercase tracking-wide flex items-center gap-2">
                                        <span className="material-icons text-primary">auto_awesome</span>
                                        Banco de Perguntas IA
                                    </h2>
                                    <p className="text-xs text-white/35 font-bold uppercase tracking-wider mt-1">
                                        {storage === 'firestore' ? 'Firestore conectado' : 'Amostra local'} • OpenAI {openaiConfigured ? 'configurada' : 'sem chave'} • Firebase {firebaseConfigured ? 'ativo' : 'offline'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                                >
                                    <span className="material-icons">close</span>
                                </button>
                            </header>

                            <div className="grid lg:grid-cols-[360px_1fr] min-h-0 flex-1">
                                <aside className="border-r border-primary/10 p-5 md:p-6 overflow-y-auto">
                                    <div className="space-y-5">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">Categoria</label>
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {selectableCategories.map(([key, label]) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => setCategory(key)}
                                                        className={cn(
                                                            "px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors",
                                                            category === key
                                                                ? "bg-primary text-black border-primary"
                                                                : "bg-white/5 border-white/10 text-white/45 hover:text-white"
                                                        )}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">Quantidade</label>
                                                <div className="mt-2 flex items-center gap-2 bg-black/30 border border-primary/10 rounded-xl p-2">
                                                    <button
                                                        onClick={() => setCount((value) => Math.max(1, value - 1))}
                                                        className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center"
                                                    >
                                                        <span className="material-icons text-sm">remove</span>
                                                    </button>
                                                    <span className="flex-1 text-center font-mono text-xl font-black text-primary">{count}</span>
                                                    <button
                                                        onClick={() => setCount((value) => Math.min(20, value + 1))}
                                                        className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center"
                                                    >
                                                        <span className="material-icons text-sm">add</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">Filtro</label>
                                                <select
                                                    value={statusFilter}
                                                    onChange={(event) => setStatusFilter(event.target.value as QuestionStatus)}
                                                    className="mt-2 w-full h-[45px] bg-black/30 border border-primary/10 rounded-xl px-3 text-sm font-bold text-white focus:outline-none focus:border-primary/40"
                                                >
                                                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                                        <option key={key} value={key}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">Tema extra</label>
                                            <textarea
                                                value={theme}
                                                onChange={(event) => setTheme(event.target.value)}
                                                maxLength={220}
                                                rows={4}
                                                placeholder="Ex: perguntas sobre grupo da familia, churrasco, internet brasileira..."
                                                className="mt-2 w-full bg-black/30 border border-primary/10 rounded-xl px-3 py-3 text-sm text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-primary/40"
                                            />
                                        </div>

                                        <button
                                            onClick={generateQuestions}
                                            disabled={generating}
                                            className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-wait"
                                        >
                                            <span className="material-icons">{generating ? 'hourglass_top' : 'auto_awesome'}</span>
                                            {generating ? 'Gerando...' : 'Gerar com IA'}
                                        </button>

                                        <button
                                            onClick={() => fetchQuestions(statusFilter)}
                                            disabled={loading}
                                            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/20 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wider transition-colors"
                                        >
                                            <span className="material-icons text-base">refresh</span>
                                            Atualizar lista
                                        </button>

                                        {!canPersist && (
                                            <p className="text-xs text-primary/70 bg-primary/10 border border-primary/20 rounded-xl p-3 leading-relaxed">
                                                Configure o Firebase para salvar rascunhos e ativar perguntas. Sem Firebase, o painel mostra apenas amostras e resultados da geração.
                                            </p>
                                        )}

                                        {message && <p className="text-xs text-accent-emerald bg-accent-emerald/10 border border-accent-emerald/20 rounded-xl p-3">{message}</p>}
                                        {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}
                                    </div>
                                </aside>

                                <main className="min-h-0 overflow-y-auto p-5 md:p-6">
                                    {lastGeneration && (
                                        <section className="mb-6 border border-primary/10 rounded-2xl overflow-hidden">
                                            <div className="px-4 py-3 bg-primary/8 border-b border-primary/10 flex items-center justify-between gap-3">
                                                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-primary">Ultima geração</h3>
                                                <span className="text-xs text-white/35 font-mono">{lastGeneration.model}</span>
                                            </div>
                                            <div className="grid md:grid-cols-2 gap-0">
                                                <div className="p-4 border-b md:border-b-0 md:border-r border-primary/10">
                                                    <p className="text-xs font-black uppercase tracking-wider text-accent-emerald mb-3">
                                                        Aprovadas ({lastGeneration.accepted?.length || 0})
                                                    </p>
                                                    <div className="space-y-2">
                                                        {(lastGeneration.accepted || []).slice(0, 5).map((question: any) => (
                                                            <p key={question.id} className="text-sm text-white/75 bg-white/[0.03] rounded-lg p-2">{question.text}</p>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="p-4">
                                                    <p className="text-xs font-black uppercase tracking-wider text-red-300 mb-3">
                                                        Descartadas ({lastGeneration.rejected?.length || 0})
                                                    </p>
                                                    <div className="space-y-2">
                                                        {(lastGeneration.rejected || []).slice(0, 5).map((item: any, index: number) => (
                                                            <div key={`${item.question?.id || index}`} className="text-sm bg-red-500/[0.06] border border-red-500/10 rounded-lg p-2">
                                                                <p className="text-white/70">{item.question?.text}</p>
                                                                <p className="text-[11px] text-red-200/80 mt-1">
                                                                    {item.reason === 'similar_question'
                                                                        ? `Similar (${Math.round(Number(item.similarity || 0) * 100)}%) a: ${item.similarTo?.text}`
                                                                        : item.details?.join('; ') || item.reason}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    <section>
                                        <div className="flex items-center justify-between gap-4 mb-4">
                                            <div>
                                                <h3 className="text-lg font-black uppercase tracking-wide">Perguntas visíveis</h3>
                                                <p className="text-xs text-white/35 font-bold uppercase tracking-wider">
                                                    {questions.length} itens carregados
                                                </p>
                                            </div>
                                            {loading && <span className="text-xs text-primary font-black uppercase tracking-wider">Carregando...</span>}
                                        </div>

                                        <div className="grid xl:grid-cols-2 gap-3">
                                            {questions.map((question) => (
                                                <article key={question.id} className="border border-primary/10 rounded-xl bg-white/[0.025] p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider", getStatusClass(question.status))}>
                                                                    {question.status || 'draft'}
                                                                </span>
                                                                <span className="px-2 py-0.5 rounded-md bg-white/5 text-white/45 text-[10px] font-black uppercase tracking-wider">
                                                                    {categoryLabels[question.category] || question.category || 'geral'}
                                                                </span>
                                                                <span className="text-[10px] text-white/25 font-mono truncate">{question.id}</span>
                                                            </div>
                                                            <h4 className="text-base font-bold text-white leading-snug">{question.text}</h4>
                                                        </div>
                                                    </div>

                                                    <div className="grid sm:grid-cols-2 gap-2 mt-3">
                                                        {(question.options || []).map((option: string, index: number) => (
                                                            <div
                                                                key={`${question.id}-${index}`}
                                                                className={cn(
                                                                    "rounded-lg px-3 py-2 text-sm border",
                                                                    index === Number(question.correctIndex)
                                                                        ? "border-accent-emerald/25 bg-accent-emerald/10 text-accent-emerald"
                                                                        : "border-white/5 bg-black/20 text-white/55"
                                                                )}
                                                            >
                                                                {option}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {canPersist && (
                                                        <div className="flex flex-wrap gap-2 mt-4">
                                                            {question.status !== 'active' && (
                                                                <button
                                                                    onClick={() => updateStatus(question.id, 'active')}
                                                                    className="px-3 py-1.5 rounded-lg bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/25 text-[10px] font-black uppercase tracking-wider hover:bg-accent-emerald/15"
                                                                >
                                                                    Ativar
                                                                </button>
                                                            )}
                                                            {question.status !== 'draft' && (
                                                                <button
                                                                    onClick={() => updateStatus(question.id, 'draft')}
                                                                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/25 text-[10px] font-black uppercase tracking-wider hover:bg-primary/15"
                                                                >
                                                                    Rascunho
                                                                </button>
                                                            )}
                                                            {question.status !== 'rejected' && (
                                                                <button
                                                                    onClick={() => updateStatus(question.id, 'rejected')}
                                                                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 border border-red-500/25 text-[10px] font-black uppercase tracking-wider hover:bg-red-500/15"
                                                                >
                                                                    Rejeitar
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </article>
                                            ))}
                                        </div>

                                        {!loading && questions.length === 0 && (
                                            <div className="border border-dashed border-primary/15 rounded-2xl p-10 text-center text-white/35">
                                                <span className="material-icons text-4xl mb-2">quiz</span>
                                                <p className="font-bold uppercase tracking-wider text-sm">Nenhuma pergunta encontrada nesse filtro.</p>
                                            </div>
                                        )}
                                    </section>
                                </main>
                            </div>
                        </motion.section>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
