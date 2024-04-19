
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

```
export DISCORD_BOT_TOKEN=""
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