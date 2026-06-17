create table if not exists sails_results (
  id bigserial primary key,
  name text not null,
  answers jsonb,
  scales jsonb,
  completed_at timestamptz not null default now()
);

alter table sails_results enable row level security;

create policy "allow insert sails" on sails_results for insert with check (true);
create policy "allow select sails" on sails_results for select using (true);

create index if not exists sails_results_completed_at_idx on sails_results (completed_at desc);
