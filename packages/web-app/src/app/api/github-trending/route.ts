import { NextResponse } from 'next/server';

export interface TrendingRepo {
    id: number;
    fullName: string;
    description: string | null;
    url: string;
    stars: number;
    language: string | null;
    owner: string;
    name: string;
}

const REVALIDATE_SECONDS = 3600;

function yesterdayIso(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

export const revalidate = REVALIDATE_SECONDS;

export async function GET() {
    try {
        const since = yesterdayIso();
        const url = `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=6`;

        const headers: HeadersInit = {
            Accept: 'application/vnd.github.v3+json',
        };
        if (process.env.DOCS_GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${process.env.DOCS_GITHUB_TOKEN}`;
        }

        const res = await fetch(url, {
            headers,
            next: { revalidate: REVALIDATE_SECONDS },
        });

        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

        const data = (await res.json()) as { items: Record<string, unknown>[] };

        const repos: TrendingRepo[] = data.items.map((r) => ({
            id: r.id as number,
            fullName: r.full_name as string,
            description: (r.description as string | null) ?? null,
            url: r.html_url as string,
            stars: r.stargazers_count as number,
            language: (r.language as string | null) ?? null,
            owner: (r.owner as Record<string, string>).login,
            name: r.name as string,
        }));

        return NextResponse.json({ repos, since });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        console.error(`[/api/github-trending] ${message}`, e instanceof Error ? e.stack : e);
        return NextResponse.json({ repos: [], since: '' });
    }
}
