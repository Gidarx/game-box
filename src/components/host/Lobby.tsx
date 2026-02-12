'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
    gameState: any;
    roomCode: string;
    serverInfo: { localIP: string; port: number; playerUrl: string } | null;
    onStartGame: () => void;
    onUpdateSettings: (settings: Record<string, unknown>) => void;
    onAddBots: (count: number) => void;
    onClearBots: () => void;
}

export default function HostLobby({
    gameState,
    roomCode,
    serverInfo,
    onStartGame,
    onUpdateSettings,
    onAddBots,
    onClearBots,
}: Props) {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');

    const players = Object.values(gameState.players || {}) as any[];
    const connectedPlayers = players.filter((p: any) => p.isConnected);
    const connectedCount = connectedPlayers.length;
    const botCount = connectedPlayers.filter((p: any) => p.isBot).length;
    const canStart = connectedCount >= 3;
    const selectedCategories: string[] = Array.isArray(gameState.questionCategories) && gameState.questionCategories.length > 0
        ? gameState.questionCategories
        : ['all'];
    const scoring = gameState.scoring || { triviaWinPoints: 10, duelWinPoints: 120 };

    const CATEGORY_LABELS: Record<string, string> = {
        all: 'Todas',
        ciencia: 'Ciência',
        historia: 'História',
        geografia: 'Geografia',
        arte: 'Arte',
        musica: 'Música',
        tech: 'Tech',
        esportes: 'Esportes',
        entretenimento: 'Entretenimento',
    };

    const toggleCategory = (category: string) => {
        if (category === 'all') {
            onUpdateSettings({ questionCategories: ['all'] });
            return;
        }
        const current = selectedCategories.includes('all') ? [] : selectedCategories;
        const next = current.includes(category)
            ? current.filter((item) => item !== category)
            : [...current, category];
        onUpdateSettings({ questionCategories: next.length > 0 ? next : ['all'] });
    };

    const playerUrl = serverInfo
        ? `http://${serverInfo.localIP}:${serverInfo.port}/play?room=${roomCode}`
        : `http://localhost:3000/play?room=${roomCode}`;

    useEffect(() => {
        QRCode.toDataURL(playerUrl, {
            width: 320,
            margin: 1,
            color: { dark: '#0A0E17', light: '#F7B731' },
        }).then(setQrDataUrl);
    }, [playerUrl]);

    const missingPlayers = Math.max(0, 3 - connectedCount);

    return (
        <div className="app-shell p-4 md:p-6 lg:p-8 overflow-hidden bg-background-dark text-white font-body">
            <div className="max-w-[1680px] mx-auto h-[calc(100dvh-2rem)] md:h-[calc(100dvh-3rem)] flex flex-col gap-5">

                {/* Header */}
                <motion.header
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="glass-panel rounded-2xl px-6 py-5 md:px-8 flex items-center justify-between gap-6 relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(247,183,49,0.2)]">
                            <span className="material-icons text-3xl text-primary">casino</span>
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-2xl md:text-3xl font-display font-black uppercase leading-none tracking-wide">
                                Caixa <span className="text-primary text-glow">Misteriosa</span>
                            </h1>
                            <p className="text-sm text-white/40 mt-1 font-medium tracking-wider uppercase">Mesa Ativa &bull; {serverInfo?.localIP || 'Localhost'}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3">
                        {/* Mode */}
                        <div className="flex bg-black/30 p-1 rounded-lg border border-primary/10">
                            {['solo', 'equipes'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => onUpdateSettings({ mode })}
                                    className={cn(
                                        "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                                        gameState.mode === mode
                                            ? "bg-primary text-black shadow-sm"
                                            : "text-white/40 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>

                        {/* Box Count */}
                        <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-primary/10 px-2 h-[34px]">
                            <span className="text-[10px] font-black uppercase tracking-wider text-white/30 mr-1 hidden sm:inline-block">Caixas</span>
                            <button
                                onClick={() => onUpdateSettings({ boxCount: Math.max(5, (gameState.boxCount || 13) - 1) })}
                                className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
                            >
                                <span className="material-icons text-[10px]">remove</span>
                            </button>
                            <span className="font-mono font-black text-sm w-5 text-center text-primary">{gameState.boxCount || 13}</span>
                            <button
                                onClick={() => onUpdateSettings({ boxCount: Math.min(13, (gameState.boxCount || 13) + 1) })}
                                className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
                            >
                                <span className="material-icons text-[10px]">add</span>
                            </button>
                        </div>

                        <div className="chip-badge">
                            <span className="material-icons text-[14px] text-accent-emerald">groups</span>
                            <span className="font-bold text-white">{connectedCount}/8</span>
                        </div>
                        {/* Bot Control */}
                        <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-primary/10 px-2 h-[34px]">
                            <span className="material-icons text-[14px] text-primary/60 mr-1">smart_toy</span>
                            <span className="font-bold text-white text-sm w-4 text-center">{botCount}</span>
                            <div className="w-px h-3 bg-white/10 mx-1" />
                            <button
                                onClick={() => onAddBots(1)}
                                className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center transition-colors text-primary hover:text-white"
                                title="Adicionar Bot"
                            >
                                <span className="material-icons text-[14px]">add</span>
                            </button>
                            {botCount > 0 && (
                                <button
                                    onClick={onClearBots}
                                    className="w-6 h-6 rounded hover:bg-red-500/20 flex items-center justify-center transition-colors text-red-400 hover:text-red-300 ml-1"
                                    title="Remover Todos"
                                >
                                    <span className="material-icons text-[14px]">close</span>
                                </button>
                            )}
                        </div>
                    </div>
                </motion.header>

                <main className="flex-1 grid grid-cols-12 gap-5 min-h-0">
                    {/* QR Code Section */}
                    <motion.section
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="col-span-12 lg:col-span-4 glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center relative"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/3 to-transparent pointer-events-none" />

                        <div className="mb-6">
                            <span className="px-3 py-1 rounded-full bg-accent-emerald/10 border border-accent-emerald/20 text-[10px] font-black uppercase tracking-[0.2em] text-accent-emerald">
                                ♠ VIP Entry
                            </span>
                            <h2 className="text-3xl font-display font-black mt-4 uppercase">Escaneie para Jogar</h2>
                            <p className="text-white/40 mt-2 text-sm max-w-xs mx-auto">Use a câmera do seu celular para entrar na mesa</p>
                        </div>

                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="p-4 rounded-3xl bg-primary shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-primary-dark/30 relative group"
                        >
                            <div className="absolute -inset-4 bg-gradient-to-tr from-primary via-accent-emerald to-primary rounded-[2.5rem] -z-10 opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500" />
                            {qrDataUrl ? (
                                <Image
                                    src={qrDataUrl}
                                    alt="QR Code"
                                    width={256}
                                    height={256}
                                    unoptimized
                                    className="w-56 h-56 md:w-64 md:h-64 object-contain rounded-xl"
                                />
                            ) : (
                                <div className="w-56 h-56 md:w-64 md:h-64 grid place-items-center">
                                    <div className="w-10 h-10 border-4 border-background-dark border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </motion.div>

                        <div className="mt-8 flex flex-col items-center gap-2 w-full max-w-xs">
                            <div className="w-full flex items-center gap-2 bg-surface-dark/50 border border-primary/10 rounded-xl p-1 pr-3">
                                <div className="bg-primary/10 px-3 py-2 rounded-lg">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-primary/60">URL</span>
                                </div>
                                <code className="flex-1 text-xs text-accent-emerald font-mono truncate">{playerUrl}</code>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Código</span>
                                <span className="text-4xl font-mono font-black text-primary tracking-widest text-glow">{roomCode}</span>
                            </div>
                        </div>
                    </motion.section>

                    {/* Players List */}
                    <motion.section
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="col-span-12 lg:col-span-8 flex flex-col gap-5 min-h-0"
                    >
                        {/* Status Bar */}
                        <div className="glass-panel rounded-2xl p-6 flex items-center justify-between">
                            <div>
                                <h3 className={cn("text-2xl font-black uppercase tracking-wide flex items-center gap-3", canStart ? "text-accent-emerald" : "text-white/60")}>
                                    {canStart ? (
                                        <>
                                            <span className="material-icons">check_circle</span>
                                            Pronto para Iniciar
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-icons animate-spin">sync</span>
                                            Aguardando Jogadores...
                                        </>
                                    )}
                                </h3>
                                <p className="text-sm text-white/35 font-bold uppercase tracking-wider mt-1 ml-9">
                                    {canStart ? 'O dealer já pode começar o jogo' : `Mínimo de 3 jogadores (Faltam ${missingPlayers})`}
                                </p>
                            </div>
                        </div>

                        {/* Roster */}
                        <div className="glass-panel rounded-2xl p-6 flex-1 min-h-0 overflow-hidden flex flex-col bg-surface-dark/20">
                            <h3 className="text-sm font-black uppercase tracking-[0.15em] text-primary/40 mb-6 flex items-center gap-2">
                                <span className="material-icons text-base">style</span>
                                Jogadores na Mesa
                            </h3>

                            <div className="grid md:grid-cols-2 gap-4 overflow-y-auto pr-2 pb-2">
                                <AnimatePresence>
                                    {connectedPlayers.map((player: any, i: number) => (
                                        <motion.div
                                            key={player.id}
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.9, opacity: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="bg-surface-dark border border-primary/5 p-4 rounded-xl flex items-center justify-between group hover:border-primary/20 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black border",
                                                    player.isBot
                                                        ? "bg-primary/10 border-primary/25 text-primary"
                                                        : "bg-accent-emerald/10 border-accent-emerald/25 text-accent-emerald"
                                                )}>
                                                    {player.name?.[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-lg leading-tight">{player.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {player.isBot && <span className="text-[10px] bg-primary/15 text-primary px-1.5 rounded uppercase font-bold tracking-wider">Bot</span>}
                                                        <span className="text-xs text-white/25 font-medium uppercase tracking-wide">{player.device || 'Unknown'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-white/10 font-mono font-black text-2xl group-hover:text-primary/20 transition-colors">#{i + 1}</span>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {Array.from({ length: Math.max(0, 8 - connectedCount) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="border-2 border-dashed border-primary/5 rounded-xl p-4 flex items-center justify-center gap-3 text-white/15">
                                        <span className="material-icons">person_outline</span>
                                        <span className="text-xs font-bold uppercase tracking-wider">Vazio</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.section>
                </main>

                {/* Footer Controls */}
                <motion.footer
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="glass-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-6 relative overflow-hidden"
                >
                    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

                    <div className="flex flex-wrap items-center gap-6">
                        {/* Categories */}
                        <div className="flex flex-col gap-2 min-w-[280px] flex-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/25">Categorias</label>
                            <div className="flex flex-wrap gap-1.5 bg-black/30 p-2 rounded-xl border border-primary/5">
                                {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
                                    const active = selectedCategories.includes('all')
                                        ? category === 'all'
                                        : selectedCategories.includes(category);
                                    return (
                                        <button
                                            key={category}
                                            onClick={() => toggleCategory(category)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                                                active
                                                    ? "bg-primary text-black"
                                                    : "text-white/40 hover:text-white hover:bg-white/5"
                                            )}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Scoring */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/25">Pontuação</label>
                            <div className="flex items-center gap-4 bg-black/30 p-2 rounded-xl border border-primary/5">
                                {/* Trivia Score */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onUpdateSettings({ scoring: { triviaWinPoints: Math.max(5, Number(scoring.triviaWinPoints || 10) - 1), duelWinPoints: Number(scoring.duelWinPoints || 120) } })}
                                        className="w-7 h-7 rounded-lg hover:bg-primary/10 text-primary/60 hover:text-primary flex items-center justify-center transition-colors"
                                    >
                                        <span className="material-icons text-sm">remove</span>
                                    </button>
                                    <div className="flex flex-col items-center min-w-[3rem]">
                                        <span className="text-[10px] uppercase font-black text-white/40 leading-none mb-0.5">Trivia</span>
                                        <span className="text-xl font-mono font-black text-primary leading-none">{Number(scoring.triviaWinPoints || 10)}</span>
                                    </div>
                                    <button
                                        onClick={() => onUpdateSettings({ scoring: { triviaWinPoints: Math.max(5, Number(scoring.triviaWinPoints || 10) + 1), duelWinPoints: Number(scoring.duelWinPoints || 120) } })}
                                        className="w-7 h-7 rounded-lg hover:bg-primary/10 text-primary/60 hover:text-primary flex items-center justify-center transition-colors"
                                    >
                                        <span className="material-icons text-sm">add</span>
                                    </button>
                                </div>

                                <div className="w-px h-8 bg-white/10" />

                                {/* Duel Score */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onUpdateSettings({ scoring: { triviaWinPoints: Number(scoring.triviaWinPoints || 10), duelWinPoints: Math.max(60, Number(scoring.duelWinPoints || 120) - 10) } })}
                                        className="w-7 h-7 rounded-lg hover:bg-primary/10 text-primary/60 hover:text-primary flex items-center justify-center transition-colors"
                                    >
                                        <span className="material-icons text-sm">remove</span>
                                    </button>
                                    <div className="flex flex-col items-center min-w-[3rem]">
                                        <span className="text-[10px] uppercase font-black text-white/40 leading-none mb-0.5">Duelo</span>
                                        <span className="text-xl font-mono font-black text-primary leading-none">{Number(scoring.duelWinPoints || 120)}</span>
                                    </div>
                                    <button
                                        onClick={() => onUpdateSettings({ scoring: { triviaWinPoints: Number(scoring.triviaWinPoints || 10), duelWinPoints: Math.min(240, Number(scoring.duelWinPoints || 120) + 10) } })}
                                        className="w-7 h-7 rounded-lg hover:bg-primary/10 text-primary/60 hover:text-primary flex items-center justify-center transition-colors"
                                    >
                                        <span className="material-icons text-sm">add</span>
                                    </button>
                                </div>

                                <div className="w-px h-8 bg-white/10" />

                                {/* Auto Balance */}
                                <button
                                    onClick={() => onUpdateSettings({ autoBalanceScoring: !gameState.autoBalanceScoring })}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-all border",
                                        gameState.autoBalanceScoring
                                            ? "bg-accent-emerald/10 border-accent-emerald/40"
                                            : "bg-white/5 border-white/5 hover:border-white/10"
                                    )}
                                >
                                    <span className="text-[9px] font-black uppercase tracking-wider text-white/40">Auto Balance</span>
                                    <span className={cn(
                                        "text-xs font-black uppercase tracking-widest",
                                        gameState.autoBalanceScoring ? "text-accent-emerald" : "text-white/20"
                                    )}>
                                        {gameState.autoBalanceScoring ? 'ATIVADO' : 'OFF'}
                                    </span>
                                </button>
                            </div>
                        </div>

                    </div>

                    <button
                        onClick={onStartGame}
                        disabled={!canStart}
                        className={cn(
                            "btn-primary py-4 px-10 text-lg shadow-xl",
                            !canStart && "opacity-50 grayscale cursor-not-allowed"
                        )}
                    >
                        <span className="material-icons">play_arrow</span>
                        Iniciar Partida
                    </button>
                </motion.footer>
            </div>
        </div>
    );
}
