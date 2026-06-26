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
