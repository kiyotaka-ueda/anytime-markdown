import styles from '../press.module.css';

const ITEMS = [
  'open source · MIT licensed',
  'browser-only · zero servers',
  'KaTeX · Mermaid · GFM',
  'section-level diff',
  'spec-driven workflow',
  'EN ／ JA bilingual',
];

export function Ticker() {
  return (
    <div className={styles.ticker} aria-hidden="true">
      <div className={styles.tickerTrack}>
        {[...ITEMS, ...ITEMS].map((item, idx) => (
          <span key={`${item}-${idx}`}>
            <span className={styles.tickerItem}>{item}</span>
            <span className={styles.tickerSep}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
