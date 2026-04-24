export interface OgpData {
    url: string;
    title: string | null;
    description: string | null;
    image: string | null;
    siteName: string | null;
    favicon: string | null;
}

export interface OembedData {
    url: string;
    provider: "twitter";
    html: string;
    authorName: string | null;
}

export interface EmbedProviders {
    fetchOgp: (url: string) => Promise<OgpData>;
    fetchOembed: (url: string) => Promise<OembedData>;
}
