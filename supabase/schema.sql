-- BrideGuide Database Schema Setup
-- Run this script in your Supabase SQL Editor to set up the database tables, policies, and realtime replication.

-- 1. Create Profiles Table (Stores wedding metadata for each bride)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  wedding_date date,
  wedding_theme text,
  guest_count integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Tasks Table (Wedding tasks list)
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  status text default 'TODO' check (status in ('TODO', 'IN_PROGRESS', 'DONE')) not null,
  priority text default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH')) not null,
  category text default 'General' not null,
  due_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Community Messages Table (Live Lounge chat)
create table public.community_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  user_email text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.community_messages enable row level security;

-- 5. Define RLS Policies

-- Profiles Policies
create policy "Users can view their own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can update their own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

-- Tasks Policies
create policy "Users can view their own tasks" 
  on public.tasks for select 
  using (auth.uid() = user_id);

create policy "Users can insert their own tasks" 
  on public.tasks for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own tasks" 
  on public.tasks for update 
  using (auth.uid() = user_id);

create policy "Users can delete their own tasks" 
  on public.tasks for delete 
  using (auth.uid() = user_id);

-- Community Lounge Policies (Allow authenticated users to chat)
create policy "Authenticated users can read lounge messages" 
  on public.community_messages for select 
  using (auth.role() = 'authenticated');

create policy "Authenticated users can post lounge messages" 
  on public.community_messages for insert 
  with check (auth.uid() = user_id);

-- 6. Trigger to automatically create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Enable Realtime Replication for instant updates
-- Note: Recreate or update publication if it already exists
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.community_messages;
