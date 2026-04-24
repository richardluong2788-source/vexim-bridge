-- =====================================================================
-- 023_insights_posts.sql
-- Insights (blog) MVP schema for Vexim Bridge.
--
-- Design notes
-- ------------
-- * Table name is `insights_posts` (not `posts`) to avoid colliding with
--   any future generic term and to read cleanly at call sites.
-- * (slug, locale) is unique so the same logical article can exist in
--   both vi and en. Never unique on slug alone.
-- * `content_md` stores markdown/MDX source. Rendering is done in the app
--   layer via react-markdown + remark-gfm (+ rehype-sanitize).
-- * Public read is limited to rows where status='published' AND
--   published_at <= now(). Writes are gated by capabilities in the app
--   layer (see lib/auth/permissions.ts: CONTENT_* caps).
-- * RLS policies use the same `is_admin_role()`-style pattern the rest of
--   the project uses: a SECURITY DEFINER helper that reads `profiles.role`
--   without triggering the profiles RLS recursion.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Helper — admins/super_admins only (content editors for MVP).
-- Idempotent: replace if already exists.
-- ---------------------------------------------------------------------
create or replace function public.is_content_editor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'admin')
  );
$$;

grant execute on function public.is_content_editor() to authenticated, anon;

-- ---------------------------------------------------------------------
-- Main table
-- ---------------------------------------------------------------------
create table if not exists public.insights_posts (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null,
  locale                  text not null default 'vi'
                          check (locale in ('vi', 'en')),
  title                   text not null,
  excerpt                 text,
  content_md              text not null default '',
  cover_image_url         text,
  category                text not null default 'general',
  tags                    text[] not null default '{}',
  author_id               uuid references public.profiles(id) on delete set null,
  status                  text not null default 'draft'
                          check (status in ('draft', 'published', 'archived')),
  published_at            timestamptz,
  reading_time_minutes    int not null default 0,
  seo_title               text,
  seo_description         text,
  view_count              int not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (slug, locale)
);

comment on table public.insights_posts is
  'Vexim Bridge Insights — blog articles (FDA, export guides, case studies, market reports).';

create index if not exists idx_insights_posts_status_published_at
  on public.insights_posts (status, published_at desc);

create index if not exists idx_insights_posts_category
  on public.insights_posts (category);

create index if not exists idx_insights_posts_locale_status
  on public.insights_posts (locale, status);

-- Full-text search index (Vietnamese + English mix → 'simple' config is
-- safest for mixed-language content; we can upgrade to a custom config
-- later without breaking queries).
create index if not exists idx_insights_posts_fts
  on public.insights_posts
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content_md, '')));

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.insights_posts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_insights_posts_updated_at on public.insights_posts;
create trigger trg_insights_posts_updated_at
  before update on public.insights_posts
  for each row execute function public.insights_posts_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.insights_posts enable row level security;

-- Drop then recreate so this file is re-runnable.
drop policy if exists insights_posts_public_select on public.insights_posts;
drop policy if exists insights_posts_editor_select on public.insights_posts;
drop policy if exists insights_posts_editor_insert on public.insights_posts;
drop policy if exists insights_posts_editor_update on public.insights_posts;
drop policy if exists insights_posts_editor_delete on public.insights_posts;

-- Public: only published + scheduled-time-has-passed rows.
create policy insights_posts_public_select
  on public.insights_posts
  for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at is not null
    and published_at <= now()
  );

-- Editors (admin / super_admin) can see everything (including drafts).
create policy insights_posts_editor_select
  on public.insights_posts
  for select
  to authenticated
  using (public.is_content_editor());

create policy insights_posts_editor_insert
  on public.insights_posts
  for insert
  to authenticated
  with check (public.is_content_editor());

create policy insights_posts_editor_update
  on public.insights_posts
  for update
  to authenticated
  using (public.is_content_editor())
  with check (public.is_content_editor());

create policy insights_posts_editor_delete
  on public.insights_posts
  for delete
  to authenticated
  using (public.is_content_editor());

-- ---------------------------------------------------------------------
-- Seed — a single welcome draft so the /insights route isn't empty on
-- first load. Safe to re-run: ON CONFLICT DO NOTHING on (slug, locale).
-- ---------------------------------------------------------------------
insert into public.insights_posts
  (slug, locale, title, excerpt, content_md, category, tags, status, published_at, reading_time_minutes, seo_title, seo_description)
values
  (
    'chao-mung-den-voi-vexim-insights',
    'vi',
    'Chào mừng đến với Vexim Insights',
    'Nơi chúng tôi chia sẻ hướng dẫn tuân thủ FDA, quy trình tìm buyer Mỹ và các bài học thực chiến từ các deal xuất khẩu đã chốt.',
    E'## Vexim Insights là gì?\n\nVexim Insights là blog chính thức của Vexim Bridge — nơi đội ngũ phân tích, hướng dẫn và case study về:\n\n- **FDA Compliance**: Food Facility Registration, MoCRA cho mỹ phẩm, 510(k) cho thiết bị y tế.\n- **Tìm buyer Mỹ**: Quy trình outreach, xác thực buyer, đàm phán giá.\n- **Thanh toán SWIFT**: Quy trình hai bước, giảm rủi ro chargeback.\n- **Case study**: Các deal thực tế đã giúp doanh nghiệp Việt lên kệ tại Mỹ.\n\n> Mục tiêu của chúng tôi là **biến xuất khẩu sang Mỹ từ rào cản thành quy trình**.\n\nHãy đăng ký nhận bản tin để không bỏ lỡ bài viết mới.',
    'general',
    array['vexim', 'welcome'],
    'published',
    now(),
    2,
    'Vexim Insights — Hướng dẫn xuất khẩu Việt sang Mỹ',
    'Blog chính thức của Vexim Bridge về FDA, tìm buyer Mỹ, SWIFT và case study xuất khẩu.'
  ),
  (
    'welcome-to-vexim-insights',
    'en',
    'Welcome to Vexim Insights',
    'Our playbook for FDA compliance, US buyer outreach, and real export case studies from Vietnamese manufacturers.',
    E'## What is Vexim Insights?\n\nVexim Insights is the official blog of Vexim Bridge. We publish:\n\n- **FDA Compliance** guides: Food Facility Registration, MoCRA, 510(k).\n- **US buyer outreach** playbooks and negotiation tactics.\n- **SWIFT two-step verification** and FX collection patterns.\n- **Case studies** from deals we''ve actually closed.\n\n> Our goal: **turn US exports from a barrier into a repeatable process**.\n\nSubscribe to the newsletter to get new posts.',
    'general',
    array['vexim', 'welcome'],
    'published',
    now(),
    2,
    'Vexim Insights — Vietnamese exports to the US',
    'The official Vexim Bridge blog covering FDA, US buyer outreach, SWIFT and export case studies.'
  )
on conflict (slug, locale) do nothing;
