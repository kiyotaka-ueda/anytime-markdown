/** ISO 8601文字列をUTC ISO文字列に正規化する */
export function toUTC(isoString: string): string {
  if (!isoString) return isoString;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toISOString();
}

/**
 * 日次集計で使用する実効タイムゾーンを解決する。
 * 優先度: process.env.TZ → Intl の解決結果（UTC でない場合）→ Asia/Tokyo。
 * WSL 上の Node プロセスが UTC で動作するケースで JST にフォールバックさせる目的がある。
 */
export function resolveEffectiveTimeZone(): string {
  const envTz = process.env.TZ;
  if (envTz) return envTz;
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (resolved && resolved !== 'UTC') return resolved;
  return 'Asia/Tokyo';
}

/**
 * 指定 IANA タイムゾーンの UTC からのオフセットを分単位で返す。
 * 東経は正、西経は負。DST を考慮するため `at` を受け取る。
 */
export function getTimeZoneOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(at);
  const label = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const match = /^GMT([+-])(\d{1,2}):(\d{2})$/.exec(label);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * SQLite の DATE() 修飾子（例: `+540 minutes`）を返す。
 * `timeZone` を省略した場合は `resolveEffectiveTimeZone()` の結果を使用する。
 */
export function getSqliteTzOffset(timeZone?: string, at: Date = new Date()): string {
  const tz = timeZone ?? resolveEffectiveTimeZone();
  const offsetMin = getTimeZoneOffsetMinutes(tz, at);
  const sign = offsetMin >= 0 ? '+' : '-';
  return `${sign}${Math.abs(offsetMin)} minutes`;
}
