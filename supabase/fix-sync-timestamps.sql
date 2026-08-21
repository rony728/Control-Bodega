-- Actualización segura para un proyecto Supabase ya creado.
-- Solo elimina los triggers que reemplazan updated_at con la hora del servidor.
-- No elimina tablas, columnas ni registros.

drop trigger if exists set_gestiones_updated_at on public.gestiones;
drop trigger if exists set_dispositivos_updated_at on public.dispositivos;
drop trigger if exists set_modelos_updated_at on public.modelos;
drop trigger if exists set_estados_updated_at on public.estados;
drop trigger if exists set_fallas_updated_at on public.fallas;
