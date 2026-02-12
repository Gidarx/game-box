'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAudio } from '@/hooks/useAudio';
import type { BGMPhase } from '@/hooks/useAudio';
import HostLobby from '@/components/host/Lobby';
import Gameboard from '@/components/host/Gameboard';
import TriviaView from '@/components/host/TriviaView';
import RankingRouter from '@/components/host/RankingRouter';
import CardGrid from '@/components/host/CardGrid';
import WildcardOverlay from '@/components/host/WildcardOverlay';
import RevealView from '@/components/host/RevealView';
import Leaderboard from '@/components/host/Leaderboard';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function HostPage() {
    const { emit, on, isConnected } = useSocket();
    const audio = useAudio();
    const [gameState, setGameState] = useState<any>(null);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [serverInfo, setServerInfo] = useState<{ localIP: string; port: number; playerUrl: string } | null>(null);
    const [rankingData, setRankingData] = useState<any>(null);
    const [rankingResult, setRankingResult] = useState<any>(null);
    const [isMuted, setIsMuted] = useState(false);
    const creatingRoomRef = useRef(false);
    const prevPhaseRef = useRef<string | null>(null);

    useEffect(() => {
        fetch('/api/server-info')
            .then(res => res.json())
            .then(setServerInfo)
            .catch(console.error);
    }, []);

    useEffect(() => {
        const unsubs: (() => void)[] = [];

        unsubs.push(on('game:stateSync', (state: any) => {
            setGameState(state);
            if (state?.phase !== 'ranking_challenge') {
                setRankingData(null);
            }
        }));

        unsubs.push(on('ranking:show', (data: any) => {
            setRankingData(data);
            setRankingResult(null);
        }));

        unsubs.push(on('ranking:result', (data: any) => {
            setRankingResult(data);
            audio.playSFX('rankingSubmit');
            setTimeout(() => setRankingResult(null), 3000);
        }));

        // SFX event listeners
        unsubs.push(on('card:opened', (data: any) => {
            if (data.type === 'key') audio.playSFX('key');
            else if (data.type === 'lost_turn') audio.playSFX('lostTurn');
            else if (data.type === 'duel') audio.playSFX('duel');
            else audio.playSFX('distractor');
        }));

        unsubs.push(on('box:reveal', () => {
            audio.playSFX('reveal');
        }));

        unsubs.push(on('wildcard:effect', () => {
            audio.playSFX('wildcard');
        }));

        unsubs.push(on('trivia:result', (data: any) => {
            if (data.winnerId) audio.playSFX('correct');
        }));

        unsubs.push(on('duel:result', () => {
            audio.playSFX('duel');
        }));

        return () => unsubs.forEach(u => u());
    }, [on, audio]);

    const createRoom = useCallback((settings?: Record<string, unknown>) => {
        if (roomCode || creatingRoomRef.current) return;
        creatingRoomRef.current = true;

        let resolved = false;
        const watchdog = setTimeout(() => {
            if (!resolved) {
                creatingRoomRef.current = false;
            }
        }, 5000);

        emit('room:create', settings || {}, (res: any) => {
            resolved = true;
            clearTimeout(watchdog);
            creatingRoomRef.current = false;

            if (res?.success) {
                setRoomCode(res.roomCode);
                setGameState(res.state);
            }
        });
    }, [emit, roomCode]);

    useEffect(() => {
        if (isConnected && !roomCode) createRoom();
    }, [isConnected, roomCode, createRoom]);

    useEffect(() => {
        if (!isConnected || roomCode) return;
        const retryInterval = setInterval(() => {
            if (!creatingRoomRef.current) {
                createRoom();
            }
        }, 6000);
        return () => clearInterval(retryInterval);
    }, [isConnected, roomCode, createRoom]);

    useEffect(() => {
        if (!isConnected || !roomCode) return;
        emit('host:rejoin', { roomCode }, (res: any) => {
            if (res?.success && res.state) {
                setGameState(res.state);
            }
        });
    }, [isConnected, roomCode, emit]);

    // BGM phase tracking + SFX on phase transitions
    useEffect(() => {
        const phase = gameState?.phase;
        if (!phase) return;
        const prev = prevPhaseRef.current;
        prevPhaseRef.current = phase;

        // SFX on phase transitions
        if (prev && prev !== phase) {
            if (phase === 'trivia_all' && prev === 'lobby') audio.playSFX('gameStart');
            if (phase === 'game_over') audio.playSFX('gameOver');
        }

        // BGM mapping
        const bgmMap: Record<string, BGMPhase> = {
            lobby: 'lobby',
            trivia_all: 'trivia',
            box_select: 'lobby',
            ranking_challenge: 'trivia',
            card_open: 'card_open',
            duel: 'duel',
            reveal: 'reveal',
            wildcard: 'wildcard',
            game_over: 'game_over',
        };
        audio.startBGM(bgmMap[phase] || 'silent');
    }, [gameState?.phase, audio]);

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

    const testKeyword = useCallback((cardId: number) => {
        if (!roomCode) return;
        emit('card:testKeyword', { roomCode, cardId }, () => { });
    }, [roomCode, emit]);

    const skipKeywordTest = useCallback((cardId: number) => {
        if (!roomCode) return;
        emit('card:skipKeywordTest', { roomCode, cardId }, () => { });
    }, [roomCode, emit]);

    const submitRanking = useCallback((order: number[]) => {
        if (!roomCode) return;
        emit('ranking:submit', { roomCode, answer: order }, (res: any) => {
            if (res) setRankingResult(res);
        });
    }, [roomCode, emit]);

    const submitTrueFalse = useCallback((answers: boolean[]) => {
        if (!roomCode) return;
        emit('ranking:submit', { roomCode, answer: answers }, (res: any) => {
            if (res) setRankingResult(res);
        });
    }, [roomCode, emit]);

    const submitEstimation = useCallback((guess: number) => {
        if (!roomCode) return;
        emit('ranking:submit', { roomCode, answer: guess }, (res: any) => {
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

    const handleToggleMute = useCallback(() => {
        const nowMuted = audio.toggleMute();
        setIsMuted(nowMuted);
    }, [audio]);

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

    const rankingChallengeData = phase === 'ranking_challenge'
        ? (rankingData || gameState?.currentRanking || null)
        : null;

    return (
        <div className="flex h-screen w-screen p-4 gap-4 overflow-hidden relative">
            {/* Mute Toggle */}
            <button
                onClick={handleToggleMute}
                className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-surface-dark/80 backdrop-blur border border-primary/20 flex items-center justify-center hover:border-primary/50 transition-all hover:scale-105 active:scale-95"
                title={isMuted ? 'Ativar som' : 'Silenciar'}
            >
                <span className="material-icons text-lg text-primary/70">
                    {isMuted ? 'volume_off' : 'volume_up'}
                </span>
            </button>

            <div className="flex-grow flex flex-col gap-4">
                {phase === 'trivia_all' && (
                    <TriviaView gameState={gameState} />
                )}

                {phase === 'box_select' && (
                    <Gameboard gameState={gameState} onSelectBox={selectBox} interactive />
                )}

                {phase === 'ranking_challenge' && rankingChallengeData && !rankingResult && (
                    <RankingRouter
                        rankingData={rankingChallengeData}
                        onSubmitOrder={submitRanking}
                        onSubmitTrueFalse={submitTrueFalse}
                        onSubmitEstimation={submitEstimation}
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
                                {rankingResult.type === 'estimation'
                                    ? `${rankingResult.accuracy || 0}% precisão!`
                                    : `${rankingResult.correctCount}/4 corretas!`
                                }
                            </h2>
                            <p className="text-2xl font-bold text-primary">
                                Voce ganha <span className="text-4xl">{rankingResult.chances}</span> chances de abrir cartas!
                            </p>
                        </div>
                    </div>
                )}

                {phase === 'card_open' && (
                    <CardGrid
                        gameState={gameState}
                        roomCode={roomCode!}
                        onOpenCard={openCard}
                        onTestKeyword={testKeyword}
                        onSkipKeywordTest={skipKeywordTest}
                    />
                )}

                {phase === 'duel' && (
                    <div className="flex-grow flex items-center justify-center animate-fade-in">
                        <div className="text-center max-w-2xl">
                            <span className="material-icons text-9xl text-purple-500 mb-4 animate-pulse">swords</span>
                            <h1 className="text-5xl font-black uppercase tracking-tight mb-4">DUELO!</h1>
                            {!gameState.duelOpponentId ? (
                                <p className="text-xl text-white/50 mb-8">
                                    Aguardando o jogador da vez escolher um oponente no celular...
                                </p>
                            ) : (
                                <p className="text-xl text-white/50 mb-8">
                                    {gameState.players?.[gameState.triviaWinnerId]?.name || 'Jogador 1'} x {gameState.players?.[gameState.duelOpponentId]?.name || 'Jogador 2'}
                                </p>
                            )}
                            {gameState.currentQuestion && gameState.duelOpponentId && (
                                <div className="glass-panel p-6 rounded-2xl border border-purple-500/30">
                                    <p className="text-2xl font-bold">{gameState.currentQuestion.text}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {phase === 'reveal' && (
                    <RevealView gameState={gameState} onContinue={forceNext} />
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

            <Leaderboard gameState={gameState} onForceNext={forceNext} />
        </div>
    );
}
