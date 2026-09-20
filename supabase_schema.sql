-- ==============================================================================
-- PathPulse AI - Production-Grade Supabase PostgreSQL Database Schema
-- Run this script directly in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Enable Required Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Clean Slate (Safe for re-running in SQL Editor)
drop trigger if exists trigger_log_report_status_change on public.reports;
drop trigger if exists set_reports_updated_at on public.reports;
drop trigger if exists set_profiles_updated_at on public.profiles;
drop trigger if exists enforce_role_protection on public.profiles;
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.notifications cascade;
drop table if exists public.report_updates cascade;
drop table if exists public.reports cascade;
drop table if exists public.profiles cascade;

-- ==============================================================================
-- TABLE 1: profiles
-- ==============================================================================
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  avatar_url text default 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- TABLE 2: reports
-- ==============================================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete set null,
  title text not null,
  description text default '',
  category text not null check (
    category in (
      'pothole',
      'broken_footpath',
      'open_manhole',
      'waterlogging',
      'garbage',
      'blocked_footpath',
      'damaged_ramp',
      'fallen_object',
      'other'
    )
  ),
  severity text not null check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  risk_score integer not null default 50 check (risk_score between 0 and 100),
  latitude double precision not null,
  longitude double precision not null,
  address text not null default '',
  image_url text,
  ai_detected boolean not null default false,
  ai_confidence numeric(5, 2) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 100)),
  status text not null default 'reported' check (
    status in (
      'reported',
      'under_review',
      'verified',
      'assigned',
      'in_progress',
      'resolved',
      'rejected'
    )
  ),
  admin_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- TABLE 3: report_updates (Audit log for every status change)
-- ==============================================================================
create table public.report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  updated_by uuid references public.profiles(user_id) on delete set null,
  old_status text check (
    old_status is null or old_status in (
      'reported',
      'under_review',
      'verified',
      'assigned',
      'in_progress',
      'resolved',
      'rejected'
    )
  ),
  new_status text not null check (
    new_status in (
      'reported',
      'under_review',
      'verified',
      'assigned',
      'in_progress',
      'resolved',
      'rejected'
    )
  ),
  note text default '',
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- TABLE 4: notifications
-- ==============================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- PERFORMANCE & FILTERING INDEXES
-- ==============================================================================
create index idx_profiles_user_id on public.profiles(user_id);
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_email on public.profiles(email);

create index idx_reports_user_id on public.reports(user_id);
create index idx_reports_status on public.reports(status);
create index idx_reports_category on public.reports(category);
create index idx_reports_severity on public.reports(severity);
create index idx_reports_created_at on public.reports(created_at desc);
create index idx_reports_coordinates on public.reports(latitude, longitude);

create index idx_report_updates_report_id on public.report_updates(report_id);
create index idx_report_updates_updated_by on public.report_updates(updated_by);
create index idx_report_updates_created_at on public.report_updates(created_at desc);

create index idx_notifications_user_id on public.notifications(user_id);
create index idx_notifications_is_read on public.notifications(is_read);
create index idx_notifications_created_at on public.notifications(created_at desc);
create index idx_notifications_user_unread on public.notifications(user_id, is_read);

-- ==============================================================================
-- AUTOMATIC updated_at TIMESTAMP HANDLER
-- ==============================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

create trigger set_reports_updated_at
  before update on public.reports
  for each row
  execute function public.handle_updated_at();

-- ==============================================================================
-- REGISTRATION & ROLE SECURITY TRIGGERS
-- Ensures users CANNOT choose or escalate to 'admin' during signup or profile updates
-- ==============================================================================

-- 1. Automatically create profile when a new user signs up in auth.users
-- Explicitly forces role := 'user' regardless of metadata sent from client
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    user_id,
    full_name,
    email,
    phone,
    role,
    avatar_url
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
    'user', -- FORCED DEFAULT: Users cannot choose admin during registration
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 2. Prevent non-admin users from escalating their role to 'admin'
create or replace function public.prevent_role_escalation()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    if not (
      coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
      or exists (
        select 1 from public.profiles
        where profiles.user_id = auth.uid() and profiles.role = 'admin'
      )
    ) then
      new.role := old.role; -- Silently reject unauthorized role privilege escalation
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger enforce_role_protection
  before update on public.profiles
  for each row
  execute function public.prevent_role_escalation();

-- ==============================================================================
-- AUTOMATIC STATUS CHANGE TRACKING & NOTIFICATIONS
-- Automatically records status changes into report_updates and notifies reporter
-- ==============================================================================
create or replace function public.log_report_status_change()
returns trigger as $$
begin
  -- Only trigger if status has changed
  if (old.status is distinct from new.status) then
    -- 1. Insert status audit log into report_updates
    insert into public.report_updates (
      report_id,
      updated_by,
      old_status,
      new_status,
      note,
      created_at
    )
    values (
      new.id,
      coalesce(auth.uid(), new.user_id),
      old.status,
      new.status,
      coalesce(nullif(new.admin_note, ''), 'Status updated from ' || old.status || ' to ' || new.status),
      now()
    );

    -- 2. Send real-time notification to the report author (if assigned)
    if (new.user_id is not null) then
      insert into public.notifications (
        user_id,
        report_id,
        message,
        is_read,
        created_at
      )
      values (
        new.user_id,
        new.id,
        'Report update: "' || new.title || '" status changed to ' || replace(new.status, '_', ' ') || '.',
        false,
        now()
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trigger_log_report_status_change
  after update on public.reports
  for each row
  execute function public.log_report_status_change();

-- ==============================================================================
-- SECURE ADMIN VERIFICATION FUNCTION
-- Evaluates admin role directly from public.profiles using the cryptographically verified auth.uid().
-- SECURITY DEFINER bypasses RLS on profiles to avoid recursive loops.
-- STABLE allows Postgres to cache the result per statement for high performance.
-- ==============================================================================
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  user_role text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select role into user_role
  from public.profiles
  where user_id = auth.uid();

  return coalesce(user_role = 'admin', false);
end;
$$;

-- Enforce report field restrictions via trigger (prevents non-admins from changing status or admin_note)
create or replace function public.protect_report_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.status is distinct from old.status then
      raise exception 'Unauthorized: Only administrators can update the report status.';
    end if;
    if new.admin_note is distinct from old.admin_note then
      raise exception 'Unauthorized: Only administrators can modify admin notes.';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'Unauthorized: Report ownership cannot be transferred.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_report_admin_fields on public.reports;
create trigger enforce_report_admin_fields
  before update on public.reports
  for each row
  execute function public.protect_report_admin_fields();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_updates enable row level security;
alter table public.notifications enable row level security;

-- Drop prior policies if existing
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users or admins can update profiles" on public.profiles;
drop policy if exists "profiles_select_policy" on public.profiles;
drop policy if exists "profiles_insert_policy" on public.profiles;
drop policy if exists "profiles_update_user_policy" on public.profiles;
drop policy if exists "profiles_update_admin_policy" on public.profiles;
drop policy if exists "profiles_delete_admin_policy" on public.profiles;

drop policy if exists "Reports are viewable by everyone" on public.reports;
drop policy if exists "Authenticated and guest users can create reports" on public.reports;
drop policy if exists "Reporters or admins can update reports" on public.reports;
drop policy if exists "Only admins can delete reports" on public.reports;
drop policy if exists "reports_select_policy" on public.reports;
drop policy if exists "reports_insert_policy" on public.reports;
drop policy if exists "reports_update_user_policy" on public.reports;
drop policy if exists "reports_update_admin_policy" on public.reports;
drop policy if exists "reports_delete_user_policy" on public.reports;
drop policy if exists "reports_delete_admin_policy" on public.reports;

drop policy if exists "Report updates are viewable by everyone" on public.report_updates;
drop policy if exists "Authenticated users or admins can insert report updates" on public.report_updates;
drop policy if exists "report_updates_select_policy" on public.report_updates;
drop policy if exists "report_updates_insert_policy" on public.report_updates;
drop policy if exists "report_updates_update_admin_policy" on public.report_updates;
drop policy if exists "report_updates_delete_admin_policy" on public.report_updates;

drop policy if exists "Users can view their own notifications" on public.notifications;
drop policy if exists "Users can update their own notifications" on public.notifications;
drop policy if exists "Service or authenticated users can insert notifications" on public.notifications;
drop policy if exists "notifications_select_policy" on public.notifications;
drop policy if exists "notifications_update_policy" on public.notifications;
drop policy if exists "notifications_insert_policy" on public.notifications;
drop policy if exists "notifications_delete_policy" on public.notifications;

-- 1. Profiles Policies
create policy "profiles_select_policy"
  on public.profiles for select
  using (auth.uid() = user_id or public.is_admin());

create policy "profiles_insert_policy"
  on public.profiles for insert
  with check ((auth.uid() = user_id and role = 'user') or public.is_admin());

create policy "profiles_update_user_policy"
  on public.profiles for update
  using (auth.uid() = user_id and not public.is_admin())
  with check (auth.uid() = user_id and role = 'user');

create policy "profiles_update_admin_policy"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles_delete_admin_policy"
  on public.profiles for delete
  using (public.is_admin());

-- 2. Reports Policies
create policy "reports_select_policy"
  on public.reports for select
  using (true);

create policy "reports_insert_policy"
  on public.reports for insert
  with check (
    (
      auth.uid() = user_id 
      and status = 'reported' 
      and (admin_note is null or admin_note = '')
    )
    or public.is_admin()
  );

create policy "reports_update_user_policy"
  on public.reports for update
  using (auth.uid() = user_id and not public.is_admin())
  with check (auth.uid() = user_id and not public.is_admin());

create policy "reports_update_admin_policy"
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "reports_delete_user_policy"
  on public.reports for delete
  using (auth.uid() = user_id and status = 'reported');

create policy "reports_delete_admin_policy"
  on public.reports for delete
  using (public.is_admin());

-- 3. Report Updates Policies
create policy "report_updates_select_policy"
  on public.report_updates for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.reports r
      where r.id = report_updates.report_id
        and r.user_id = auth.uid()
    )
  );

create policy "report_updates_insert_policy"
  on public.report_updates for insert
  with check (public.is_admin());

create policy "report_updates_update_admin_policy"
  on public.report_updates for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "report_updates_delete_admin_policy"
  on public.report_updates for delete
  using (public.is_admin());

-- 4. Notifications Policies
create policy "notifications_select_policy"
  on public.notifications for select
  using (auth.uid() = user_id or public.is_admin());

create policy "notifications_update_policy"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications_insert_policy"
  on public.notifications for insert
  with check (public.is_admin() or auth.uid() = user_id);

create policy "notifications_delete_policy"
  on public.notifications for delete
  using (auth.uid() = user_id or public.is_admin());

-- ==============================================================================
-- STORAGE BUCKETS SETUP (For Hazard Photos & User Avatars)
-- ==============================================================================
insert into storage.buckets (id, name, public)
values 
  ('hazard-images', 'hazard-images', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Hazard images are viewable by authenticated users and admins" on storage.objects;
create policy "Hazard images are viewable by authenticated users and admins"
  on storage.objects for select
  using (bucket_id = 'hazard-images' and (auth.role() = 'authenticated' or public.is_admin()));

drop policy if exists "Authenticated users can upload hazard images" on storage.objects;
create policy "Authenticated users can upload hazard images"
  on storage.objects for insert
  with check (bucket_id = 'hazard-images' and auth.role() = 'authenticated');

drop policy if exists "Users can delete own hazard images; admins can delete any" on storage.objects;
create policy "Users can delete own hazard images; admins can delete any"
  on storage.objects for delete
  using (bucket_id = 'hazard-images' and (auth.uid() = owner or public.is_admin()));

drop policy if exists "Avatars are publicly accessible" on storage.objects;
create policy "Avatars are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Anyone can upload avatars" on storage.objects;
create policy "Anyone can upload avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

-- ==============================================================================
-- SAMPLE REAL-WORLD SEED DATA (For Hackathon Demos)
-- ==============================================================================
insert into public.reports (
  id,
  title,
  description,
  category,
  severity,
  risk_score,
  latitude,
  longitude,
  address,
  image_url,
  ai_detected,
  ai_confidence,
  status,
  admin_note
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'Deep Asphalt Pothole near Metro Pedestrian Crossing',
    'Severe 45cm diameter pothole right in front of the zebra crossing curb ramp, causing tripping hazards and vehicle splashing during rain.',
    'pothole',
    'high',
    82,
    28.6139,
    77.2090,
    'Rajpath Outer Circle, Connaught Place, New Delhi',
    'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=800',
    true,
    94.50,
    'verified',
    'Assigned to Ward 12 Road Repair Unit.'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Exposed Stormwater Open Manhole',
    'Completely missing circular concrete cover over 2-meter deep drainage chamber directly along the pedestrian footpath.',
    'open_manhole',
    'critical',
    96,
    12.9716,
    77.5946,
    'MG Road Metro Station Entrance Gate 3, Bangalore',
    'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?auto=format&fit=crop&q=80&w=800',
    true,
    98.20,
    'in_progress',
    'Barricaded with safety cones; replacement heavy cast iron lid in transit.'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Collapsed Paver Slabs on Pedestrian Sidewalk',
    'Cracked and jutting concrete paving slabs with exposed rebar, blocking wheelchair access and causing pedestrian falls.',
    'broken_footpath',
    'medium',
    64,
    19.0760,
    72.8777,
    'Linking Road & 14th Road Junction, Bandra West, Mumbai',
    'https://images.unsplash.com/photo-1518206411599-232a581de943?auto=format&fit=crop&q=80&w=800',
    true,
    89.75,
    'reported',
    ''
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'Severe Monsoon Waterlogging on Walkway',
    'Knee-deep standing rainwater over 30 meters of footpath and curb ramp, forcing school children and seniors into busy vehicular lanes.',
    'waterlogging',
    'high',
    78,
    13.0827,
    80.2707,
    'Poonamallee High Road, Chennai',
    'https://images.unsplash.com/photo-1518206411599-232a581de943?auto=format&fit=crop&q=80&w=800',
    true,
    91.30,
    'under_review',
    'Drainage pump team notified.'
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'Damaged Tactile Wheelchair Access Ramp',
    'Concrete ramp crumbled at gutter edge, steep jagged lip prevents wheelchair and stroller transit.',
    'damaged_ramp',
    'medium',
    58,
    18.5204,
    73.8567,
    'FC Road Pedestrian Plaza, Pune',
    'https://images.unsplash.com/photo-1518206411599-232a581de943?auto=format&fit=crop&q=80&w=800',
    true,
    88.40,
    'resolved',
    'Reconstructed with new anti-skid tactile slope on Sept 18.'
  )
on conflict (id) do nothing;
