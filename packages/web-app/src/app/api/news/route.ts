import { NextResponse } from 'next/server';

export interface NewsArticle {
    id: number;
    title: string;
    url: string;
    source: string;
    author: string;
    publishedAt: string;
    score: number;
    comments: number;
}

interface HNAlgoliaHit {
    objectID: string;
    story_id?: number;
    title: string;
    url?: string;
    author: string;
    created_at: string;
    points: number | null;
    num_comments: number | null;
}

interface HNAlgoliaResponse {
    hits: HNAlgoliaHit[];
}

const REVALIDATE = 3600;

function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

export async function GET() {
    try {
        const res = await fetch(
            'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=8',
            { next: { revalidate: REVALIDATE } },
        );
        if (!res.ok) {
            return NextResponse.json({ error: 'HN API unavailable' }, { status: 502 });
        }

        const data = (await res.json()) as HNAlgoliaResponse;

        const articles: NewsArticle[] = data.hits
            .filter((h) => Boolean(h.url))
            .slice(0, 3)
            .map((h) => ({
                id: h.story_id ?? Number(h.objectID),
                title: h.title,
                url: h.url!,
                source: extractDomain(h.url!),
                author: h.author,
                publishedAt: h.created_at,
                score: h.points ?? 0,
                comments: h.num_comments ?? 0,
            }));

        return NextResponse.json({ articles });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        console.error(`[/api/news] ${message}`, e instanceof Error ? e.stack : e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
