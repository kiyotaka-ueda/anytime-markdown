export type EmbedVariant = "card" | "compact";

export function parseEmbedInfoString(info: string): { variant: EmbedVariant } | null {
    const parts = info.trim().split(/\s+/);
    if (parts[0] !== "embed") return null;
    const v = parts[1];
    return { variant: v === "compact" ? "compact" : "card" };
}
