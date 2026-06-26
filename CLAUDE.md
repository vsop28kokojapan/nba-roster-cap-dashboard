# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 実行コマンド

```bash
# データ取得（ESPN + Spotrac → data/nba-data.json + Supabase）
node --env-file=.env update.mjs

# サーバー起動（http://127.0.0.1:4173）
node --env-file=.env server.mjs
```

`start.cmd` / `start.ps1` はこの2コマンドを順に実行するスクリプト。package.jsonのscriptsは `src/` サブディレクトリ前提のため、現在のルート配置では直接 `node` で実行する。

## ファイル構成（意図された配置）

```
nba-roster-cap-dashboard/
  src/
    server.mjs       # HTTPサーバー（Node標準モジュールのみ）
    update.mjs       # データ取得パイプライン
    supabase.mjs     # Supabaseクライアント（読み書き両用）
  public/
    index.html       # SPA本体
    app.js           # フロントエンドロジック（フレームワークなし）
    *.css
  data/
    nba-data.json    # 取得済みデータキャッシュ（ローカル用）
  supabase/
    schema.sql       # nba_dataテーブル定義
  .env               # 環境変数（Supabaseキー）
```

`server.mjs` / `update.mjs` 内の `path.resolve(dirname, '..')` は `src/` から親ディレクトリをプロジェクトルートとして解決する前提。ファイルを編集する前に実配置を `ls` で確認すること。

## アーキテクチャ・設計方針

### 公開プラットフォーム

**Vercel** で公開。GitHub Pages配信は廃止予定。

### データフロー（目標アーキテクチャ）

```
[GitHub Actions / Vercel Cron / 手動]
  └─ update.mjs
       ├─ ESPN API (roster / contracts / transactions)
       ├─ Spotrac (team cap HTML scraping)
       └─→ Supabase nba_data テーブルへupsert（最新スナップショット）

[ローカル開発]
  server.mjs
    ├─ GET /api/data  → Supabaseから読み込み（失敗時はJSONにフォールバック）
    └─ POST /api/update → update.mjsをsubprocessで実行

[Vercel公開HP]
  app.js
    ├─ Supabase REST APIを直接fetch（anon key使用）
    ├─ 30秒ごとにupdatedAtを確認 → 変更あれば再取得・再描画
    └─ Supabase失敗時は data/nba-data.json にフォールバック
```

閲覧者のページロードでESPN・Spotracへ直接アクセスする設計は行わない。  
SpotracはCORSブロック・HTML scraping・レイアウト変更リスクがあるため、サーバー側でのみ処理する。

### Supabaseの位置付け

恒久的なマスタDBではなく、**Vercel公開サイト向けの latest cache / snapshot store**。

**保存してよいもの:**
- 最新表示に必要な完成済みJSONスナップショット（`nba-data.json` 相当）
- Spotrac由来のキャップ情報（totalCap, deadCap, activeCap等）
- `updatedAt`、比較用前回値、差分検出用ハッシュ
- 日次推移・変更検知機能を作る場合のみ、必要最小限の履歴スナップショット

**保存しないもの:**
- ESPNから毎回取得できる選手プロフィールやロスター生情報の大量履歴保存

### セキュリティルール

- **anon key**: RLSでselectのみ許可済み。フロントエンドへの記載OK
- **service_role key**: 絶対にフロントエンドへ出さない。Node側・CI・Cronのみ

### フロントエンド

- フレームワーク・バンドラーなし、バニラJS。この構成を維持する
- `isLocalServer`（127.0.0.1 or localhost）でローカル/Vercel分岐
- URLパラメータ `?team=ATL` でチーム詳細ビューに切り替え
- `render()` が teams / players / trades 3タブすべてを再描画

### Supabase統合（Node側）

- `supabase.mjs` が `readNbaData()` / `writeNbaData()` を提供
- テーブルは `nba_data`（id=1固定の1行にJSONBでupsert）
- 書き込みは `SUPABASE_SERVICE_KEY`（service_role）
- 読み取りは `SUPABASE_ANON_KEY`（またはservice_key）

## データ構造（nba-data.json / Supabaseスナップショット）

```js
{
  meta: { updatedAt, season, sources, notes, warning },
  thresholds: { salaryCap, luxuryTax, firstApron, secondApron },
  teams: [{ id, abbreviation, name, logo, color, playerCount,
            rosterSalary, totalCap, activeCap, deadCap, capSpace,
            apronStatus, capSource }],
  players: [{ id, team, name, jersey, position, status, age,
              salary, yearsRemaining, tradeRestricted, headshot, profile }],
  transactions: [{ id, date, team, teamName, description,
                   descriptionJa, type }]
}
```

`capSource: 'Spotrac'` のチームはSpotracからの正確な配賦額、`'ESPNロスター合計（概算）'` はESPNロスターのサラリー単純合計。

## Spotracスクレイピング

`extractSpotrac()` はHTMLから `id="cap_total"` テーブルを探してパース。Spotracのレイアウト変更時はここを調整する。チーム略称の正規化テーブル（`aliases`）も同関数内にある。
