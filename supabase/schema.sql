-- NBAロスター＆キャップ情報スナップショット（常に1行）
create table if not exists nba_data (
  id         integer primary key default 1,
  updated_at timestamptz not null default now(),
  season     text,
  data       jsonb not null,
  constraint nba_data_single_row check (id = 1)
);

-- RLSを有効化してanonキーでの公開読み取りを許可
alter table nba_data enable row level security;

create policy "allow public read"
  on nba_data for select
  to anon, authenticated
  using (true);

-- サービスロールはRLSをバイパスするため書き込みポリシー不要

-- シーズン別履歴スナップショット（season = "2023-24" など）
create table if not exists nba_history (
  season     text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table nba_history enable row level security;

create policy "allow public read history"
  on nba_history for select
  to anon, authenticated
  using (true);
