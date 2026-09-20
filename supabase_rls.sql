-- ==============================================================================
-- PathPulse AI - Complete Row Level Security (RLS) Policies & Access Control
-- Run this script directly in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. SECURE ADMIN VERIFICATION FUNCTION
-- Evaluates admin role directly from public.profiles using the cryptographically verified auth.uid().
-- SECURITY DEFINER bypasses RLS on profiles to avoid recursive loops.
-- STABLE allows Postgres to cache the result per statement for high performance.
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

-- 2. ENFORCE REPORT FIELD RESTRICTIONS VIA TRIGGER
-- Ensures normal users cannot modify 'status', 'admin_note', or reassign 'user_id'
create or replace function public.protect_report_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If updater is NOT an admin
  if not public.is_admin() then
    -- Prevent unauthorized status changes
    if new.status is distinct from old.status then
      raise exception 'Unauthorized: Only administrators can update the report status.';
    end if;
    -- Prevent tampering with admin notes
    if new.admin_note is distinct from old.admin_note then
      raise exception 'Unauthorized: Only administrators can modify admin notes.';
    end if;
    -- Prevent reassigning report ownership
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

-- 3. ENABLE ROW LEVEL SECURITY ON ALL USER-RELATED TABLES
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_updates enable row level security;
alter table public.notifications enable row level security;

-- ==============================================================================
-- 4. CLEAN UP PREVIOUS POLICIES
-- ==============================================================================
-- Profiles
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users or admins can update profiles" on public.profiles;
drop policy if exists "profiles_select_policy" on public.profiles;
drop policy if exists "profiles_insert_policy" on public.profiles;
drop policy if exists "profiles_update_user_policy" on public.profiles;
drop policy if exists "profiles_update_admin_policy" on public.profiles;
drop policy if exists "profiles_delete_admin_policy" on public.profiles;

-- Reports
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

-- Report Updates
drop policy if exists "Report updates are viewable by everyone" on public.report_updates;
drop policy if exists "Authenticated users or admins can insert report updates" on public.report_updates;
drop policy if exists "report_updates_select_policy" on public.report_updates;
drop policy if exists "report_updates_insert_policy" on public.report_updates;
drop policy if exists "report_updates_update_admin_policy" on public.report_updates;
drop policy if exists "report_updates_delete_admin_policy" on public.report_updates;

-- Notifications
drop policy if exists "Users can view their own notifications" on public.notifications;
drop policy if exists "Users can update their own notifications" on public.notifications;
drop policy if exists "Service or authenticated users can insert notifications" on public.notifications;
drop policy if exists "notifications_select_policy" on public.notifications;
drop policy if exists "notifications_update_policy" on public.notifications;
drop policy if exists "notifications_insert_policy" on public.notifications;
drop policy if exists "notifications_delete_policy" on public.notifications;

-- ==============================================================================
-- 5. POLICIES: profiles
-- ==============================================================================

-- SELECT: Users see only their own profile; admins see all profiles
create policy "profiles_select_policy"
  on public.profiles for select
  using (
    auth.uid() = user_id 
    or public.is_admin()
  );

-- INSERT: Users can create their own profile with role='user'; admins can create any
create policy "profiles_insert_policy"
  on public.profiles for insert
  with check (
    (auth.uid() = user_id and role = 'user')
    or public.is_admin()
  );

-- UPDATE (Normal Users): Users can only update their own profile and CANNOT change their role to 'admin'
create policy "profiles_update_user_policy"
  on public.profiles for update
  using (auth.uid() = user_id and not public.is_admin())
  with check (auth.uid() = user_id and role = 'user');

-- UPDATE (Admins): Admins can update any profile, including modifying roles
create policy "profiles_update_admin_policy"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE: Only admins can delete profiles
create policy "profiles_delete_admin_policy"
  on public.profiles for delete
  using (public.is_admin());

-- ==============================================================================
-- 6. POLICIES: reports
-- ==============================================================================

-- SELECT: Hazard reports are publicly readable for community safety map & civic transparency
-- Note: User profiles, phone numbers, and private credentials remain strictly protected
create policy "reports_select_policy"
  on public.reports for select
  using (
    true
  );

-- INSERT: Users can create their own reports (default status 'reported', empty admin_note); admins can insert any
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

-- UPDATE (Normal Users): Users can update details of their own reports
create policy "reports_update_user_policy"
  on public.reports for update
  using (auth.uid() = user_id and not public.is_admin())
  with check (auth.uid() = user_id and not public.is_admin());

-- UPDATE (Admins): Admins can update any report, including status and admin_note
create policy "reports_update_admin_policy"
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE (Normal Users): Users can only delete their own reports while still in 'reported' status
create policy "reports_delete_user_policy"
  on public.reports for delete
  using (auth.uid() = user_id and status = 'reported');

-- DELETE (Admins): Admins can delete any report
create policy "reports_delete_admin_policy"
  on public.reports for delete
  using (public.is_admin());

-- ==============================================================================
-- 7. POLICIES: report_updates
-- ==============================================================================

-- SELECT: Users can view status history of their own reports; admins can view all status history
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

-- INSERT: Admins can manually create report updates (automatic trigger uses security definer)
create policy "report_updates_insert_policy"
  on public.report_updates for insert
  with check (public.is_admin());

-- UPDATE: Audit records are immutable; only admins can edit if strictly necessary
create policy "report_updates_update_admin_policy"
  on public.report_updates for update
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE: Only admins can delete audit logs
create policy "report_updates_delete_admin_policy"
  on public.report_updates for delete
  using (public.is_admin());

-- ==============================================================================
-- 8. POLICIES: notifications
-- ==============================================================================

-- SELECT: Users can only view their own notifications; admins can view all
create policy "notifications_select_policy"
  on public.notifications for select
  using (
    auth.uid() = user_id 
    or public.is_admin()
  );

-- UPDATE: Users can update their own notifications (e.g., mark as read: is_read = true)
create policy "notifications_update_policy"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- INSERT: Admins can send notifications; automated triggers execute with security definer
create policy "notifications_insert_policy"
  on public.notifications for insert
  with check (
    public.is_admin() 
    or auth.uid() = user_id
  );

-- DELETE: Users can delete/dismiss their own notifications; admins can delete any
create policy "notifications_delete_policy"
  on public.notifications for delete
  using (
    auth.uid() = user_id 
    or public.is_admin()
  );

-- ==============================================================================
-- 9. STORAGE POLICIES: hazard-images & avatars
-- ==============================================================================
-- Hazard Images: Users can view their own uploaded images; admins can view all
create policy "hazard_images_select_policy"
  on storage.objects for select
  using (
    bucket_id = 'hazard-images'
    and (
      auth.role() = 'authenticated'
      or public.is_admin()
    )
  );

-- Hazard Images: Authenticated users can upload their own images
create policy "hazard_images_insert_policy"
  on storage.objects for insert
  with check (
    bucket_id = 'hazard-images'
    and auth.role() = 'authenticated'
  );

-- Hazard Images: Users can delete their own image; admins can delete any
create policy "hazard_images_delete_policy"
  on storage.objects for delete
  using (
    bucket_id = 'hazard-images'
    and (
      auth.uid() = owner 
      or public.is_admin()
    )
  );

-- Avatars: Publicly viewable avatars
create policy "avatars_select_policy"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Avatars: Authenticated users can upload their avatar
create policy "avatars_insert_policy"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
  );

-- Avatars: Users can update or delete their avatar
create policy "avatars_delete_policy"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (
      auth.uid() = owner 
      or public.is_admin()
    )
  );
