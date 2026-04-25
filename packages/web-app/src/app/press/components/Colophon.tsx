import { useTranslations } from 'next-intl';
import Link from 'next/link';

import styles from '../press.module.css';

const MARKETPLACE_URL =
  'https://marketplace.visualstudio.com/items?itemName=anytime-trial.anytime-markdown';
const GITHUB_REPO_URL = 'https://github.com/anytime-trial/anytime-markdown';
const GITHUB_LICENSE_URL =
  'https://github.com/anytime-trial/anytime-markdown/blob/master/LICENSE';

export function Colophon() {
  const t = useTranslations('press.colophon');
  return (
    <footer>
      <section className={styles.colophon} id="archive">
        <div>
          <h4>{t('press')}</h4>
          <ul>
            <li>
              <Link href="/privacy">{t('privacyPolicy')}</Link>
            </li>
            <li>
              <a
                href={GITHUB_LICENSE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('license')}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4>{t('dispatch')}</h4>
          <ul>
            <li>
              <Link href="/markdown">{t('onlineEditor')}</Link>
            </li>
            <li>
              <a
                href={MARKETPLACE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('vsCodeMarkdown')}
              </a>
            </li>
            <li>
              <Link href="/trail">{t('trailArchitecture')}</Link>
            </li>
            <li>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('github')}
              </a>
            </li>
          </ul>
        </div>
      </section>
      <div className={styles.fold}>
        <span>{t('foldCopy')}</span>
        <span className={styles.foldStamp}>{t('foldStamp')}</span>
        <span>{t('foldSet')}</span>
      </div>
    </footer>
  );
}
