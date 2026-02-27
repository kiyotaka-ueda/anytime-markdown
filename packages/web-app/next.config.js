const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@anytime-markdown/editor-core'],
  ...(isCapacitorBuild && {
    output: 'export',
    trailingSlash: true,
  }),
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    });
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, '../editor-core/src'),
    };
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
