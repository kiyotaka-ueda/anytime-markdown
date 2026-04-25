import styles from '../press.module.css';

export function Dispatch() {
  return (
    <section className={styles.dispatch} id="dispatch">
      <header className={styles.dispatchHeader}>
        <span className={styles.dispatchNum}>№002 ／ DISPATCH</span>
        <h2 className={styles.dispatchSection}>
          なぜ「ラクダ」なのか — <em>制御ではなく、伴走へ。</em>
        </h2>
        <span className={styles.dispatchMeta}>filed 04:12 JST</span>
      </header>
      <div className={styles.columns}>
        <p>
          「馬」は整備された道を高速で駆けるが、未知や重いコンテキストに弱い。対して「ラクダ」（AIエージェント）は巨大な荷（コードベース）を背負い、砂嵐（エラー）の中でも自ら考え歩き続ける長距離ランナーだ。そしてキャラバンにおけるラクダは、隊商頭の意図を汲む同志である。
        </p>
        <h3>ハーネスのジレンマ。</h3>
        <p>
          主流のアプローチは AI を「ハーネス（手綱）」で縛る ―
          ホワイトリスト、ガードレール、ツール制限、サンドボックス。しかし
          <span className={styles.textVermilion}>
            縛るほどに自律性も判断力も失われる
          </span>
          。
        </p>
        <h3>見える化で築く、伴走。</h3>
        <p>
          Anytime は制約をかけない。行動を見える化（
          <span className={styles.textVermilion}>Trail</span>
          ）し、成果物をレビュー可能（
          <span className={styles.textVermilion}>Markdown</span>
          ）にすることで、事前事後の検証で信頼を築く ― この思想を、2
          つの拡張で具現化した。
        </p>
      </div>
    </section>
  );
}
