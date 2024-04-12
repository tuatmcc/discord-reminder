import type { Config } from 'drizzle-kit';

export default {
    schema: './src/schema.ts',
    out: './drizzle',
    driver: 'better-sqlite',
    dbCredentials: {
        url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/68aa0404e4d4ef6a161884ee8a68d033c8c6af21aa1bbcc6c76c08e89aff6e1e.sqlite',
    },
} satisfies Config;
