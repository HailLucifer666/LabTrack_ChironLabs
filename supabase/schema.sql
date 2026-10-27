-- Run this in the Supabase SQL Editor before configuring the deployed app.
-- Sample records use synthetic clinic emails only.
create table if not exists public.cases (
  id text primary key,
  reference text not null unique,
  clinic_name text not null,
  clinic_email text not null,
  case_type text not null,
  due_date date not null,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'READY')),
  notification_status text not null default 'NOT_SENT' check (notification_status in ('NOT_SENT', 'PREVIEWED', 'SENT', 'FAILED')),
  updated_at timestamptz not null default now()
);

-- This take-home uses a server-side service role key for server routes. Do not expose that key in a browser bundle.
-- For production, implement auth and row-level security policies before using real customer data.

insert into public.cases (id, reference, clinic_name, clinic_email, case_type, due_date, status, notification_status, updated_at)
values
  ('case-1001', 'LT-1042', 'Bright Smile Dental', 'clinic-demo@example.com', 'Zirconia crown', '2026-10-29', 'READY', 'NOT_SENT', now()),
  ('case-1002', 'LT-1043', 'Berlin Dental Studio', 'berlin-demo@example.com', 'Bridge - 3-unit', '2026-10-30', 'IN_PROGRESS', 'NOT_SENT', now()),
  ('case-1003', 'LT-1040', 'London Smile Clinic', 'london-demo@example.com', 'Ceramic crown', '2026-10-25', 'IN_PROGRESS', 'NOT_SENT', now()),
  ('case-1004', 'LT-1044', 'Harbour Dental Care', 'harbour-demo@example.com', 'Night guard', '2026-10-31', 'IN_PROGRESS', 'NOT_SENT', now()),
  ('case-1005', 'LT-1038', 'Northstar Dental Group', 'northstar-demo@example.com', 'Implant crown', '2026-10-27', 'READY', 'SENT', now()),
  ('case-1006', 'LT-1045', 'Parkside Family Dentistry', 'parkside-demo@example.com', 'Full-contour bridge', '2026-11-02', 'IN_PROGRESS', 'NOT_SENT', now())
on conflict (id) do nothing;
