'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Components ---

function MobileLayout({ children, className = '', centered = false }: { children: React.ReactNode; className?: string; centered?: boolean }) {
    return (
        <div className="min-h-[100dvh] flex flex-col bg-background-dark text-white font-body overflow-x-hidden relative">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-20%] w-[70vw] h-[70vw] bg-primary/20 blur-[120px] rounded-full mix-blend-screen animate-float" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-accent-cyan/10 blur-[100px] rounded-full mix-blend-screen animate-float" style={{ animationDelay: '-1.5s' }} />
            </div>

            {/* Content */}
            <main className={cn(
                "flex-1 flex flex-col w-full max-w-md mx-auto px-6 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] relative z-10",
                centered && "items-center justify-center",
                className
            )}>
                {children}
            </main>
        </div>
    );
}

function JoinPhase({
    roomCode, setRoomCode, playerName, setPlayerName, onJoin, isConnected, error
}: {
    roomCode: string, setRoomCode: (v: string) => void, playerName: string, setPlayerName: (v: string) => void, onJoin: () => void, isConnected: boolean, error: string
}) {
    return (
        <MobileLayout centered>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full flex flex-col items-center"
            >
                <div className="w-24 h-24 bg-surface-dark rounded-3xl flex items-center justify-center mb-8 shadow-neon border border-primary/30 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-50" />
                    <span className="material-icons text-white text-5xl relative z-10 group-hover:scale-110 transition-transform duration-300">inventory_2</span>
                </div>

                <h1 className="text-4xl font-display font-black uppercase text-center mb-2 tracking-wider">
                    Caixa <span className="text-primary text-glow">Misteriosa</span>
                </h1>
                <p className="text-white/50 text-sm mb-10 text-center font-medium tracking-wide">GAME SHOW EXPERIENCE</p>

                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6 w-full text-center overflow-hidden"
                        >
                            <p className="text-red-400 text-sm font-bold flex items-center justify-center gap-2">
                                <span className="material-icons text-sm">error</span>
                                {error}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="w-full space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Código da Sala</label>
                        <input
                            type="text" value={roomCode}
                            onChange={e => setRoomCode(e.target.value.toUpperCase())}
                            placeholder="ABC123" maxLength={6}
                            className="w-full bg-surface-dark/50 border border-white/10 rounded-2xl px-4 py-5 text-2xl font-mono font-bold text-center tracking-widest focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder-white/10"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Seu Nome</label>
                        <input
                            type="text" value={playerName}
                            onChange={e => setPlayerName(e.target.value)}
                            placeholder="Digite seu nome" maxLength={20}
                            className="w-full bg-surface-dark/50 border border-white/10 rounded-2xl px-4 py-5 text-xl font-bold text-center focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder-white/10"
                        />
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={onJoin} disabled={!isConnected}
                        className="w-full btn-primary py-5 rounded-2xl text-lg mt-4"
                    >
                        {isConnected ? 'Entrar no Jogo' : 'Conectando...'}
                    </motion.button>
                </div>
            </motion.div>
        </MobileLayout>
    );
}

function WaitingPhase({ gameState, myTeam }: { gameState: any, myTeam: any }) {
    const getWaitInfo = () => {
        if (!gameState) return { text: 'Aguardando...', icon: 'hourglass_empty' };
        switch (gameState.phase) {
            case 'lobby': return { text: 'Aguardando início...', icon: 'hourglass_top' };
            case 'box_select': return { text: 'Seleção de Caixa', icon: 'inventory_2' };
            case 'ranking_challenge': return { text: 'Desafio no Telão', icon: 'leaderboard' };
            case 'card_open': return { text: 'Abrindo Cartas', icon: 'style' };
            case 'reveal': return { text: 'Revelando Prêmio', icon: 'redeem' };
            case 'wildcard': return { text: 'Sorteio Wildcard', icon: 'bolt' };
            case 'duel': return { text: 'Duelo em Andamento', icon: 'swords' };
            default: return { text: 'Aguardando...', icon: 'hourglass_empty' };
        }
    };
    const info = getWaitInfo();

    return (
        <MobileLayout centered>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full flex flex-col items-center"
            >
                <div className="relative mb-8">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full border border-dashed border-white/20"
                    />
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-32 h-32 rounded-full bg-surface-dark border border-white/10 flex items-center justify-center shadow-2xl relative z-10"
                    >
                        <span className="material-icons text-5xl text-primary/80">{info.icon}</span>
                    </motion.div>
                </div>

                <h2 className="text-2xl font-black uppercase tracking-wide mb-2 text-center">{info.text}</h2>
                <p className="text-white/40 text-sm font-medium tracking-wider uppercase mb-12">Olhe para o telão</p>

                {myTeam && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="w-full max-w-xs bg-gradient-to-b from-surface-dark to-black/40 border border-white/10 p-6 rounded-3xl text-center relative overflow-hidden"
                    >
                        <div className={`absolute top-0 right-0 p-3 opacity-10`}>
                            <span className="material-icons text-6xl">groups</span>
                        </div>
                        <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold mb-3">Seu Time</p>
                        <p className="text-3xl font-black text-white mb-1 tracking-tight">{myTeam.name}</p>
                        <div className="metric-pill mt-2 bg-primary/20 border-primary/30 text-primary-300">
                            <span className="text-lg">{myTeam.score} pts</span>
                        </div>
                    </motion.div>
                )}

                {/* Key Status */}
                {gameState?.cardGrid?.length > 0 && (
                    <div className="mt-10 flex gap-4">
                        {[0, 1, 2].map(i => {
                            const isLocked = i < (gameState.lockedKeys || 0);
                            return (
                                <motion.div
                                    key={i}
                                    initial={false}
                                    animate={{
                                        backgroundColor: isLocked ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                        borderColor: isLocked ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                                        scale: isLocked ? 1.1 : 1
                                    }}
                                    className="w-12 h-12 rounded-xl border flex items-center justify-center"
                                >
                                    <span className={cn("material-icons text-xl", isLocked ? "text-green-400" : "text-white/20")}>
                                        {isLocked ? 'vpn_key' : 'lock'}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>
        </MobileLayout>
    );
}

function TriviaPhase({
    question, timeLeft, selectedAnswer, onAnswer, error, isFrozen
}: {
    question: any, timeLeft: number, selectedAnswer: number | null, onAnswer: (i: number) => void, error: string, isFrozen: boolean
}) {
    const timerProgress = Math.min(100, (timeLeft / 12) * 100);
    const isCritical = timeLeft <= 3;

    return (
        <MobileLayout>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60">
                    {question?.category || 'Trivia'}
                </span>
                <div className={cn("flex items-center gap-2 font-mono font-bold text-xl", isCritical ? "text-red-400 animate-pulse" : "text-primary")}>
                    <span>{timeLeft}s</span>
                    <span className="material-icons text-lg">timer</span>
                </div>
            </div>

            {/* Timer Bar */}
            <div className="w-full h-2 bg-white/10 rounded-full mb-8 overflow-hidden">
                <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: `${timerProgress}%` }}
                    transition={{ duration: 0.1, ease: 'linear' }}
                    className={cn("h-full rounded-full transition-colors", isCritical ? "bg-red-500" : "bg-primary")}
                />
            </div>

            {/* Question Card */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-gradient-to-br from-surface-dark to-background-mid border border-white/10 p-6 rounded-3xl shadow-xl mb-6 min-h-[140px] flex items-center justify-center relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <p className="text-xl md:text-2xl font-bold text-center leading-relaxed text-balance">
                    {question?.text || 'Carregando pergunta...'}
                </p>
            </motion.div>

            {/* Options */}
            <div className="flex-1 flex flex-col justify-end gap-3 pb-4">
                {question?.options?.map((opt: string, i: number) => {
                    const isSelected = selectedAnswer === i;
                    const isDisabled = selectedAnswer !== null || isFrozen || timeLeft <= 0;

                    return (
                        <motion.button
                            key={i}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            whileTap={!isDisabled ? { scale: 0.98 } : {}}
                            onClick={() => onAnswer(i)}
                            disabled={isDisabled}
                            className={cn(
                                "w-full p-4 rounded-xl text-left flex items-center gap-4 relative overflow-hidden transition-all border-l-4",
                                isSelected
                                    ? "bg-primary border-transparent shadow-[0_0_30px_rgba(112,0,255,0.4)] z-10"
                                    : isDisabled
                                        ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
                                        : "bg-surface-dark border-transparent hover:bg-white/5 active:bg-white/10"
                            )}
                        >
                            <span className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 transition-colors",
                                isSelected ? "bg-white text-primary" : "bg-white/10 text-white/40"
                            )}>
                                {['A', 'B', 'C', 'D'][i]}
                            </span>
                            <span className="text-base font-bold leading-tight">{opt}</span>
                            {isSelected && (
                                <motion.span
                                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="material-icons ml-auto text-white"
                                >
                                    check_circle
                                </motion.span>
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Status Footer */}
            <div className="h-6 flex items-center justify-center">
                <AnimatePresence>
                    {error && (
                        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-xs font-bold uppercase tracking-wide">
                            {error}
                        </motion.p>
                    )}
                    {isFrozen && !error && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-cyan-400">
                            <span className="material-icons text-sm">ac_unit</span>
                            <span className="text-xs font-bold uppercase tracking-wide">Congelado</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </MobileLayout>
    );
}

function FeedbackPhase({ feedback }: { feedback: { type: string, message: string } }) {
    const configs: Record<string, { bg: string; icon: string; color: string }> = {
        winner: { bg: 'from-accent-lime/20', icon: 'emoji_events', color: 'text-accent-lime' },
        correct: { bg: 'from-green-500/20', icon: 'check_circle', color: 'text-green-400' },
        wrong: { bg: 'from-red-500/20', icon: 'cancel', color: 'text-red-400' },
        key: { bg: 'from-accent-cyan/20', icon: 'vpn_key', color: 'text-accent-cyan' },
        lost: { bg: 'from-orange-500/20', icon: 'block', color: 'text-orange-400' },
        duel: { bg: 'from-purple-500/20', icon: 'swords', color: 'text-purple-400' },
        wildcard: { bg: 'from-primary/20', icon: 'bolt', color: 'text-primary' },
        distractor: { bg: 'from-red-500/15', icon: 'close', color: 'text-red-400' },
    };
    const cfg = configs[feedback.type] || configs.wrong;

    return (
        <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-6 bg-background-dark/90 backdrop-blur-xl")}>
            <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className={cn("w-full max-w-sm bg-gradient-to-b to-transparent p-[1px] rounded-[2rem]", cfg.bg)}
            >
                <div className="bg-surface-dark rounded-[2rem] p-8 flex flex-col items-center text-center border border-white/10 relative overflow-hidden">
                    <div className={cn("absolute inset-0 bg-gradient-to-b opacity-20", cfg.bg)} />

                    <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        className="relative z-10 mb-6"
                    >
                        <span className={cn("material-icons text-8xl drop-shadow-2xl", cfg.color)}>{cfg.icon}</span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-2xl font-display font-black uppercase tracking-wide relative z-10 text-balance"
                    >
                        {feedback.message}
                    </motion.h2>
                </div>
            </motion.div>
        </div>
    );
}

function GameOverPhase({ gameState }: { gameState: any }) {
    const teams = gameState ? Object.values(gameState.teams || {}) as any[] : [];
    const sorted = [...teams].sort((a, b) => b.score - a.score);

    return (
        <MobileLayout centered>
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center w-full">
                <span className="material-icons text-7xl text-yellow-500 mb-4 animate-bounce">emoji_events</span>
                <h1 className="text-5xl font-display font-black uppercase tracking-tight mb-8 text-glow">Fim de Jogo</h1>

                <div className="w-full space-y-3">
                    {sorted.slice(0, 5).map((t: any, i: number) => (
                        <motion.div
                            key={t.id}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className={cn(
                                "p-4 rounded-2xl flex items-center justify-between border",
                                i === 0
                                    ? "bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                                    : "bg-surface-dark border-white/5"
                            )}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black", i === 0 ? "bg-yellow-500 text-black" : "bg-white/10 text-white/50")}>
                                    #{i + 1}
                                </div>
                                <span className="font-bold">{t.name}</span>
                            </div>
                            <span className="text-xl font-black font-mono">{t.score}</span>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </MobileLayout>
    );
}

// --- Main Container ---

function PlayerContent() {
    const searchParams = useSearchParams();
    const { emit, on, isConnected } = useSocket();
    const SESSION_KEY = 'gamebox_player_session';

    const [phase, setPhase] = useState<'join' | 'waiting' | 'trivia' | 'feedback' | 'gameover'>('join');
    const [playerName, setPlayerName] = useState('');
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [roomCode, setRoomCode] = useState('');
    const [gameState, setGameState] = useState<any>(null);
    const [question, setQuestion] = useState<any>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(12);
    const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<{ type: string; message: string } | null>(null);
    const [error, setError] = useState('');

    const playerIdRef = useRef<string | null>(null);
    const gameStateRef = useRef<any>(null);
    const phaseRef = useRef(phase);
    const answerEventRef = useRef<'trivia:answer' | 'duel:answer'>('trivia:answer');

    // Init from Storage/URL
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const raw = localStorage.getItem(SESSION_KEY);
        let session = null;
        if (raw) {
            try { session = JSON.parse(raw); } catch { localStorage.removeItem(SESSION_KEY); }
        }

        const urlRoom = searchParams.get('room');
        if (session) {
            setPlayerName(session.playerName || '');
            setPlayerId(session.playerId || null);
            setRoomCode(urlRoom || session.roomCode || '');
        } else if (urlRoom) {
            setRoomCode(urlRoom);
        }
    }, [searchParams]);

    // Refs Sync
    useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { phaseRef.current = phase; }, [phase]);

    // Helpers
    const getDevice = useCallback(() => {
        const ua = navigator.userAgent;
        if (/iPhone/.test(ua)) return 'iPhone';
        if (/Android/.test(ua)) return 'Android';
        if (/iPad/.test(ua)) return 'iPad';
        return 'Mobile';
    }, []);

    const syncPhase = useCallback((state: any, pid: string | null) => {
        if (!state) return;
        if (state.phase === 'game_over') {
            setPhase('gameover');
            setTimerEndAt(null);
            return;
        }
        if (state.phase === 'trivia_all') {
            setQuestion(state.currentQuestion);
            setTimerEndAt(state.timerEndAt);
            setPhase('trivia');
            answerEventRef.current = 'trivia:answer';
            return;
        }
        if (state.phase === 'duel') {
            const isDuelist = pid && pid === state.triviaWinnerId;
            if (isDuelist) {
                setQuestion(state.currentQuestion);
                setTimerEndAt(state.timerEndAt);
                setPhase('trivia');
                answerEventRef.current = 'duel:answer';
            } else {
                setPhase('waiting');
            }
            return;
        }
        setPhase('waiting');
    }, []);

    // Socket Events
    useEffect(() => {
        // State Sync
        const onStateSync = (state: any) => {
            setGameState(state);
            setTimerEndAt(state?.timerEndAt || null);
            if (state?.phase === 'trivia_all' && state.currentQuestion) {
                setQuestion(state.currentQuestion);
            }
            if (playerIdRef.current && phaseRef.current !== 'feedback') {
                syncPhase(state, playerIdRef.current);
            }
        };

        const onPhaseChange = (data: any) => {
            const p = data.phase;
            if (p === 'trivia_all') {
                setSelectedAnswer(null);
                setFeedback(null);
                setError('');
                const state = gameStateRef.current;
                if (state?.currentQuestion) {
                    setQuestion(state.currentQuestion);
                    setTimerEndAt(state.timerEndAt);
                    setPhase('trivia');
                } else {
                    setPhase('waiting');
                }
                answerEventRef.current = 'trivia:answer';
            } else if (p === 'duel') {
                answerEventRef.current = 'duel:answer';
                setPhase('waiting');
            } else if (p === 'game_over') {
                setPhase('gameover');
            } else {
                setPhase('waiting');
            }
        };

        const onTriviaQuestion = (data: any) => {
            setQuestion(data.question);
            setTimerEndAt(data.timerEndAt);
            setPhase('trivia');
            setSelectedAnswer(null);
            setFeedback(null);
            setError('');
            answerEventRef.current = 'trivia:answer';
        };

        const onTriviaResult = (data: any) => {
            const pid = playerIdRef.current;
            const isWinner = data.winnerId === pid;

            if (isWinner) setFeedback({ type: 'winner', message: 'Você venceu! 🏆' });
            else {
                const myAnswer = data.answers?.find((a: any) => a.playerId === pid);
                if (myAnswer?.correct) setFeedback({ type: 'correct', message: 'Acertou!' });
                else setFeedback({ type: 'wrong', message: 'Errou!' });
            }

            setPhase('feedback');
            setTimeout(() => {
                setFeedback(null);
                setPhase('waiting');
                setSelectedAnswer(null);
            }, 3000);
        };

        const onCardOpened = (data: any) => {
            if (data.type === 'key') setFeedback({ type: 'key', message: `KEY ENCONTRADA!` });
            else if (data.type === 'lost_turn') setFeedback({ type: 'lost', message: 'PERDEU A VEZ!' });
            else if (data.type === 'duel') setFeedback({ type: 'duel', message: 'DUELO!' });
            else setFeedback({ type: 'distractor', message: 'DISTRATOR!' });

            setPhase('feedback');
            setTimeout(() => { setFeedback(null); setPhase('waiting'); }, 2500);
        };

        const onDuelStart = (data: any) => {
            if (data.currentPlayerId === playerIdRef.current) {
                setQuestion(data.question);
                setTimerEndAt(data.timerEndAt);
                setPhase('trivia');
                answerEventRef.current = 'duel:answer';
            } else {
                setPhase('waiting');
            }
        };

        const onWildcardEffect = (data: any) => {
            const pid = playerIdRef.current;
            const state = gameStateRef.current;
            if (pid && state?.players?.[pid]?.teamId === data.targetTeamId) {
                setFeedback({ type: 'wildcard', message: `WILDCARD APLICADO!` });
                setPhase('feedback');
                setTimeout(() => { setFeedback(null); setPhase('waiting'); }, 3000);
            }
        };

        const subs = [
            on('game:stateSync', onStateSync),
            on('game:phaseChange', onPhaseChange),
            on('trivia:question', onTriviaQuestion),
            on('trivia:result', onTriviaResult),
            on('card:opened', onCardOpened),
            on('duel:start', onDuelStart),
            on('wildcard:effect', onWildcardEffect)
        ];

        return () => subs.forEach(u => u());
    }, [on, syncPhase]);

    // Timer Logic
    useEffect(() => {
        if (phase !== 'trivia' || !timerEndAt) return;
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
            setTimeLeft(remaining);
        }, 100);
        return () => clearInterval(interval);
    }, [phase, timerEndAt]);

    // Rejoin Logic
    useEffect(() => {
        if (!isConnected || !roomCode || !playerId) return;
        emit('room:rejoin', {
            roomCode: roomCode.toUpperCase(),
            playerId,
            playerName,
            device: getDevice()
        }, (res: any) => {
            if (res?.success) {
                setGameState(res.state);
                syncPhase(res.state, playerId);
                emit('room:playerReady', { roomCode: roomCode.toUpperCase(), playerId }, () => { });
            } else {
                setPlayerId(null);
                localStorage.removeItem(SESSION_KEY);
                setPhase('join');
            }
        });
    }, [isConnected, roomCode, playerId, playerName, getDevice, emit, syncPhase]);

    // Actions
    const handleJoin = () => {
        if (!playerName.trim() || !roomCode.trim()) { setError('Preencha os campos'); return; }
        const code = roomCode.toUpperCase();
        emit('room:join', { roomCode: code, playerName, device: getDevice() }, (res: any) => {
            if (res.success) {
                setPlayerId(res.playerId);
                setGameState(res.state);
                setError('');
                localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode: code, playerId: res.playerId, playerName }));
                setPhase('waiting');
                emit('room:playerReady', { roomCode: code, playerId: res.playerId }, () => { });
            } else {
                setError(res.error || 'Erro ao entrar');
            }
        });
    };

    const handleAnswer = (index: number) => {
        if (selectedAnswer !== null || !playerId) return;
        setSelectedAnswer(index);
        if (navigator.vibrate) navigator.vibrate(50);
        emit(answerEventRef.current, {
            roomCode: roomCode.toUpperCase(),
            playerId,
            answerIndex: index
        }, (res: any) => {
            if (!res?.success) setSelectedAnswer(null);
        });
    };

    // Render
    return (
        <>
            <AnimatePresence mode="wait">
                {phase === 'join' && (
                    <JoinPhase
                        key="join"
                        roomCode={roomCode} setRoomCode={setRoomCode}
                        playerName={playerName} setPlayerName={setPlayerName}
                        onJoin={handleJoin} isConnected={isConnected} error={error}
                    />
                )}

                {phase === 'waiting' && (
                    <WaitingPhase
                        key="waiting"
                        gameState={gameState}
                        myTeam={playerId ? gameState?.teams?.[gameState.players[playerId]?.teamId] : null}
                    />
                )}

                {phase === 'trivia' && (
                    <TriviaPhase
                        key="trivia"
                        question={question} timeLeft={timeLeft} selectedAnswer={selectedAnswer}
                        onAnswer={handleAnswer} error={error}
                        isFrozen={false} // TODO: Add Frozen Logic back if needed
                    />
                )}

                {phase === 'gameover' && (
                    <GameOverPhase key="gameover" gameState={gameState} />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {phase === 'feedback' && feedback && (
                    <FeedbackPhase key="feedback" feedback={feedback} />
                )}
            </AnimatePresence>
        </>
    );
}

export default function PlayPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background-dark flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary rounded-full animate-spin border-t-transparent" /></div>}>
            <PlayerContent />
        </Suspense>
    );
}
