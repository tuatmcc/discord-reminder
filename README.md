```
npm install
npm run dev
```

```
npm run deploy
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