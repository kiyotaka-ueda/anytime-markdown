import { NextResponse } from 'next/server';

export interface NewsArticle {
    id: string;
    title: string;
    description: string;
    url: string;
    source: string;
    author: string;
    publishedAt: string;
    section: string;
}

// WSJ RSS feeds for politics/economics
const WSJ_FEEDS = [
    { url: 'https://feeds.wsj.com/wsj/xml/rss/3_7014.xml', section: 'Business' },
    { url: 'https://feeds.wsj.com/wsj/xml/rss/3_7085.xml', section: 'World' },
];

const REVALIDATE = 3600;

function extractTag(xml: string, tag: string): string {
    const match = new RegExp(
        `<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
    ).exec(xml);
    return match?.[1]?.trim() ?? '';
}

function parseItems(xml: string, fallbackSection: string): NewsArticle[] {
    const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    return itemBlocks.map((block) => {
        const pubDateRaw = extractTag(block, 'pubDate');
        const publishedAt = pubDateRaw ? new Date(pubDateRaw).toISOString() : new Date().toISOString();
        const guid = extractTag(block, 'guid');
        const link = extractTag(block, 'link');
        return {
            id: guid || link,
            title: extractTag(block, 'title'),
            description: extractTag(block, 'description'),
            url: link || guid,
            source: 'The Wall Street Journal',
            author: extractTag(block, 'author') || 'WSJ Staff',
            publishedAt,
            section: extractTag(block, 'category') || fallbackSection,
        };
    });
}

export async function GET() {
    try {
        const results = await Promise.allSettled(
            WSJ_FEEDS.map(({ url, section }) =>
                fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' },
                    next: { revalidate: REVALIDATE },
                }).then(async (res) => {
                    if (!res.ok) throw new Error(`WSJ feed ${url} returned ${res.status}`);
                    return parseItems(await res.text(), section);
                }),
            ),
        );

        const allArticles: NewsArticle[] = [];
        for (const result of results) {
            if (result.status === 'fulfilled') {
                allArticles.push(...result.value);
            }
        }

        if (allArticles.length === 0) {
            return NextResponse.json({ error: 'WSJ feeds unavailable' }, { status: 502 });
        }

        // Sort newest first, take top 3
        allArticles.sort(
            (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
        );
        const articles = allArticles
            .filter((a) => a.title && a.url)
            .slice(0, 3);

        return NextResponse.json({ articles });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        console.error(`[/api/news] ${message}`, e instanceof Error ? e.stack : e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
