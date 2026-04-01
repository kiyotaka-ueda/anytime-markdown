import {
  uploadPatentFile,
  createCmsConfig,
  createS3Client,
} from '@anytime-markdown/cms-core';

interface PatentAssignee {
  readonly assignee_organization: string;
}

interface PatentInventor {
  readonly inventor_name_first: string;
  readonly inventor_name_last: string;
}

interface PatentCpc {
  readonly cpc_group_id: string;
}

interface Patent {
  readonly patent_id: string;
  readonly patent_title: string;
  readonly patent_abstract: string;
  readonly patent_date: string;
  readonly assignees: readonly PatentAssignee[];
  readonly inventors: readonly PatentInventor[];
  readonly cpcs: readonly PatentCpc[];
}

export interface PatentCollectorEnv {
  PATENT_S3_BUCKET?: string;
  PATENT_S3_PREFIX?: string;
  PATENTSVIEW_API_KEY: string;
  PATENTSVIEW_BASE_URL?: string;
  PATENT_CPC_CODES?: string;
  PATENT_FETCH_COUNT?: string;
  PATENT_LOOKBACK_DAYS?: string;
  PATENT_CRON_ENABLED?: string;
  S3_DOCS_BUCKET: string;
  ANYTIME_AWS_ACCESS_KEY_ID: string;
  ANYTIME_AWS_SECRET_ACCESS_KEY: string;
  ANYTIME_AWS_REGION?: string;
}

interface PatentQuery {
  readonly q: object;
  readonly f: readonly string[];
  readonly s: readonly object[];
  readonly o: object;
}

const TSV_HEADER = 'patent_id\tdate\tassignee\tcpc\ttitle';

const FIELDS = [
  'patent_id',
  'patent_title',
  'patent_abstract',
  'patent_date',
  'assignees.assignee_organization',
  'inventors.inventor_name_first',
  'inventors.inventor_name_last',
  'cpcs.cpc_group_id',
] as const;

function computeSinceDate(today: string, lookbackDays: number): string {
  const date = new Date(today);
  date.setDate(date.getDate() - lookbackDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildPatentQuery(
  cpcCodes: readonly string[],
  lookbackDays: number,
  today: string,
  fetchCount: number = 20,
): PatentQuery {
  const sinceDate = computeSinceDate(today, lookbackDays);

  return {
    q: {
      _and: [
        { _or: cpcCodes.map((code) => ({ _text_any: { cpc_group_id: code } })) },
        { _gte: { patent_date: sinceDate } },
      ],
    },
    f: [...FIELDS],
    s: [{ patent_date: 'desc' }],
    o: { size: fetchCount },
  };
}

export function formatToTsv(patents: readonly Patent[]): string {
  if (patents.length === 0) {
    return TSV_HEADER;
  }

  const rows = patents.map((p) => {
    const assignee = p.assignees[0]?.assignee_organization ?? '';
    const cpc = p.cpcs[0]?.cpc_group_id ?? '';
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
        assignees: p.assignees.map((a) => a.assignee_organization),
        inventors: p.inventors.map(
          (inv) => `${inv.inventor_name_first} ${inv.inventor_name_last}`,
        ),
        cpc: p.cpcs.map((c) => c.cpc_group_id),
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

export async function collectPatents(env: PatentCollectorEnv): Promise<void> {
  if (env.PATENT_CRON_ENABLED === 'false') {
    console.log('Patent collection is disabled (PATENT_CRON_ENABLED=false)');
    return;
  }

  const baseUrl = env.PATENTSVIEW_BASE_URL ?? 'https://search.patentsview.org/api/v1';
  const cpcCodes = (env.PATENT_CPC_CODES ?? 'G06,H04L').split(',');
  const fetchCount = Number.parseInt(env.PATENT_FETCH_COUNT ?? '20', 10);
  const lookbackDays = Number.parseInt(env.PATENT_LOOKBACK_DAYS ?? '30', 10);
  const patentsPrefix = env.PATENT_S3_PREFIX ?? 'patents/';
  const today = getTodayString();

  const query = buildPatentQuery(cpcCodes, lookbackDays, today, fetchCount);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/patent/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': env.PATENTSVIEW_API_KEY,
      },
      body: JSON.stringify(query),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`PatentsView API request failed: ${message}`);
    return;
  }

  if (!response.ok) {
    console.error(`PatentsView API error: ${response.status} ${response.statusText}`);
    return;
  }

  const data = (await response.json()) as { patents?: Patent[] };
  const patents = data.patents ?? [];

  if (patents.length === 0) {
    console.log('No patents found for the given criteria');
    return;
  }

  console.log(`Fetched ${patents.length} patents`);

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
