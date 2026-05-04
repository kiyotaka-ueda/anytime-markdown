import Link from 'next/link';

import styles from '../press.module.css';

interface CtaActionsProps {
  primaryHref: string;
  secondaryHref: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export function CtaActions({
  primaryHref,
  secondaryHref,
  primaryLabel = 'Online Editor',
  secondaryLabel = 'VS Code Extension',
}: Readonly<CtaActionsProps>) {
  return (
    <div className={styles.ctaActions}>
      <Link
        href={primaryHref}
        className={`${styles.btn} ${styles.btnStamp}`}
      >
        {primaryLabel} <span className={styles.btnArrow}>→</span>
      </Link>
      <a
        className={styles.btn}
        href={secondaryHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        {secondaryLabel} <span className={styles.btnArrow}>→</span>
      </a>
    </div>
  );
}
