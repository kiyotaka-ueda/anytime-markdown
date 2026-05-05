export function parseAnalyzeExclude(content: string): string[] {
  const result: string[] = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    result.push(line);
  }
  return result;
}
