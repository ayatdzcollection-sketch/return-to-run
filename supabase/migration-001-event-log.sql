-- ============================================================
-- Return-to-Run — event log mirror.
--
-- Run this ONCE in the Supabase SQL editor. It is the only manual setup step;
-- the app itself never issues DDL, and deliberately holds no privilege that
-- would let it.
--
-- WHY A MIRROR AT ALL. The athlete's phone is the primary store (IndexedDB).
-- That is fast and works offline, but iOS can evict a web app's storage, and a
-- lost phone loses the training history that every cap is computed from. The
-- mirror is the durability story, and it is also how a second device sees the
-- same log.
--
-- WHY APPEND-ONLY IS ENFORCED IN THE DATABASE. The event log is the source of
-- truth for a safety system: pain reports, forced rest days, and load history
-- all derive from it. Application code can be wrong, and RLS policies can be
-- widened by accident. A BEFORE UPDATE OR DELETE trigger that raises cannot be
-- bypassed by any client, including one holding the service role key.
-- ============================================================

-- ── Append-only guard ───────────────────────────────────────
create or replace function public.rtr_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'rtr tables are append-only; % is not permitted', tg_op;
end $$;

-- ── The event log ───────────────────────────────────────────
create table if not exists public.rtr_event (
  id          text primary key,               -- client ULID; also the dedup key
  access_code text        not null,
  type        text        not null,
  date        date        not null,           -- the athlete-local day the event is ABOUT
  at          timestamptz not null,           -- device wall clock at creation
  schema      smallint    not null default 1,
  payload     jsonb       not null default '{}'::jsonb,
  -- Monotonic per-row counter. Clients pull with `server_seq > cursor`, which
  -- is immune to the device clock skew that would make an `at`-based cursor
  -- silently skip events.
  server_seq  bigint generated always as identity,
  received_at timestamptz not null default now()
);

create index if not exists rtr_event_code_seq_idx on public.rtr_event (access_code, server_seq);
create index if not exists rtr_event_code_date_idx on public.rtr_event (access_code, date);

drop trigger if exists rtr_event_append_only on public.rtr_event;
create trigger rtr_event_append_only
  before update or delete on public.rtr_event
  for each row execute function public.rtr_block_mutation();

alter table public.rtr_event enable row level security;

-- Insert and select only. The absence of update/delete policies is the belt;
-- the trigger above is the suspenders, and it holds even for privileged roles.
drop policy if exists "rtr_event insert" on public.rtr_event;
create policy "rtr_event insert" on public.rtr_event for insert with check (true);
drop policy if exists "rtr_event select" on public.rtr_event;
create policy "rtr_event select" on public.rtr_event for select using (true);

-- ── Raw heart-rate samples (audit only) ─────────────────────
-- These never enter the fold — a pure pipeline reduces each session's samples
-- to one hr_summary event, and only that event affects state. They are kept so
-- a suspicious ceiling can be re-derived from the original signal later.
create table if not exists public.rtr_hr_sample (
  access_code  text        not null,
  session_date date        not null,
  ts           timestamptz not null,
  bpm          smallint    not null,
  cadence_spm  smallint,
  quality_flag text,
  primary key (access_code, session_date, ts)
);

drop trigger if exists rtr_hr_sample_append_only on public.rtr_hr_sample;
create trigger rtr_hr_sample_append_only
  before update or delete on public.rtr_hr_sample
  for each row execute function public.rtr_block_mutation();

alter table public.rtr_hr_sample enable row level security;

drop policy if exists "rtr_hr_sample insert" on public.rtr_hr_sample;
create policy "rtr_hr_sample insert" on public.rtr_hr_sample for insert with check (true);
drop policy if exists "rtr_hr_sample select" on public.rtr_hr_sample;
create policy "rtr_hr_sample select" on public.rtr_hr_sample for select using (true);

-- ============================================================
-- VERIFY THE GUARD IS LIVE. Run these two after the migration; both must fail
-- with 'rtr tables are append-only'. If either succeeds, the log is mutable
-- and the safety model is not what this app assumes.
--
--   insert into public.rtr_event (id, access_code, type, date, at)
--     values ('TEST', 'verify', 'note', current_date, now());
--   update public.rtr_event set type = 'tampered' where id = 'TEST';
--   delete from public.rtr_event where id = 'TEST';
--
-- The TEST row cannot be deleted afterwards — that is the point. It is inert:
-- it belongs to access code 'verify', which no device uses.
-- ============================================================
