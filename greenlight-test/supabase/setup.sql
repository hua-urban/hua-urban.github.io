-- 追綠光：資料庫一次設定（貼到 Supabase ▸ SQL Editor 執行）
-- 最後一段的密碼請先改掉再執行。

-- BNI「追綠光」填答後台
-- 網站只能呼叫 bni_gl_submit 存答案；看資料要用後台密碼呼叫 bni_gl_list。

create table if not exists public.bni_gl_submissions (
  client_id   text primary key,              -- 每支手機一個，重送會更新同一筆
  member_no   text not null,
  member_name text not null,
  count_121   int  not null default 0,
  count_ref   int  not null default 0,
  rows_121    jsonb not null default '[]',
  rows_ref    jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.bni_gl_submissions enable row level security;
revoke all on public.bni_gl_submissions from anon, authenticated;

create table if not exists public.bni_gl_admin (
  id        int primary key default 1 check (id = 1),
  pass_hash text not null
);
alter table public.bni_gl_admin enable row level security;
revoke all on public.bni_gl_admin from anon, authenticated;

create or replace function public.bni_gl_submit(
  p_client_id text, p_member_no text, p_member_name text, p_rows_121 jsonb, p_rows_ref jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(length(p_client_id), 0) not between 8 and 64
     or p_member_no !~ '^\d{3}$'
     or coalesce(length(p_member_name), 0) not between 1 and 60
     or jsonb_typeof(p_rows_121) <> 'array' or jsonb_typeof(p_rows_ref) <> 'array'
     or jsonb_array_length(p_rows_121) > 500 or jsonb_array_length(p_rows_ref) > 500
     or octet_length(p_rows_121::text) + octet_length(p_rows_ref::text) > 300000 then
    raise exception 'invalid submission';
  end if;
  insert into bni_gl_submissions (client_id, member_no, member_name, count_121, count_ref, rows_121, rows_ref)
  values (p_client_id, p_member_no, p_member_name,
          jsonb_array_length(p_rows_121), jsonb_array_length(p_rows_ref), p_rows_121, p_rows_ref)
  on conflict (client_id) do update set
    member_no = excluded.member_no, member_name = excluded.member_name,
    count_121 = excluded.count_121, count_ref = excluded.count_ref,
    rows_121 = excluded.rows_121, rows_ref = excluded.rows_ref, updated_at = now();
end $$;

create or replace function public.bni_gl_list(p_pass text)
returns setof public.bni_gl_submissions
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not exists (select 1 from bni_gl_admin where pass_hash = crypt(coalesce(p_pass, ''), pass_hash)) then
    perform pg_sleep(1);
    raise exception 'wrong password';
  end if;
  return query select * from bni_gl_submissions order by updated_at desc;
end $$;

revoke all on function public.bni_gl_submit(text, text, text, jsonb, jsonb) from public;
revoke all on function public.bni_gl_list(text) from public;
grant execute on function public.bni_gl_submit(text, text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.bni_gl_list(text) to anon, authenticated;


-- BNI「追綠光」：名單與活動設定（後台編輯、問卷網站讀取）
-- 貼到 Supabase ▸ SQL Editor 執行一次即可；重複執行也沒關係。

create table if not exists public.bni_gl_config (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.bni_gl_config enable row level security;
revoke all on public.bni_gl_config from anon, authenticated;

-- 問卷網站讀取（任何人都能讀：名單和活動本來就會顯示在問卷上）
create or replace function public.bni_gl_get_config()
returns jsonb
language sql security definer set search_path = public
as $$ select data from bni_gl_config where id = 1 $$;

-- 後台存檔（要後台密碼）
create or replace function public.bni_gl_save_config(p_pass text, p_data jsonb)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not exists (select 1 from bni_gl_admin where pass_hash = crypt(coalesce(p_pass, ''), pass_hash)) then
    perform pg_sleep(1);
    raise exception 'wrong password';
  end if;
  if jsonb_typeof(p_data) <> 'object'
     or jsonb_typeof(p_data -> 'members') <> 'array'
     or jsonb_typeof(p_data -> 'events') <> 'array'
     or octet_length(p_data::text) > 500000 then
    raise exception 'invalid config';
  end if;
  insert into bni_gl_config (id, data, updated_at) values (1, p_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = now();
end $$;

revoke all on function public.bni_gl_get_config() from public;
revoke all on function public.bni_gl_save_config(text, jsonb) from public;
grant execute on function public.bni_gl_get_config() to anon, authenticated;
grant execute on function public.bni_gl_save_config(text, jsonb) to anon, authenticated;


-- BNI「追綠光」：後台刪除填答紀錄（要後台密碼）
-- 貼到 Supabase ▸ SQL Editor 執行一次即可；重複執行也沒關係。

create or replace function public.bni_gl_delete(p_pass text, p_client_ids text[])
returns int
language plpgsql security definer set search_path = public, extensions
as $$
declare n int;
begin
  if not exists (select 1 from bni_gl_admin where pass_hash = crypt(coalesce(p_pass, ''), pass_hash)) then
    perform pg_sleep(1);
    raise exception 'wrong password';
  end if;
  if p_client_ids is null or array_length(p_client_ids, 1) is null or array_length(p_client_ids, 1) > 500 then
    raise exception 'nothing to delete';
  end if;
  delete from bni_gl_submissions where client_id = any(p_client_ids);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.bni_gl_delete(text, text[]) from public;
grant execute on function public.bni_gl_delete(text, text[]) to anon, authenticated;


-- ── 後台密碼：把「請改成你的後台密碼」換掉再執行 ──
insert into public.bni_gl_admin (id, pass_hash)
values (1, extensions.crypt('請改成你的後台密碼', extensions.gen_salt('bf')))
on conflict (id) do update set pass_hash = excluded.pass_hash;
