-- Migración segura para una base Supabase existente.
-- No elimina tablas ni registros; agrega el cursor del servidor, índices y triggers.

create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at = timezone('utc', now());
  return new;
end;
$$;

alter table public.gestiones add column if not exists server_updated_at timestamptz not null default timezone('utc', now());
alter table public.modelos add column if not exists server_updated_at timestamptz not null default timezone('utc', now());
alter table public.estados add column if not exists server_updated_at timestamptz not null default timezone('utc', now());
alter table public.fallas add column if not exists server_updated_at timestamptz not null default timezone('utc', now());
alter table public.dispositivos add column if not exists server_updated_at timestamptz not null default timezone('utc', now());

create index if not exists gestiones_server_updated_at_idx on public.gestiones(server_updated_at);
create index if not exists modelos_server_updated_at_idx on public.modelos(server_updated_at);
create index if not exists estados_server_updated_at_idx on public.estados(server_updated_at);
create index if not exists fallas_server_updated_at_idx on public.fallas(server_updated_at);
create index if not exists dispositivos_server_updated_at_idx on public.dispositivos(server_updated_at);

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
