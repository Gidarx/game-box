'use client';

import { useEffect, useState } from 'react';
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

    const playerUrl = serverInfo
        ? `http://${serverInfo.localIP}:${serverInfo.port}/play?room=${roomCode}`
        : `http://localhost:3000/play?room=${roomCode}`;

    useEffect(() => {
        QRCode.toDataURL(playerUrl, {
            width: 320,
            margin: 1,
            color: { dark: '#050510', light: '#ffffff' },
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
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent-cyan to-primary opacity-50" />

                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/35 flex items-center justify-center shadow-[0_0_20px_rgba(112,0,255,0.3)]">
                            <span className="material-icons text-3xl text-primary">inventory_2</span>
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-2xl md:text-3xl font-display font-black uppercase leading-none tracking-wide">
                                Caixa <span className="text-primary text-glow">Misteriosa</span>
                            </h1>
                            <p className="text-sm text-white/50 mt-1 font-medium tracking-wider uppercase">Lobby Ativo &bull; {serverInfo?.localIP || 'Localhost'}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <div className="metric-pill bg-surface-dark border-white/10">
                            <span className="material-icons text-[14px] text-accent-cyan">groups</span>
                            <span className="font-bold">{connectedCount}/8</span>
                        </div>
                        <div className="metric-pill bg-surface-dark border-white/10">
                            <span className="material-icons text-[14px] text-amber-300">smart_toy</span>
                            <span className="font-bold">{botCount} Bots</span>
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
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

                        <div className="mb-6">
                            <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                Junte-se Agora
                            </span>
                            <h2 className="text-3xl font-display font-black mt-4 uppercase">Escaneie para Jogar</h2>
                            <p className="text-white/50 mt-2 text-sm max-w-xs mx-auto">Use a câmera do seu celular para entrar na sala</p>
                        </div>

                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="p-4 rounded-3xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-white/10 relative group"
                        >
                            <div className="absolute -inset-4 bg-gradient-to-tr from-primary via-accent-cyan to-primary rounded-[2.5rem] -z-10 opacity-30 blur-xl group-hover:opacity-50 transition-opacity duration-500" />
                            {qrDataUrl ? (
                                <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 md:w-64 md:h-64 object-contain rounded-xl" />
                            ) : (
                                <div className="w-56 h-56 md:w-64 md:h-64 grid place-items-center">
                                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </motion.div>

                        <div className="mt-8 flex flex-col items-center gap-2 w-full max-w-xs">
                            <div className="w-full flex items-center gap-2 bg-surface-dark/50 border border-white/10 rounded-xl p-1 pr-3">
                                <div className="bg-white/5 px-3 py-2 rounded-lg">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-white/40">URL</span>
                                </div>
                                <code className="flex-1 text-xs text-accent-cyan font-mono truncate">{playerUrl}</code>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Código</span>
                                <span className="text-4xl font-mono font-black text-white tracking-widest text-glow">{roomCode}</span>
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
                                <h3 className={cn("text-2xl font-black uppercase tracking-wide flex items-center gap-3", canStart ? "text-accent-lime" : "text-white/60")}>
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
                                <p className="text-sm text-white/40 font-bold uppercase tracking-wider mt-1 ml-9">
                                    {canStart ? 'O host já pode começar o jogo' : `Mínimo de 3 jogadores (Faltam ${missingPlayers})`}
                                </p>
                            </div>
                        </div>

                        {/* Roster */}
                        <div className="glass-panel rounded-2xl p-6 flex-1 min-h-0 overflow-hidden flex flex-col bg-surface-dark/30">
                            <h3 className="text-sm font-black uppercase tracking-[0.15em] text-white/40 mb-6 flex items-center gap-2">
                                <span className="material-icons text-base">list</span>
                                Competidores Confirmados
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
                                            className="bg-surface-dark border border-white/5 p-4 rounded-xl flex items-center justify-between group hover:border-primary/30 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black border",
                                                    player.isBot
                                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                                        : "bg-primary/10 border-primary/30 text-primary"
                                                )}>
                                                    {player.name?.[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-lg leading-tight">{player.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {player.isBot && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 rounded uppercase font-bold tracking-wider">Bot</span>}
                                                        <span className="text-xs text-white/30 font-medium uppercase tracking-wide">{player.device || 'Unknown'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-white/10 font-mono font-black text-2xl group-hover:text-white/20 transition-colors">#{i + 1}</span>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {Array.from({ length: Math.max(0, 8 - connectedCount) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="border-2 border-dashed border-white/5 rounded-xl p-4 flex items-center justify-center gap-3 text-white/20">
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
                    className="glass-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-6"
                >
                    <div className="flex flex-wrap items-center gap-6">
                        {/* Mode */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">Modo de Jogo</label>
                            <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                                {['solo', 'equipes'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => onUpdateSettings({ mode })}
                                        className={cn(
                                            "px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                                            gameState.mode === mode
                                                ? "bg-primary text-white shadow-lg"
                                                : "text-white/40 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Boxes */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">Quantidade de Caixas</label>
                            <div className="flex items-center gap-3 bg-black/20 p-1 rounded-xl border border-white/5 px-2">
                                <button onClick={() => onUpdateSettings({ boxCount: Math.max(5, (gameState.boxCount || 13) - 1) })} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
                                    <span className="material-icons text-sm">remove</span>
                                </button>
                                <span className="font-mono font-black text-lg w-6 text-center">{gameState.boxCount || 13}</span>
                                <button onClick={() => onUpdateSettings({ boxCount: Math.min(13, (gameState.boxCount || 13) + 1) })} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
                                    <span className="material-icons text-sm">add</span>
                                </button>
                            </div>
                        </div>

                        {/* Bots */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">Simular Jogadores</label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => onAddBots(1)} className="btn-secondary py-2 px-4 text-xs h-10">+1 Bot</button>
                                <button onClick={onClearBots} disabled={botCount === 0} className="btn-danger py-2 px-4 text-xs h-10">Remover</button>
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
