-- Ensure the table exists
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone
);

-- Add columns if they don't exist (robust migration)
alter table profiles add column if not exists coins integer default 0;
alter table profiles add column if not exists high_score integer default 0;
alter table profiles add column if not exists unlocked_cars text[] default ARRAY['rally'];
alter table profiles add column if not exists selected_car text default 'rally';
alter table profiles add column if not exists updated_at timestamp with time zone;
alter table profiles add column if not exists boosters integer default 0;

-- Enable RLS
alter table profiles enable row level security;

-- Policies (drop first to avoid errors if they exist)
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles for select using ( auth.uid() = id );

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile" on profiles for insert with check ( auth.uid() = id );

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using ( auth.uid() = id );

-- Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, coins, high_score, unlocked_cars, selected_car)
  values (new.id, 0, 0, ARRAY['rally'], 'rally')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Force schema cache reload
notify pgrst, 'reload config';
