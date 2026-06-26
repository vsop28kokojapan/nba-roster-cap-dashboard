# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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
    nba-data.json    # 取得済みデータキャッシュ
  supabase/
    schema.sql       # nba_dataテーブル定義
  .env               # 環境変数（Supabaseキー）
```

`server.mjs` / `update.mjs` 内の `path.resolve(dirname, '..')` は `src/` から親ディレクトリをプロジェクトルートとして解決する前提。

## アーキテクチャ

### データフロー

```
update.mjs
  ├─ ESPN API (roster / contracts / transactions)
  ├─ Spotrac (team cap HTML scraping)
  ├─→ data/nba-data.json
  └─→ Supabase nba_data テーブル（設定時のみ）

server.mjs
  ├─ GET /api/data  → Supabaseから読み込み（失敗時はJSONにフォールバック）
  └─ POST /api/update → update.mjsをsubprocessで実行

app.js
  └─ fetch('/api/data') ← ローカルサーバー時
     fetch('data/nba-data.json') ← GitHub Pages静的配信時
```

`isLocalServer`（`location.hostname`が127.0.0.1かlocalhost）でどちらのURLを使うか分岐している。

### フロントエンド

- フレームワーク・バンドラーなし、バニラJS ES Module
- URLパラメータ `?team=ATL` でチーム詳細ビューに切り替え（ルーターライブラリなし）
- `render()` が teams / players / trades 3タブすべてを再描画する

### Supabase統合

- `supabase.mjs` が `readNbaData()` / `writeNbaData()` を提供
- テーブルは `nba_data`（id=1の1行にJSONBでスナップショットをupsert）
- 書き込みは `SUPABASE_SERVICE_KEY`（service_role）、読み取りは `SUPABASE_ANON_KEY`
- 環境変数が未設定の場合はSupabaseをスキップしてJSONファイルで動作

### GitHub Pages配信

`deploy-pages.yml` が `public/` → `dist/`、`data/nba-data.json` → `dist/data/` にコピーして静的サイトとして配信。毎日21:17 UTCにcronで自動更新。

## データ構造（nba-data.json）

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
