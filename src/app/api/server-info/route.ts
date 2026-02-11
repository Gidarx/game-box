import { NextResponse } from 'next/server';

export async function GET() {
    // @ts-expect-error - global vars set by custom server
    const localIP = global.__localIP || 'localhost';
    // @ts-expect-error - global vars set by custom server
    const port = global.__port || 3000;

    return NextResponse.json({
        localIP,
        port,
        playerUrl: `http://${localIP}:${port}/play`,
    });
}
