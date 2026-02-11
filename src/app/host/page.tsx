'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import HostLobby from '@/components/host/Lobby';
import Gameboard from '@/components/host/Gameboard';
import TriviaView from '@/components/host/TriviaView';
import RankingChallenge from '@/components/host/RankingChallenge';
import CardGrid from '@/components/host/CardGrid';
import WildcardOverlay from '@/components/host/WildcardOverlay';
import RevealView from '@/components/host/RevealView';
import Leaderboard from '@/components/host/Leaderboard';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function HostPage() {
    const { emit, on, isConnected } = useSocket();
    const [gameState, setGameState] = useState<any>(null);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [serverInfo, setServerInfo] = useState<{ localIP: string; port: number; playerUrl: string } | null>(null);
    const [rankingData, setRankingData] = useState<{ question: string; items: string[] } | null>(null);
    const [rankingResult, setRankingResult] = useState<any>(null);
    const initialized = useRef(false);

    useEffect(() => {
        fetch('/api/server-info')
            .then(res => res.json())
            .then(setServerInfo)
            .catch(console.error);
    }, []);

    useEffect(() => {
        const unsubs: (() => void)[] = [];

        unsubs.push(on('game:stateSync', (state: any) => setGameState(state)));

        unsubs.push(on('ranking:show', (data: any) => {
            setRankingData(data);
            setRankingResult(null);
        }));

        unsubs.push(on('ranking:result', (data: any) => {
            setRankingResult(data);
            setTimeout(() => setRankingResult(null), 3000);
        }));

        return () => unsubs.forEach(u => u());
    }, [on]);

    const createRoom = useCallback((settings?: Record<string, unknown>) => {
        if (initialized.current) return;
        initialized.current = true;

        emit('room:create', settings || {}, (res: any) => {
            if (res.success) {
                setRoomCode(res.roomCode);
                setGameState(res.state);
            }
        });
    }, [emit]);

    useEffect(() => {
        if (isConnected && !roomCode) createRoom();
    }, [isConnected, roomCode, createRoom]);

    const startGame = useCallback(() => {
        if (!roomCode) return;
        emit('game:start', { roomCode }, (res: any) => {
            if (!res.success) alert(res.error || 'Erro ao iniciar');
        });
    }, [roomCode, emit]);

    const forceNext = useCallback(() => {
        if (!roomCode) return;
        emit('host:forceNext', { roomCode });
    }, [roomCode, emit]);

    const selectBox = useCallback((boxId: number) => {
        if (!roomCode) return;
        emit('box:select', { roomCode, boxId }, () => { });
    }, [roomCode, emit]);

    const openCard = useCallback((cardId: number) => {
        if (!roomCode) return;
        emit('card:open', { roomCode, cardId }, () => { });
    }, [roomCode, emit]);

    const submitRanking = useCallback((order: number[]) => {
        if (!roomCode) return;
        emit('ranking:submit', { roomCode, order }, (res: any) => {
            if (res) setRankingResult(res);
        });
    }, [roomCode, emit]);

    const applyWildcard = useCallback((targetTeamId: string) => {
        if (!roomCode) return;
        emit('wildcard:apply', { roomCode, targetTeamId });
    }, [roomCode, emit]);

    const skipWildcard = useCallback(() => {
        if (!roomCode) return;
        emit('wildcard:skip', { roomCode });
    }, [roomCode, emit]);

    const updateSettings = useCallback((settings: Record<string, unknown>) => {
        if (!roomCode) return;
        emit('game:settingsUpdate', { roomCode, settings });
    }, [roomCode, emit]);

    const addBots = useCallback((count: number) => {
        if (!roomCode) return;
        emit('host:addBots', { roomCode, count }, (res: any) => {
            if (!res?.success) {
                alert(res?.error || 'Nao foi possivel adicionar bots');
            }
        });
    }, [roomCode, emit]);

    const clearBots = useCallback(() => {
        if (!roomCode) return;
        emit('host:clearBots', { roomCode }, (res: any) => {
            if (!res?.success) {
                alert(res?.error || 'Nao foi possivel remover bots');
            }
        });
    }, [roomCode, emit]);

    if (!isConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/50 uppercase tracking-widest text-sm font-bold">Conectando ao servidor...</p>
                </div>
            </div>
        );
    }

    if (!gameState) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/50 uppercase tracking-widest text-sm font-bold">Criando sala...</p>
                </div>
            </div>
        );
    }

    const phase = gameState.phase;

    if (phase === 'lobby') {
        return (
            <HostLobby
                gameState={gameState}
                roomCode={roomCode!}
                serverInfo={serverInfo}
                onStartGame={startGame}
                onUpdateSettings={updateSettings}
                onAddBots={addBots}
                onClearBots={clearBots}
            />
        );
    }

    return (
        <div className="flex h-screen w-screen p-4 gap-4 overflow-hidden">
            <div className="flex-grow flex flex-col gap-4">
                {phase === 'trivia_all' && (
                    <TriviaView gameState={gameState} roomCode={roomCode!} />
                )}

                {phase === 'box_select' && (
                    <Gameboard gameState={gameState} onSelectBox={selectBox} interactive />
                )}

                {phase === 'ranking_challenge' && rankingData && !rankingResult && (
                    <RankingChallenge
                        question={rankingData.question}
                        items={rankingData.items}
                        onSubmit={submitRanking}
                        winnerName={gameState.triviaWinnerId ? gameState.players?.[gameState.triviaWinnerId]?.name : undefined}
                    />
                )}

                {phase === 'ranking_challenge' && rankingResult && (
                    <div className="flex-grow flex items-center justify-center animate-fade-in">
                        <div className="text-center">
                            <span className="material-icons text-9xl text-primary mb-4">
                                {rankingResult.correctCount >= 4 ? 'stars' : rankingResult.correctCount >= 2 ? 'thumb_up' : 'thumb_down'}
                            </span>
                            <h2 className="text-5xl font-black mb-3">
                                {rankingResult.correctCount}/4 corretas!
                            </h2>
                            <p className="text-2xl font-bold text-primary">
                                Voce ganha <span className="text-4xl">{rankingResult.chances}</span> chances de abrir cartas!
                            </p>
                        </div>
                    </div>
                )}

                {phase === 'card_open' && (
                    <CardGrid gameState={gameState} roomCode={roomCode!} onOpenCard={openCard} />
                )}

                {phase === 'duel' && (
                    <div className="flex-grow flex items-center justify-center animate-fade-in">
                        <div className="text-center max-w-2xl">
                            <span className="material-icons text-9xl text-purple-500 mb-4 animate-pulse">swords</span>
                            <h1 className="text-5xl font-black uppercase tracking-tight mb-4">DUELO!</h1>
                            <p className="text-xl text-white/50 mb-8">Pergunta especial no celular dos jogadores!</p>
                            {gameState.currentQuestion && (
                                <div className="glass-panel p-6 rounded-2xl border border-purple-500/30">
                                    <p className="text-2xl font-bold">{gameState.currentQuestion.text}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {phase === 'reveal' && (
                    <RevealView gameState={gameState} onNext={forceNext} />
                )}

                {phase === 'wildcard' && (
                    <WildcardOverlay gameState={gameState} onApply={applyWildcard} onSkip={skipWildcard} />
                )}

                {phase === 'game_over' && (
                    <div className="flex-grow flex items-center justify-center">
                        <div className="text-center animate-fade-in">
                            <span className="material-icons text-primary text-9xl mb-4">emoji_events</span>
                            <h1 className="text-6xl font-black uppercase tracking-tight mb-4">Fim de Jogo!</h1>
                            <p className="text-xl text-white/60">Confira o placar final na barra lateral</p>
                        </div>
                    </div>
                )}

                {phase !== 'box_select' && phase !== 'lobby' && (
                    <Gameboard gameState={gameState} onSelectBox={() => { }} interactive={false} mini />
                )}
            </div>

            <Leaderboard gameState={gameState} roomCode={roomCode!} onForceNext={forceNext} />
        </div>
    );
}
