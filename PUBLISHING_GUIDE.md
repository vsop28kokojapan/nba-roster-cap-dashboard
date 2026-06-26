# NBA Dashboard v1.0 公開ガイド

推奨構成は GitHub Pages です。サイトは無料で公開でき、GitHub Actionsが毎日06:17（日本時間）ごろにNBAデータを再取得して更新します。

## 最初の1回だけ行うこと

1. GitHubで空のリポジトリを作成します（例: `nba-cap-board`）。
2. このプロジェクト一式をそのリポジトリの `main` ブランチへアップロードします。
3. リポジトリの `Settings` → `Pages` を開きます。
4. `Build and deployment` のSourceを `GitHub Actions` にします。
5. `Actions` タブで `Deploy NBA Dashboard to GitHub Pages` が成功するまで待ちます。

公開URLは通常、次の形式です。

`https://GitHubユーザー名.github.io/リポジトリ名/`

## 更新方法

- NBAデータ: 毎日06:17ごろ自動更新
- デザインや機能: ファイルを変更して `main` ブランチへ反映すると自動再公開
- 手動更新: GitHubの `Actions` → 対象ワークフロー → `Run workflow`

## 独自ドメイン

必要になったらGitHub Pagesの `Custom domain` で独自ドメインを設定できます。最初はGitHubの無料URLで十分です。

## 公開前の注意

ESPNおよびSpotrac由来のデータを一般公開するため、公開規模や利用目的に応じて各提供元の利用条件・表示要件を確認してください。本サイトの数値は情報提供目的で、契約判断の公式資料ではありません。
