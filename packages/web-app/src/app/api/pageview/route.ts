import { NextResponse } from 'next/server';

const NAMESPACE = 'anytime-markdown';
const KEY = 'press-pageview';

export async function GET() {
    try {
        const res = await fetch(`https://api.countapi.xyz/hit/${NAMESPACE}/${KEY}`, {
            cache: 'no-store',
        });
        if (!res.ok) throw new Error(`countapi error: ${res.status}`);
        const data = (await res.json()) as { value: number };
        return NextResponse.json({ value: data.value });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        console.error(`[/api/pageview] ${message}`, e instanceof Error ? e.stack : e);
        return NextResponse.json({ value: null });
    }
}
