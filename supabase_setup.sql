-- Create a table for public profiles
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  coins integer default 0,
  high_score integer default 0,
  unlocked_cars text[] default ARRAY['rally'],
  selected_car text default 'rally'
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

-- Policy to allow users to view their own profile
create policy "Users can view own profile"
  on profiles for select
  using ( auth.uid() = id );

-- Policy to allow users to insert their own profile
create policy "Users can insert own profile"
  on profiles for insert
  with check ( auth.uid() = id );

-- Policy to allow users to update their own profile
create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Set up a trigger to create a profile entry when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, coins, high_score, unlocked_cars, selected_car)
  values (new.id, 0, 0, ARRAY['rally'], 'rally');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
