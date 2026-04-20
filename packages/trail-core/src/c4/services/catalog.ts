import {
  siSupabase, siNetlify, siVercel, siCloudflare, siRender, siDigitalocean,
  siUpstash, siStripe, siGooglecloud, siSentry,
  siMongodb, siRedis, siFirebase, siPlanetscale, siTurso,
  siAuth0, siClerk,
  siGithubactions, siCircleci,
  siRailway, siFlydotio, siAppwrite,
  // Database (extended)
  siPostgresql, siMysql, siSqlite, siElasticsearch, siCockroachlabs,
  siConvex, siPocketbase,
  // Infrastructure
  siDocker, siKubernetes, siNginx, siVultr,
  // Auth (extended)
  siOkta, siKeycloak,
  // Cloud (extended)
  siExoscale,
  // Monitoring (extended)
  siDatadog, siGrafana, siNewrelic, siPrometheus, siPosthog,
  // CI/CD (extended)
  siGitlab, siJenkins, siTravisci, siBitbucket,
  // Messaging
  siApachekafka, siResend,
  // CMS
  siContentful, siStrapi, siSanity, siWordpress, siGhost,
  // CDN / Media
  siCloudinary, siFastly,
  // Search
  siAlgolia,
  // Analytics
  siMixpanel,
} from 'simple-icons';

export interface ServiceEntry {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly brandColor: string;
  readonly iconPath: string;
}

export const SERVICE_CATALOG: readonly ServiceEntry[] = [
  // Database
  { id: 'supabase',      label: 'Supabase',        category: 'Database',       brandColor: `#${siSupabase.hex}`,       iconPath: siSupabase.path },
  { id: 'postgresql',    label: 'PostgreSQL',       category: 'Database',       brandColor: `#${siPostgresql.hex}`,     iconPath: siPostgresql.path },
  { id: 'mysql',         label: 'MySQL',            category: 'Database',       brandColor: `#${siMysql.hex}`,          iconPath: siMysql.path },
  { id: 'sqlite',        label: 'SQLite',           category: 'Database',       brandColor: `#${siSqlite.hex}`,         iconPath: siSqlite.path },
  { id: 'mongodb',       label: 'MongoDB',          category: 'Database',       brandColor: `#${siMongodb.hex}`,        iconPath: siMongodb.path },
  { id: 'redis',         label: 'Redis',            category: 'Database',       brandColor: `#${siRedis.hex}`,          iconPath: siRedis.path },
  { id: 'firebase',      label: 'Firebase',         category: 'Database',       brandColor: `#${siFirebase.hex}`,       iconPath: siFirebase.path },
  { id: 'planetscale',   label: 'PlanetScale',      category: 'Database',       brandColor: `#${siPlanetscale.hex}`,    iconPath: siPlanetscale.path },
  { id: 'turso',         label: 'Turso',            category: 'Database',       brandColor: `#${siTurso.hex}`,          iconPath: siTurso.path },
  { id: 'upstash',       label: 'Upstash',          category: 'Database',       brandColor: `#${siUpstash.hex}`,        iconPath: siUpstash.path },
  { id: 'elasticsearch', label: 'Elasticsearch',    category: 'Database',       brandColor: `#${siElasticsearch.hex}`,  iconPath: siElasticsearch.path },
  { id: 'cockroachlabs', label: 'CockroachDB',      category: 'Database',       brandColor: `#${siCockroachlabs.hex}`,  iconPath: siCockroachlabs.path },
  { id: 'convex',        label: 'Convex',           category: 'Database',       brandColor: `#${siConvex.hex}`,         iconPath: siConvex.path },
  { id: 'pocketbase',    label: 'PocketBase',       category: 'Database',       brandColor: `#${siPocketbase.hex}`,     iconPath: siPocketbase.path },
  // Hosting
  { id: 'netlify',       label: 'Netlify',          category: 'Hosting',        brandColor: `#${siNetlify.hex}`,        iconPath: siNetlify.path },
  { id: 'vercel',        label: 'Vercel',           category: 'Hosting',        brandColor: `#${siVercel.hex}`,         iconPath: siVercel.path },
  { id: 'cloudflare',    label: 'Cloudflare',       category: 'Hosting',        brandColor: `#${siCloudflare.hex}`,     iconPath: siCloudflare.path },
  { id: 'render',        label: 'Render',           category: 'Hosting',        brandColor: `#${siRender.hex}`,         iconPath: siRender.path },
  { id: 'railway',       label: 'Railway',          category: 'Hosting',        brandColor: `#${siRailway.hex}`,        iconPath: siRailway.path },
  { id: 'digitalocean',  label: 'DigitalOcean',     category: 'Hosting',        brandColor: `#${siDigitalocean.hex}`,   iconPath: siDigitalocean.path },
  { id: 'flydotio',      label: 'Fly.io',           category: 'Hosting',        brandColor: `#${siFlydotio.hex}`,       iconPath: siFlydotio.path },
  { id: 'vultr',         label: 'Vultr',            category: 'Hosting',        brandColor: `#${siVultr.hex}`,          iconPath: siVultr.path },
  // Infrastructure
  { id: 'docker',        label: 'Docker',           category: 'Infrastructure', brandColor: `#${siDocker.hex}`,         iconPath: siDocker.path },
  { id: 'kubernetes',    label: 'Kubernetes',       category: 'Infrastructure', brandColor: `#${siKubernetes.hex}`,     iconPath: siKubernetes.path },
  { id: 'nginx',         label: 'Nginx',            category: 'Infrastructure', brandColor: `#${siNginx.hex}`,          iconPath: siNginx.path },
  // Auth
  { id: 'auth0',         label: 'Auth0',            category: 'Auth',           brandColor: `#${siAuth0.hex}`,          iconPath: siAuth0.path },
  { id: 'clerk',         label: 'Clerk',            category: 'Auth',           brandColor: `#${siClerk.hex}`,          iconPath: siClerk.path },
  { id: 'okta',          label: 'Okta',             category: 'Auth',           brandColor: `#${siOkta.hex}`,           iconPath: siOkta.path },
  { id: 'keycloak',      label: 'Keycloak',         category: 'Auth',           brandColor: `#${siKeycloak.hex}`,       iconPath: siKeycloak.path },
  // Cloud
  { id: 'googlecloud',   label: 'Google Cloud',     category: 'Cloud',          brandColor: `#${siGooglecloud.hex}`,    iconPath: siGooglecloud.path },
  { id: 'exoscale',      label: 'Exoscale',         category: 'Cloud',          brandColor: `#${siExoscale.hex}`,       iconPath: siExoscale.path },
  // Backend
  { id: 'appwrite',      label: 'Appwrite',         category: 'Backend',        brandColor: `#${siAppwrite.hex}`,       iconPath: siAppwrite.path },
  // Payments
  { id: 'stripe',        label: 'Stripe',           category: 'Payments',       brandColor: `#${siStripe.hex}`,         iconPath: siStripe.path },
  // Monitoring
  { id: 'sentry',        label: 'Sentry',           category: 'Monitoring',     brandColor: `#${siSentry.hex}`,         iconPath: siSentry.path },
  { id: 'datadog',       label: 'Datadog',          category: 'Monitoring',     brandColor: `#${siDatadog.hex}`,        iconPath: siDatadog.path },
  { id: 'grafana',       label: 'Grafana',          category: 'Monitoring',     brandColor: `#${siGrafana.hex}`,        iconPath: siGrafana.path },
  { id: 'newrelic',      label: 'New Relic',        category: 'Monitoring',     brandColor: `#${siNewrelic.hex}`,       iconPath: siNewrelic.path },
  { id: 'prometheus',    label: 'Prometheus',       category: 'Monitoring',     brandColor: `#${siPrometheus.hex}`,     iconPath: siPrometheus.path },
  // CI/CD
  { id: 'githubactions', label: 'GitHub Actions',   category: 'CI/CD',          brandColor: `#${siGithubactions.hex}`,  iconPath: siGithubactions.path },
  { id: 'circleci',      label: 'CircleCI',         category: 'CI/CD',          brandColor: `#${siCircleci.hex}`,       iconPath: siCircleci.path },
  { id: 'gitlab',        label: 'GitLab',           category: 'CI/CD',          brandColor: `#${siGitlab.hex}`,         iconPath: siGitlab.path },
  { id: 'jenkins',       label: 'Jenkins',          category: 'CI/CD',          brandColor: `#${siJenkins.hex}`,        iconPath: siJenkins.path },
  { id: 'travisci',      label: 'Travis CI',        category: 'CI/CD',          brandColor: `#${siTravisci.hex}`,       iconPath: siTravisci.path },
  { id: 'bitbucket',     label: 'Bitbucket',        category: 'CI/CD',          brandColor: `#${siBitbucket.hex}`,      iconPath: siBitbucket.path },
  // Messaging
  { id: 'apachekafka',   label: 'Apache Kafka',     category: 'Messaging',      brandColor: `#${siApachekafka.hex}`,    iconPath: siApachekafka.path },
  { id: 'resend',        label: 'Resend',           category: 'Messaging',      brandColor: `#${siResend.hex}`,         iconPath: siResend.path },
  // CMS
  { id: 'contentful',    label: 'Contentful',       category: 'CMS',            brandColor: `#${siContentful.hex}`,     iconPath: siContentful.path },
  { id: 'strapi',        label: 'Strapi',           category: 'CMS',            brandColor: `#${siStrapi.hex}`,         iconPath: siStrapi.path },
  { id: 'sanity',        label: 'Sanity',           category: 'CMS',            brandColor: `#${siSanity.hex}`,         iconPath: siSanity.path },
  { id: 'wordpress',     label: 'WordPress',        category: 'CMS',            brandColor: `#${siWordpress.hex}`,      iconPath: siWordpress.path },
  { id: 'ghost',         label: 'Ghost',            category: 'CMS',            brandColor: `#${siGhost.hex}`,          iconPath: siGhost.path },
  // CDN / Media
  { id: 'cloudinary',    label: 'Cloudinary',       category: 'CDN',            brandColor: `#${siCloudinary.hex}`,     iconPath: siCloudinary.path },
  { id: 'fastly',        label: 'Fastly',           category: 'CDN',            brandColor: `#${siFastly.hex}`,         iconPath: siFastly.path },
  // Search
  { id: 'algolia',       label: 'Algolia',          category: 'Search',         brandColor: `#${siAlgolia.hex}`,        iconPath: siAlgolia.path },
  // Analytics
  { id: 'posthog',       label: 'PostHog',          category: 'Analytics',      brandColor: `#${siPosthog.hex}`,        iconPath: siPosthog.path },
  { id: 'mixpanel',      label: 'Mixpanel',         category: 'Analytics',      brandColor: `#${siMixpanel.hex}`,       iconPath: siMixpanel.path },
];

export function findService(id: string): ServiceEntry | undefined {
  return SERVICE_CATALOG.find(s => s.id === id);
}

export function filterServices(query: string): readonly ServiceEntry[] {
  if (!query.trim()) return SERVICE_CATALOG;
  const q = query.toLowerCase();
  return SERVICE_CATALOG.filter(
    s => s.label.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
  );
}
