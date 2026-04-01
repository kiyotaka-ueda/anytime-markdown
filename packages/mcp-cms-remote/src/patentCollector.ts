import {
  uploadPatentFile,
  createCmsConfig,
  createS3Client,
} from '@anytime-markdown/cms-core';
import { patentConfig } from './patentConfig.js';

/** EPO OPS BiblioData から抽出した正規化済み特許データ */
interface Patent {
  readonly patent_id: string;
  readonly patent_title: string;
  readonly patent_abstract: string;
  readonly patent_date: string;
  readonly assignees: readonly string[];
  readonly inventors: readonly string[];
  readonly cpcs: readonly string[];
}

export interface PatentCollectorEnv {
  PATENT_S3_BUCKET?: string;
  EPO_CONSUMER_KEY: string;
  EPO_CONSUMER_SECRET: string;
  /** 環境変数で cronEnabled を上書き（'true'/'false'） */
  PATENT_CRON_ENABLED?: string;
  S3_DOCS_BUCKET: string;
  ANYTIME_AWS_ACCESS_KEY_ID: string;
  ANYTIME_AWS_SECRET_ACCESS_KEY: string;
  ANYTIME_AWS_REGION?: string;
}

const TSV_HEADER = 'patent_id\tdate\tassignee\tcpc\ttitle';

function computeSinceDate(today: string, lookbackDays: number): string {
  const date = new Date(today);
  date.setDate(date.getDate() - lookbackDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * CPC コードと日付範囲から EPO OPS CQL クエリを構築する。
 * CQL 構文: `cpc=G06 OR cpc=H04L AND pd>=20260301`
 */
export function buildCqlQuery(
  cpcCodes: readonly string[],
  lookbackDays: number,
  today: string,
): string {
  const sinceDate = computeSinceDate(today, lookbackDays);
  const cpcConditions = cpcCodes.map((code) => `cpc=${code}`).join(' OR ');
  return `(${cpcConditions}) AND pd>=${sinceDate}`;
}

export function formatToTsv(patents: readonly Patent[]): string {
  if (patents.length === 0) {
    return TSV_HEADER;
  }

  const rows = patents.map((p) => {
    const assignee = p.assignees[0] ?? '';
    const cpc = p.cpcs[0] ?? '';
    const title = p.patent_title.replaceAll('\t', ' ');
    return `${p.patent_id}\t${p.patent_date}\t${assignee}\t${cpc}\t${title}`;
  });

  return [TSV_HEADER, ...rows].join('\n');
}

export function formatToJsonl(patents: readonly Patent[]): string {
  if (patents.length === 0) {
    return '';
  }

  return patents
    .map((p) => {
      const entry = {
        patent_id: p.patent_id,
        title: p.patent_title,
        abstract: p.patent_abstract,
        date: p.patent_date,
        assignees: [...p.assignees],
        inventors: [...p.inventors],
        cpc: [...p.cpcs],
      };
      return JSON.stringify(entry);
    })
    .join('\n');
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** EPO OPS OAuth2 Client Credentials でアクセストークンを取得する */
async function getAccessToken(
  consumerKey: string,
  consumerSecret: string,
): Promise<string> {
  const credentials = btoa(`${consumerKey}:${consumerSecret}`);
  const response = await fetch(patentConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`EPO OAuth2 token request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/** EPO OPS XML レスポンスから特許データを抽出する */
export function parseEpoResponse(xml: string): Patent[] {
  const patents: Patent[] = [];

  // exchange-documents を分割して各特許を処理
  const docRegex = /<exchange-document[^>]*>([\s\S]*?)<\/exchange-document>/g;
  let docMatch: RegExpExecArray | null;

  while ((docMatch = docRegex.exec(xml)) !== null) {
    const doc = docMatch[0];

    // 特許ID: country + doc-number + kind
    const country = /<exchange-document[^>]*country="([^"]*)"/.exec(doc)?.[1] ?? '';
    const docNumber = /<exchange-document[^>]*doc-number="([^"]*)"/.exec(doc)?.[1] ?? '';
    const kind = /<exchange-document[^>]*kind="([^"]*)"/.exec(doc)?.[1] ?? '';
    const patent_id = `${country}${docNumber}${kind}`;

    // 公開日
    const dateStr = /<date-of-publication>(\d{8})<\/date-of-publication>/.exec(doc)?.[1] ?? '';
    const patent_date = dateStr
      ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
      : '';

    // タイトル（英語優先）
    const enTitle = /<invention-title[^>]*lang="en"[^>]*>([^<]*)<\/invention-title>/.exec(doc)?.[1] ?? '';
    const anyTitle = /<invention-title[^>]*>([^<]*)<\/invention-title>/.exec(doc)?.[1] ?? '';
    const patent_title = enTitle || anyTitle;

    // 要約（英語優先）
    const abstractRegex = /<abstract[^>]*lang="en"[^>]*>([\s\S]*?)<\/abstract>/;
    const anyAbstractRegex = /<abstract[^>]*>([\s\S]*?)<\/abstract>/;
    const abstractBlock = abstractRegex.exec(doc)?.[1] ?? anyAbstractRegex.exec(doc)?.[1] ?? '';
    const patent_abstract = abstractBlock.replaceAll(/<[^>]+>/g, '').trim();

    // 出願人
    const applicants: string[] = [];
    const appRegex = /<applicant[^>]*data-format="docdba?"[^>]*>[\s\S]*?<name>([^<]*)<\/name>[\s\S]*?<\/applicant>/g;
    let appMatch: RegExpExecArray | null;
    while ((appMatch = appRegex.exec(doc)) !== null) {
      if (appMatch[1]) applicants.push(appMatch[1].trim());
    }

    // 発明者
    const inventors: string[] = [];
    const invRegex = /<inventor[^>]*data-format="docdba?"[^>]*>[\s\S]*?<name>([^<]*)<\/name>[\s\S]*?<\/inventor>/g;
    let invMatch: RegExpExecArray | null;
    while ((invMatch = invRegex.exec(doc)) !== null) {
      if (invMatch[1]) inventors.push(invMatch[1].trim());
    }

    // CPC 分類
    const cpcs: string[] = [];
    const cpcRegex = /<patent-classification>[\s\S]*?<classification-scheme[^>]*scheme="CPC"[\s\S]*?<text>([^<]*)<\/text>[\s\S]*?<\/patent-classification>/g;
    let cpcMatch: RegExpExecArray | null;
    while ((cpcMatch = cpcRegex.exec(doc)) !== null) {
      if (cpcMatch[1]) cpcs.push(cpcMatch[1].trim());
    }

    if (patent_id && patent_title) {
      patents.push({
        patent_id,
        patent_title,
        patent_abstract,
        patent_date,
        assignees: applicants,
        inventors,
        cpcs,
      });
    }
  }

  return patents;
}

export async function collectPatents(env: PatentCollectorEnv): Promise<void> {
  // 環境変数 > コンフィグファイルの優先順位で cronEnabled を決定
  const cronEnabled = env.PATENT_CRON_ENABLED !== undefined
    ? env.PATENT_CRON_ENABLED !== 'false'
    : patentConfig.cronEnabled;

  if (!cronEnabled) {
    console.log('Patent collection is disabled');
    return;
  }

  const { baseUrl, cpcCodes, fetchCount, lookbackDays, s3Prefix: patentsPrefix } = patentConfig;
  const today = getTodayString();
  const cql = buildCqlQuery(cpcCodes, lookbackDays, today);

  // OAuth2 トークン取得
  let accessToken: string;
  try {
    accessToken = await getAccessToken(env.EPO_CONSUMER_KEY, env.EPO_CONSUMER_SECRET);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`EPO OAuth2 authentication failed: ${message}`);
    return;
  }

  // EPO OPS Published Data Search
  const searchUrl = `${baseUrl}/published-data/search/full-cycle`;
  let response: Response;
  try {
    response = await fetch(`${searchUrl}?q=${encodeURIComponent(cql)}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/exchange+xml',
        'Range': `1-${fetchCount}`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`EPO OPS API request failed: ${message}`);
    return;
  }

  if (!response.ok) {
    console.error(`EPO OPS API error: ${response.status} ${response.statusText}`);
    return;
  }

  const xml = await response.text();
  const patents = parseEpoResponse(xml);

  if (patents.length === 0) {
    console.log('No patents found for the given criteria');
    return;
  }

  console.log(`Fetched ${patents.length} patents from EPO OPS`);

  const tsv = formatToTsv(patents);
  const jsonl = formatToJsonl(patents);

  const cmsConfig = createCmsConfig({
    S3_DOCS_BUCKET: env.PATENT_S3_BUCKET ?? env.S3_DOCS_BUCKET,
    ANYTIME_AWS_ACCESS_KEY_ID: env.ANYTIME_AWS_ACCESS_KEY_ID,
    ANYTIME_AWS_SECRET_ACCESS_KEY: env.ANYTIME_AWS_SECRET_ACCESS_KEY,
    ANYTIME_AWS_REGION: env.ANYTIME_AWS_REGION,
  });
  const s3Client = createS3Client(cmsConfig);
  const patentsConfig = { bucket: cmsConfig.bucket, patentsPrefix };

  await uploadPatentFile({ fileName: `${today}.tsv`, content: tsv }, s3Client, patentsConfig);
  await uploadPatentFile({ fileName: `${today}.jsonl`, content: jsonl }, s3Client, patentsConfig);

  console.log(`Uploaded patent files for ${today}`);
}
