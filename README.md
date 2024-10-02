
```
npm install
npm run dev
```

```
npm run deploy
```

## 環境変数の設定

Discord の bot のトークンを設定する必要がある

### ローカル

`.dev.vars` を `discord-reminder` の直下に作成して以下の内容を記述する

```
DISCORD_PUBLIC_KEY = ""
DISCORD_BOT_TOKEN = ""
DISCORD_BOT_CHANNEL_ID = ""
BASIC_AUTH_PASSWORD=""
BASIC_AUTH_USERNAME=""
```
### cloudflare

```
wrangler secret put DISCORD_BOT_TOKEN
```

## ローカルでテーブルをつくるやつ

```
npx drizzle-kit generate:sqlite --schema=src/schema.ts
wrangler d1 migrations apply discord-reminder --local
```

## フォーマット

```
npx prettier --write "./**/*.js"
```