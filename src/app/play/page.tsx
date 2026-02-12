'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useAudio } from '@/hooks/useAudio';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Components ---

function MobileLayout({ children, className = '', centered = false }: { children: React.ReactNode; className?: string; centered?: boolean }) {
    return (
        <div className="min-h-[100dvh] flex flex-col bg-background-dark text-white font-body overflow-x-hidden relative">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-20%] w-[70vw] h-[70vw] bg-primary/15 blur-[120px] rounded-full mix-blend-screen animate-float" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-accent-emerald/8 blur-[100px] rounded-full mix-blend-screen animate-float" style={{ animationDelay: '-1.5s' }} />
                <div className="absolute top-[50%] right-[-15%] w-[40vw] h-[40vw] bg-accent-red/5 blur-[100px] rounded-full" />
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
                <div className="w-24 h-24 bg-surface-dark rounded-3xl flex items-center justify-center mb-8 border border-primary/30 relative overflow-hidden group shadow-[0_0_30px_rgba(247,183,49,0.15)]">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-50" />
                    <span className="material-icons text-primary text-5xl relative z-10 group-hover:scale-110 transition-transform duration-300">casino</span>
                </div>

                <h1 className="text-4xl font-display font-black uppercase text-center mb-2 tracking-wider">
                    Caixa <span className="text-primary text-glow">Misteriosa</span>
                </h1>
                <p className="text-white/50 text-sm mb-10 text-center font-medium tracking-wide">♠ CASINO GAME SHOW ♠</p>

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
        const ph = gameState?.phase;
        if (ph === 'lobby') return { icon: 'hourglass_top', text: 'Aguardando início...' };
        if (ph === 'box_select') return { icon: 'casino', text: 'Escolhendo a Caixa...' };
        if (ph === 'ranking_challenge') return { icon: 'leaderboard', text: 'Desafio no Telão' };
        if (ph === 'card_open') return { icon: 'style', text: 'Abrindo Cartas...' };
        if (ph === 'reveal') return { icon: 'redeem', text: 'Revelando Prêmio...' };
        if (ph === 'wildcard') return { icon: 'bolt', text: 'Wildcard Ativado!' };
        if (ph === 'duel') return { icon: 'swords', text: 'Duelo em Andamento' };
        return { icon: 'hourglass_top', text: 'Aguardando...' };
    };
    const info = getWaitInfo();

    // Build sorted leaderboard from teams
    const teams = gameState?.teams ? Object.values(gameState.teams) as any[] : [];
    const sortedTeams = [...teams].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    return (
        <MobileLayout centered>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full flex flex-col items-center"
            >
                <div className="relative mb-8">
                    <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-24 h-24 rounded-full bg-surface-dark border border-primary/10 flex items-center justify-center shadow-[0_0_30px_rgba(247,183,49,0.1)] relative z-10"
                    >
                        <span className="material-icons text-4xl text-primary">{info.icon}</span>
                    </motion.div>
                </div>

                <h2 className="text-2xl font-black uppercase tracking-wide mb-2 text-center">{info.text}</h2>
                <p className="text-white/40 text-sm font-medium tracking-wider uppercase mb-8">♦ Olhe para o telão ♦</p>

                {myTeam && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="w-full max-w-xs bg-gradient-to-b from-surface-dark to-black/40 border border-primary/10 p-5 rounded-3xl text-center relative overflow-hidden mb-6"
                    >
                        <p className="text-[10px] text-primary/40 uppercase tracking-[0.2em] font-bold mb-2">♠ Seu Time</p>
                        <p className="text-2xl font-black text-white mb-1 tracking-tight">{myTeam.name}</p>
                        <div className="chip-badge mt-2">
                            <span className="text-lg text-primary">{myTeam.score} pts</span>
                        </div>
                    </motion.div>
                )}

                {/* Mini Leaderboard */}
                {sortedTeams.length > 1 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="w-full max-w-xs bg-surface-dark/50 border border-white/5 rounded-2xl p-4"
                    >
                        <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mb-3 text-center">Placar</p>
                        <div className="space-y-2">
                            {sortedTeams.slice(0, 4).map((team: any, idx: number) => (
                                <div
                                    key={team.id || idx}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2 rounded-xl text-sm",
                                        myTeam?.id === team.id ? "bg-primary/10 border border-primary/20" : "bg-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-xs font-black w-5 text-center",
                                            idx === 0 ? "text-primary" : "text-white/30"
                                        )}>
                                            {idx + 1}º
                                        </span>
                                        <span className="font-bold truncate max-w-[120px]">{team.name}</span>
                                    </div>
                                    <span className={cn(
                                        "font-mono font-bold text-xs",
                                        idx === 0 ? "text-primary" : "text-white/50"
                                    )}>
                                        {team.score || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Key Status */}
                {gameState?.cardGrid?.length > 0 && (
                    <div className="mt-6 flex gap-4">
                        {[0, 1, 2].map(i => {
                            const isLocked = i < (gameState.lockedKeys || 0);
                            return (
                                <motion.div
                                    key={i}
                                    initial={false}
                                    animate={{
                                        backgroundColor: isLocked ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                        borderColor: isLocked ? 'rgba(0, 230, 118, 0.4)' : 'rgba(247, 183, 49, 0.1)',
                                        scale: isLocked ? 1.1 : 1
                                    }}
                                    className="w-12 h-12 rounded-xl border flex items-center justify-center"
                                >
                                    <span className={cn("material-icons text-xl", isLocked ? "text-accent-emerald" : "text-primary/20")}>
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

function DuelSelectPhase({
    gameState, playerId, onSelectOpponent, isSubmitting, error
}: {
    gameState: any;
    playerId: string;
    onSelectOpponent: (opponentId: string) => void;
    isSubmitting: boolean;
    error: string;
}) {
    const myTeamId = gameState?.players?.[playerId]?.teamId;
    const candidates = Object.values(gameState?.players || {})
        .filter((p: any) => p.id !== playerId && p.isConnected)
        .filter((p: any) => !myTeamId || !p.teamId || p.teamId !== myTeamId);

    return (
        <MobileLayout>
            <div className="flex items-center justify-between mb-6">
                <span className="px-3 py-1 rounded-full bg-accent-red/15 border border-accent-red/30 text-[10px] font-bold uppercase tracking-widest text-accent-red">
                    ♠ Duelo
                </span>
                <div className="flex items-center gap-2 text-accent-red font-bold">
                    <span className="material-icons text-lg">swords</span>
                    <span className="text-xs uppercase tracking-wider">Escolha um oponente</span>
                </div>
            </div>

            <div className="bg-gradient-to-br from-accent-red/10 to-transparent border border-accent-red/20 p-5 rounded-3xl mb-5">
                <p className="text-lg font-black uppercase tracking-wide text-center">Com quem voce quer duelar?</p>
            </div>

            <div className="flex-1 flex flex-col gap-3 pb-4">
                {candidates.map((player: any) => (
                    <button
                        key={player.id}
                        onClick={() => onSelectOpponent(player.id)}
                        disabled={isSubmitting}
                        className="w-full p-4 rounded-xl text-left flex items-center gap-3 border border-primary/10 bg-surface-dark hover:bg-primary/5 hover:border-primary/25 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <span className="material-icons text-primary">person</span>
                        <div className="flex-1">
                            <p className="font-bold">{player.name}</p>
                            <p className="text-xs text-white/40 uppercase tracking-wide">{player.device || 'Jogador'}</p>
                        </div>
                        <span className="material-icons text-white/30">arrow_forward</span>
                    </button>
                ))}
            </div>

            {candidates.length === 0 && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-center">
                    <p className="text-orange-300 text-xs font-bold uppercase tracking-wide">
                        Nenhum oponente disponivel agora
                    </p>
                </div>
            )}

            <div className="h-8 flex items-center justify-center">
                {isSubmitting && (
                    <p className="text-primary text-xs font-bold uppercase tracking-wide">Iniciando duelo...</p>
                )}
                {!isSubmitting && error && (
                    <p className="text-red-400 text-xs font-bold uppercase tracking-wide">{error}</p>
                )}
            </div>
        </MobileLayout>
    );
}

function TriviaPhase({
    question, timeLeft, selectedAnswer, onAnswer, error, isFrozen
}: {
    question: any, timeLeft: number, selectedAnswer: number | null, onAnswer: (i: number) => void, error: string, isFrozen: boolean
}) {
    const totalTime = Math.max(1, Number(question?.timeLimit) || 12);
    const progress = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));
    const isCritical = timeLeft <= 3;

    // Vibrate when timer gets critical
    useEffect(() => {
        if (isCritical && timeLeft > 0 && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
    }, [isCritical, timeLeft]);

    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress / 100);

    return (
        <MobileLayout>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-widest text-primary/80">
                    ♦ {question?.category || 'Trivia'}
                </span>

                {/* Circular Timer */}
                <div className={cn(
                    "relative w-16 h-16",
                    isCritical && "animate-[urgentShake_0.4s_ease-in-out_infinite]"
                )}>
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                        <motion.circle
                            cx="32" cy="32" r={radius}
                            fill="none"
                            stroke={isCritical ? '#FF1744' : '#F7B731'}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            initial={false}
                            animate={{ strokeDashoffset }}
                            transition={{ duration: 0.2 }}
                            style={{
                                filter: isCritical
                                    ? 'drop-shadow(0 0 6px rgba(255,23,68,0.5))'
                                    : 'drop-shadow(0 0 4px rgba(247,183,49,0.3))',
                            }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.span
                            key={timeLeft}
                            initial={{ scale: 1.3 }}
                            animate={{ scale: 1 }}
                            className={cn(
                                'text-lg font-mono font-black tabular-nums',
                                isCritical ? 'text-accent-red' : 'text-primary'
                            )}
                        >
                            {timeLeft}
                        </motion.span>
                    </div>
                </div>
            </div>

            {/* Question Card */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-gradient-to-br from-surface-dark to-background-mid border border-primary/10 p-6 rounded-3xl shadow-xl mb-6 min-h-[140px] flex items-center justify-center relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
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
                                    ? "bg-primary/20 border-primary shadow-[0_0_30px_rgba(247,183,49,0.3)] z-10"
                                    : isDisabled
                                        ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
                                        : "bg-surface-dark border-primary/10 hover:bg-primary/5 active:bg-primary/10"
                            )}
                        >
                            <span className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 transition-colors",
                                isSelected ? "bg-primary text-black" : "bg-primary/10 text-primary/40"
                            )}>
                                {['♠', '♥', '♦', '♣'][i]}
                            </span>
                            <span className="text-base font-bold leading-tight">{opt}</span>
                            {isSelected && (
                                <motion.span
                                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="material-icons ml-auto text-primary"
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

type FeedbackData = { type: string; message: string; detail?: string };

function FeedbackPhase({ feedback }: { feedback: FeedbackData }) {
    const configs: Record<string, { bg: string; icon: string; color: string }> = {
        winner: { bg: 'from-primary/20', icon: 'emoji_events', color: 'text-primary' },
        correct: { bg: 'from-accent-emerald/20', icon: 'check_circle', color: 'text-accent-emerald' },
        wrong: { bg: 'from-accent-red/20', icon: 'cancel', color: 'text-accent-red' },
        key: { bg: 'from-accent-emerald/20', icon: 'vpn_key', color: 'text-accent-emerald' },
        lost: { bg: 'from-orange-500/20', icon: 'block', color: 'text-orange-400' },
        duel: { bg: 'from-accent-red/20', icon: 'swords', color: 'text-accent-red' },
        wildcard: { bg: 'from-primary/20', icon: 'bolt', color: 'text-primary' },
        distractor: { bg: 'from-accent-red/15', icon: 'close', color: 'text-accent-red' },
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
                    {feedback.detail && (
                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mt-3 text-sm text-white/70 font-semibold relative z-10 text-balance"
                        >
                            {feedback.detail}
                        </motion.p>
                    )}
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
                <span className="material-icons text-7xl text-primary mb-4 animate-bounce">emoji_events</span>
                <h1 className="text-5xl font-display font-black uppercase tracking-tight mb-8 text-glow">♛ Fim de Jogo</h1>

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
                                    ? "bg-primary/10 border-primary/50 shadow-[0_0_20px_rgba(247,183,49,0.2)]"
                                    : "bg-surface-dark border-primary/5"
                            )}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black", i === 0 ? "bg-primary text-black" : "bg-white/10 text-white/50")}>
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
    const audio = useAudio();
    const SESSION_KEY = 'gamebox_player_session';
    type StoredSession = { playerName?: string; playerId?: string | null; roomCode?: string };

    const [phase, setPhase] = useState<'join' | 'waiting' | 'duel_select' | 'trivia' | 'feedback' | 'gameover'>('join');
    const [playerName, setPlayerName] = useState('');
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [roomCode, setRoomCode] = useState('');
    const [gameState, setGameState] = useState<any>(null);
    const [question, setQuestion] = useState<any>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(12);
    const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<FeedbackData | null>(null);
    const [error, setError] = useState('');
    const [isSelectingOpponent, setIsSelectingOpponent] = useState(false);

    const playerIdRef = useRef<string | null>(null);
    const gameStateRef = useRef<any>(null);
    const phaseRef = useRef(phase);
    const answerEventRef = useRef<'trivia:answer' | 'duel:answer'>('trivia:answer');
    const clockOffsetMsRef = useRef(0);

    // Init from Storage/URL
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const raw = localStorage.getItem(SESSION_KEY);
        let session: StoredSession | null = null;
        if (raw) {
            try { session = JSON.parse(raw) as StoredSession; } catch { localStorage.removeItem(SESSION_KEY); }
        }

        const urlRoom = searchParams.get('room');
        const nextPlayerName = session?.playerName || '';
        const nextPlayerId = session?.playerId || null;
        const nextRoomCode = urlRoom || session?.roomCode || '';
        const timerId = window.setTimeout(() => {
            setPlayerName(nextPlayerName);
            setPlayerId(nextPlayerId);
            setRoomCode(nextRoomCode);
        }, 0);

        return () => window.clearTimeout(timerId);
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

    const updateClockOffset = useCallback((serverNow: unknown) => {
        const numericServerNow = Number(serverNow);
        if (Number.isFinite(numericServerNow) && numericServerNow > 0) {
            clockOffsetMsRef.current = numericServerNow - Date.now();
        }
    }, []);

    const syncPhase = useCallback((state: any, pid: string | null) => {
        if (!state) return;
        if (state.phase === 'game_over') {
            setIsSelectingOpponent(false);
            setPhase('gameover');
            setTimerEndAt(null);
            return;
        }
        if (state.phase === 'trivia_all') {
            setIsSelectingOpponent(false);
            setQuestion(state.currentQuestion);
            setTimerEndAt(state.timerEndAt);
            setPhase('trivia');
            answerEventRef.current = 'trivia:answer';
            return;
        }
        if (state.phase === 'duel') {
            const isChooser = !!pid && pid === state.triviaWinnerId;
            const isDuelist = !!pid && (pid === state.triviaWinnerId || pid === state.duelOpponentId);
            const duelStarted = !!state.currentQuestion && !!state.timerEndAt && !!state.duelOpponentId;

            if (isChooser && !state.duelOpponentId && !duelStarted) {
                setSelectedAnswer(null);
                setQuestion(null);
                setTimerEndAt(null);
                setError('');
                setPhase('duel_select');
                answerEventRef.current = 'duel:answer';
                return;
            }

            if (duelStarted && isDuelist) {
                setIsSelectingOpponent(false);
                setError('');
                setQuestion(state.currentQuestion);
                setTimerEndAt(state.timerEndAt);
                setPhase('trivia');
                answerEventRef.current = 'duel:answer';
            } else {
                setIsSelectingOpponent(false);
                setPhase('waiting');
            }
            return;
        }
        setIsSelectingOpponent(false);
        setPhase('waiting');
    }, []);

    // Socket Events
    useEffect(() => {
        // State Sync
        const onStateSync = (state: any) => {
            updateClockOffset(state?.serverNow);
            setGameState(state);
            setTimerEndAt(state?.timerEndAt || null);
            if (state?.phase === 'trivia_all' && state.currentQuestion) {
                setQuestion(state.currentQuestion);
            }
            if (state?.phase === 'duel' && state.currentQuestion) {
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
                setIsSelectingOpponent(false);
                setQuestion(null);
                setTimerEndAt(null);
                setSelectedAnswer(null);
                setPhase('waiting');
            } else if (p === 'game_over') {
                setPhase('gameover');
            } else {
                setPhase('waiting');
            }
        };

        const onTriviaQuestion = (data: any) => {
            updateClockOffset(data?.serverNow);
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

            if (isWinner) {
                setFeedback({ type: 'winner', message: 'Você venceu! 🏆' });
                audio.playSFX('correct');
            } else {
                const myAnswer = data.answers?.find((a: any) => a.playerId === pid);
                if (myAnswer?.correct) {
                    setFeedback({ type: 'correct', message: 'Acertou!' });
                    audio.playSFX('correct');
                } else {
                    setFeedback({ type: 'wrong', message: 'Errou!' });
                    audio.playSFX('wrong');
                }
            }

            setPhase('feedback');
            setTimeout(() => {
                setFeedback(null);
                setPhase('waiting');
                setSelectedAnswer(null);
            }, 3000);
        };

        const onCardOpened = (data: any) => {
            if (data.type === 'key') {
                setFeedback({ type: 'key', message: `KEY ENCONTRADA!` });
                audio.playSFX('key');
            } else if (data.type === 'lost_turn') {
                setFeedback({ type: 'lost', message: 'PERDEU A VEZ!' });
                audio.playSFX('lostTurn');
            } else if (data.type === 'duel') {
                setFeedback({ type: 'duel', message: 'DUELO!' });
                audio.playSFX('duel');
            } else {
                setFeedback({ type: 'distractor', message: 'DISTRATOR!' });
                audio.playSFX('distractor');
            }

            setPhase('feedback');
            setTimeout(() => { setFeedback(null); setPhase('waiting'); }, 2500);
        };

        const onDuelStart = (data: any) => {
            updateClockOffset(data?.serverNow);
            const pid = playerIdRef.current;
            const participants = Array.isArray(data.playerIds)
                ? data.playerIds
                : [data.currentPlayerId, data.opponentPlayerId].filter(Boolean);

            if (pid && participants.includes(pid)) {
                setQuestion(data.question);
                setTimerEndAt(data.timerEndAt);
                setPhase('trivia');
                setSelectedAnswer(null);
                setIsSelectingOpponent(false);
                setError('');
                answerEventRef.current = 'duel:answer';
            } else {
                setPhase('waiting');
            }
        };

        const onDuelResult = (data: any) => {
            const pid = playerIdRef.current;
            const winnerId = data?.winnerId || null;
            const iWon = !!pid && winnerId === pid;
            const myDelta = pid ? Number(data?.pointChanges?.[pid] || 0) : 0;
            const correctIndex = Number(data?.correctIndex);
            const options = Array.isArray(data?.question?.options) ? data.question.options : [];
            const correctOption = Number.isInteger(correctIndex) && correctIndex >= 0 ? options[correctIndex] : null;

            let message = 'Duelo encerrado';
            if (winnerId) {
                message = iWon
                    ? `Voce venceu o duelo! +${myDelta} pts`
                    : `${data?.winnerName || 'Outro jogador'} venceu o duelo`;
            } else {
                message = 'Ninguem acertou o duelo';
            }

            const detailParts = [];
            if (correctOption) {
                const optionLetter = ['A', 'B', 'C', 'D'][correctIndex] || '?';
                detailParts.push(`Resposta correta: ${optionLetter}) ${correctOption}`);
            }
            if (pid) {
                detailParts.push(`Seus pontos no duelo: ${myDelta >= 0 ? '+' : ''}${myDelta}`);
            }

            setFeedback({
                type: winnerId ? (iWon ? 'winner' : 'duel') : 'wrong',
                message,
                detail: detailParts.join(' • '),
            });
            setPhase('feedback');
            setTimerEndAt(null);
            setSelectedAnswer(null);
            setTimeout(() => {
                setFeedback(null);
                setPhase('waiting');
            }, 3500);
        };

        const onWildcardEffect = (data: any) => {
            const pid = playerIdRef.current;
            const state = gameStateRef.current;
            if (pid && state?.players?.[pid]?.teamId === data.targetTeamId) {
                setFeedback({ type: 'wildcard', message: `WILDCARD APLICADO!` });
                audio.playSFX('wildcard');
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
            on('duel:result', onDuelResult),
            on('wildcard:effect', onWildcardEffect)
        ];

        return () => subs.forEach(u => u());
    }, [on, syncPhase, audio, updateClockOffset]);

    // Timer Logic
    useEffect(() => {
        if (phase !== 'trivia' || !timerEndAt) return;
        const interval = setInterval(() => {
            const now = Date.now() + clockOffsetMsRef.current;
            const remaining = Math.max(0, Math.ceil((timerEndAt - now) / 1000));
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
                updateClockOffset(res?.state?.serverNow);
                setGameState(res.state);
                syncPhase(res.state, playerId);
                emit('room:playerReady', { roomCode: roomCode.toUpperCase(), playerId }, () => { });
            } else {
                setPlayerId(null);
                localStorage.removeItem(SESSION_KEY);
                setPhase('join');
            }
        });
    }, [isConnected, roomCode, playerId, playerName, getDevice, emit, syncPhase, updateClockOffset]);

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
        audio.playSFX('flip');
        emit(answerEventRef.current, {
            roomCode: roomCode.toUpperCase(),
            playerId,
            answerIndex: index
        }, (res: any) => {
            if (!res?.success) setSelectedAnswer(null);
        });
    };

    const handleSelectOpponent = (opponentId: string) => {
        if (!playerId || !roomCode || isSelectingOpponent) return;
        setIsSelectingOpponent(true);
        setError('');
        emit('duel:selectOpponent', {
            roomCode: roomCode.toUpperCase(),
            playerId,
            opponentId,
        }, (res: any) => {
            setIsSelectingOpponent(false);
            if (!res?.success) {
                setError(res?.error || 'Nao foi possivel selecionar oponente');
            }
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

                {phase === 'duel_select' && playerId && (
                    <DuelSelectPhase
                        key="duel_select"
                        gameState={gameState}
                        playerId={playerId}
                        onSelectOpponent={handleSelectOpponent}
                        isSubmitting={isSelectingOpponent}
                        error={error}
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
