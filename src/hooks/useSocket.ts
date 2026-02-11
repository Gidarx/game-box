'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

let sharedSocket: Socket | null = null;

function getSocketInstance(): Socket {
    if (!sharedSocket) {
        sharedSocket = io({
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });
    }
    return sharedSocket;
}

export function useSocket() {
    const [isConnected, setIsConnected] = useState<boolean>(() => {
        return sharedSocket?.connected ?? false;
    });

    useEffect(() => {
        const socket = getSocketInstance();

        const handleConnect = () => {
            setIsConnected(true);
            console.log('[Socket] Conectado:', socket.id);
        };

        const handleDisconnect = () => {
            setIsConnected(false);
            console.log('[Socket] Desconectado');
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
        };
    }, []);

    const emit = useCallback((event: string, data?: unknown, callback?: (res: unknown) => void) => {
        const socket = getSocketInstance();
        if (callback) socket.emit(event, data, callback);
        else socket.emit(event, data);
    }, []);

    const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
        const socket = getSocketInstance();
        socket.on(event, handler);
        return () => {
            socket.off(event, handler);
        };
    }, []);

    const off = useCallback((event: string, handler?: (...args: unknown[]) => void) => {
        const socket = getSocketInstance();
        if (handler) socket.off(event, handler);
        else socket.removeAllListeners(event);
    }, []);

    return { isConnected, emit, on, off };
}
