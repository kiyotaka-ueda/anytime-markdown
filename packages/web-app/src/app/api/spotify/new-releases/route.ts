import { type NextRequest, NextResponse } from "next/server";

import { getClientCredentialsToken } from "../../../../lib/spotify";

const ALLOWED_MARKETS = new Set([
  "JP", "US", "GB", "DE", "FR", "AU", "CA", "KR", "BR", "MX",
]);

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("market") ?? "JP";
    const market = ALLOWED_MARKETS.has(raw.toUpperCase()) ? raw.toUpperCase() : "JP";

    const token = await getClientCredentialsToken();

    const res = await fetch(
      `https://api.spotify.com/v1/browse/new-releases?market=${market}&limit=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Spotify API error" }, { status: res.status });
    }

    const data = (await res.json()) as {
      albums: {
        items: {
          id: string;
          name: string;
          uri: string;
          artists: { name: string }[];
          images: { url: string; width: number; height: number }[];
          release_date: string;
          external_urls: { spotify: string };
        }[];
      };
    };

    return NextResponse.json({ albums: data.albums.items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
