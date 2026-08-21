-- Control Bodega - esquema completo para Supabase
-- Ejecutar todo este archivo desde el SQL Editor del proyecto.

create extension if not exists pgcrypto;

create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.gestiones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_creacion timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  server_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists public.modelos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  server_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists public.estados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  server_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists public.fallas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  server_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  serie text not null,
  modelo text not null,
  estado text not null,
  falla text not null,
  descripcion_falla text not null default '',
  comentarios text not null default '',
  fecha_registro timestamptz not null default timezone('utc', now()),
  gestion_id uuid not null references public.gestiones(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  server_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create unique index if not exists dispositivos_serie_unique_active
  on public.dispositivos (lower(trim(serie)))
  where deleted_at is null;
create unique index if not exists gestiones_nombre_unique_active
  on public.gestiones (lower(trim(nombre)))
  where deleted_at is null;
create unique index if not exists modelos_nombre_unique_active
  on public.modelos (lower(trim(nombre)))
  where deleted_at is null;
create unique index if not exists estados_nombre_unique_active
  on public.estados (lower(trim(nombre)))
  where deleted_at is null;
create unique index if not exists fallas_nombre_unique_active
  on public.fallas (lower(trim(nombre)))
  where deleted_at is null;

create index if not exists gestiones_updated_at_idx on public.gestiones(updated_at);
create index if not exists gestiones_server_updated_at_idx on public.gestiones(server_updated_at);
create index if not exists gestiones_deleted_at_idx on public.gestiones(deleted_at);
create index if not exists modelos_updated_at_idx on public.modelos(updated_at);
create index if not exists modelos_server_updated_at_idx on public.modelos(server_updated_at);
create index if not exists modelos_deleted_at_idx on public.modelos(deleted_at);
create index if not exists estados_updated_at_idx on public.estados(updated_at);
create index if not exists estados_server_updated_at_idx on public.estados(server_updated_at);
create index if not exists estados_deleted_at_idx on public.estados(deleted_at);
create index if not exists fallas_updated_at_idx on public.fallas(updated_at);
create index if not exists fallas_server_updated_at_idx on public.fallas(server_updated_at);
create index if not exists fallas_deleted_at_idx on public.fallas(deleted_at);
create index if not exists dispositivos_updated_at_idx on public.dispositivos(updated_at);
create index if not exists dispositivos_server_updated_at_idx on public.dispositivos(server_updated_at);
create index if not exists dispositivos_gestion_id_idx on public.dispositivos(gestion_id);
create index if not exists dispositivos_deleted_at_idx on public.dispositivos(deleted_at);

drop trigger if exists set_server_updated_at_gestiones on public.gestiones;
create trigger set_server_updated_at_gestiones before update on public.gestiones for each row execute function public.set_server_updated_at();
drop trigger if exists set_server_updated_at_modelos on public.modelos;
create trigger set_server_updated_at_modelos before update on public.modelos for each row execute function public.set_server_updated_at();
drop trigger if exists set_server_updated_at_estados on public.estados;
create trigger set_server_updated_at_estados before update on public.estados for each row execute function public.set_server_updated_at();
drop trigger if exists set_server_updated_at_fallas on public.fallas;
create trigger set_server_updated_at_fallas before update on public.fallas for each row execute function public.set_server_updated_at();
drop trigger if exists set_server_updated_at_dispositivos on public.dispositivos;
create trigger set_server_updated_at_dispositivos before update on public.dispositivos for each row execute function public.set_server_updated_at();

alter table public.gestiones enable row level security;
alter table public.dispositivos enable row level security;
alter table public.modelos enable row level security;
alter table public.estados enable row level security;
alter table public.fallas enable row level security;

drop policy if exists gestiones_authenticated_select on public.gestiones;
create policy gestiones_authenticated_select on public.gestiones for select to authenticated using (true);
drop policy if exists gestiones_authenticated_insert on public.gestiones;
create policy gestiones_authenticated_insert on public.gestiones for insert to authenticated with check (true);
drop policy if exists gestiones_authenticated_update on public.gestiones;
create policy gestiones_authenticated_update on public.gestiones for update to authenticated using (true) with check (true);
drop policy if exists gestiones_authenticated_delete on public.gestiones;
create policy gestiones_authenticated_delete on public.gestiones for delete to authenticated using (true);

drop policy if exists dispositivos_authenticated_select on public.dispositivos;
create policy dispositivos_authenticated_select on public.dispositivos for select to authenticated using (true);
drop policy if exists dispositivos_authenticated_insert on public.dispositivos;
create policy dispositivos_authenticated_insert on public.dispositivos for insert to authenticated with check (true);
drop policy if exists dispositivos_authenticated_update on public.dispositivos;
create policy dispositivos_authenticated_update on public.dispositivos for update to authenticated using (true) with check (true);
drop policy if exists dispositivos_authenticated_delete on public.dispositivos;
create policy dispositivos_authenticated_delete on public.dispositivos for delete to authenticated using (true);

drop policy if exists modelos_authenticated_select on public.modelos;
create policy modelos_authenticated_select on public.modelos for select to authenticated using (true);
drop policy if exists modelos_authenticated_insert on public.modelos;
create policy modelos_authenticated_insert on public.modelos for insert to authenticated with check (true);
drop policy if exists modelos_authenticated_update on public.modelos;
create policy modelos_authenticated_update on public.modelos for update to authenticated using (true) with check (true);
drop policy if exists modelos_authenticated_delete on public.modelos;
create policy modelos_authenticated_delete on public.modelos for delete to authenticated using (true);

drop policy if exists estados_authenticated_select on public.estados;
create policy estados_authenticated_select on public.estados for select to authenticated using (true);
drop policy if exists estados_authenticated_insert on public.estados;
create policy estados_authenticated_insert on public.estados for insert to authenticated with check (true);
drop policy if exists estados_authenticated_update on public.estados;
create policy estados_authenticated_update on public.estados for update to authenticated using (true) with check (true);
drop policy if exists estados_authenticated_delete on public.estados;
create policy estados_authenticated_delete on public.estados for delete to authenticated using (true);

drop policy if exists fallas_authenticated_select on public.fallas;
create policy fallas_authenticated_select on public.fallas for select to authenticated using (true);
drop policy if exists fallas_authenticated_insert on public.fallas;
create policy fallas_authenticated_insert on public.fallas for insert to authenticated with check (true);
drop policy if exists fallas_authenticated_update on public.fallas;
create policy fallas_authenticated_update on public.fallas for update to authenticated using (true) with check (true);
drop policy if exists fallas_authenticated_delete on public.fallas;
create policy fallas_authenticated_delete on public.fallas for delete to authenticated using (true);

-- Habilita eventos para la suscripción Realtime del frontend.
do $$
begin
  alter publication supabase_realtime add table public.gestiones;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.dispositivos;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.modelos;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.estados;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.fallas;
exception when duplicate_object then null;
end $$;
