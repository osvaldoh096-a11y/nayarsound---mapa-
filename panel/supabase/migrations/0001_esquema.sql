-- Esquema del panel: personas, operaciones (préstamos e inversiones), pagos y ajustes.
-- Todas las tablas tienen RLS: cada usuario solo ve y modifica sus propios registros,
-- y solo los correos de private.permitidos pueden existir como usuarios.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.permitidos (
  email text primary key
);
revoke all on private.permitidos from public, anon, authenticated;

create or replace function private.usuario_permitido(uid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    join private.permitidos p on lower(p.email) = lower(u.email)
    where u.id = uid
  );
$$;
revoke execute on function private.usuario_permitido(uuid) from public, anon, authenticated;

create or replace function private.acceso_valido()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and private.usuario_permitido(auth.uid());
$$;
revoke execute on function private.acceso_valido() from public, anon;
grant execute on function private.acceso_valido() to authenticated;

-- Bloquea la creación de cualquier usuario cuyo correo no esté permitido
-- (registro público, anónimos, invitaciones).
create or replace function private.bloquear_registro()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is null or not exists (
    select 1 from private.permitidos p where lower(p.email) = lower(new.email)
  ) then
    raise exception 'Registro deshabilitado';
  end if;
  return new;
end;
$$;
revoke execute on function private.bloquear_registro() from public, anon, authenticated;

drop trigger if exists bloquear_registro on auth.users;
create trigger bloquear_registro
  before insert on auth.users
  for each row execute function private.bloquear_registro();

-- Tablas -------------------------------------------------------------------

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('prestatario', 'inversor')),
  nombre text not null check (length(nombre) between 1 and 200),
  pago_diferido boolean not null default false,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  eliminado timestamptz,
  unique (owner_id, id),
  unique (owner_id, tipo, nombre)
);

create table public.operaciones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('prestamo', 'inversion')),
  op integer check (op > 0),
  persona_id uuid not null,
  pago_mensual text check (pago_mensual in ('SI', 'NO')),
  fecha_inicio date not null,
  divisa text not null check (divisa in ('MXN', 'USDT')),
  cantidad numeric not null,
  equivalencia numeric,
  tasa numeric not null,
  fecha_compromiso date,
  -- null = HOY() dinámico, como la celda =TODAY() del Sheets
  dia_final date,
  estado text not null check (estado in ('ACTIVO', 'LIQUIDADO')),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  eliminado timestamptz,
  unique (owner_id, id),
  unique (owner_id, tipo, id),
  unique (owner_id, tipo, op),
  foreign key (owner_id, persona_id) references public.personas (owner_id, id)
);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('prestamo', 'inversion')),
  -- null = pago histórico sin número de operación (no entra en ningún cálculo)
  operacion_id uuid,
  fecha date not null,
  cantidad numeric not null,
  orden bigint,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  eliminado timestamptz,
  foreign key (owner_id, tipo, operacion_id) references public.operaciones (owner_id, tipo, id)
);
create index pagos_operacion_idx on public.pagos (owner_id, operacion_id);

create table public.ajustes (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  tipo_cambio numeric not null default 18,
  zona_horaria text not null default 'America/Los_Angeles',
  actualizado timestamptz not null default now()
);

-- Disparadores ---------------------------------------------------------------

create or replace function private.tocar_actualizado()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

create trigger personas_actualizado before update on public.personas
  for each row execute function private.tocar_actualizado();
create trigger operaciones_actualizado before update on public.operaciones
  for each row execute function private.tocar_actualizado();
create trigger pagos_actualizado before update on public.pagos
  for each row execute function private.tocar_actualizado();
create trigger ajustes_actualizado before update on public.ajustes
  for each row execute function private.tocar_actualizado();

-- Número de OP consecutivo por tipo y validación de que la persona corresponde al tipo.
create or replace function private.preparar_operacion()
returns trigger language plpgsql set search_path = '' as $$
declare
  tipo_persona text;
begin
  select p.tipo into tipo_persona from public.personas p
   where p.id = new.persona_id and p.owner_id = new.owner_id;
  if tipo_persona is distinct from (case new.tipo when 'prestamo' then 'prestatario' else 'inversor' end) then
    raise exception 'La persona no corresponde al tipo de operación';
  end if;
  if new.op is null then
    select coalesce(max(o.op), 0) + 1 into new.op from public.operaciones o
     where o.owner_id = new.owner_id and o.tipo = new.tipo;
  end if;
  return new;
end;
$$;
create trigger operaciones_preparar before insert or update of persona_id, tipo, op on public.operaciones
  for each row execute function private.preparar_operacion();

create or replace function private.preparar_pago()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.orden is null then
    select coalesce(max(g.orden), 0) + 1 into new.orden from public.pagos g
     where g.owner_id = new.owner_id;
  end if;
  return new;
end;
$$;
create trigger pagos_preparar before insert on public.pagos
  for each row execute function private.preparar_pago();

-- Permisos y RLS -------------------------------------------------------------

revoke all on public.personas, public.operaciones, public.pagos, public.ajustes from anon, public;
revoke all on public.personas, public.operaciones, public.pagos, public.ajustes from authenticated;
grant select, insert, update, delete on public.personas, public.operaciones, public.pagos, public.ajustes to authenticated;

alter table public.personas enable row level security;
alter table public.operaciones enable row level security;
alter table public.pagos enable row level security;
alter table public.ajustes enable row level security;

create policy acceso_propio on public.personas for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.acceso_valido()))
  with check (owner_id = (select auth.uid()) and (select private.acceso_valido()));
create policy acceso_propio on public.operaciones for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.acceso_valido()))
  with check (owner_id = (select auth.uid()) and (select private.acceso_valido()));
create policy acceso_propio on public.pagos for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.acceso_valido()))
  with check (owner_id = (select auth.uid()) and (select private.acceso_valido()));
create policy acceso_propio on public.ajustes for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.acceso_valido()))
  with check (owner_id = (select auth.uid()) and (select private.acceso_valido()));

-- Restauración de respaldo: reemplaza todos los registros del usuario en una sola transacción.
-- Corre con los permisos del usuario (RLS aplica).
create or replace function public.restaurar_respaldo(datos jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n_personas int;
  n_operaciones int;
  n_pagos int;
begin
  if not private.acceso_valido() then
    raise exception 'No autorizado';
  end if;
  if datos->>'formato' is distinct from 'panel-respaldo-v1' then
    raise exception 'Formato de respaldo no reconocido';
  end if;

  delete from public.pagos where owner_id = uid;
  delete from public.operaciones where owner_id = uid;
  delete from public.personas where owner_id = uid;
  delete from public.ajustes where owner_id = uid;

  insert into public.personas (id, owner_id, tipo, nombre, pago_diferido, creado, actualizado, eliminado)
  select x.id, uid, x.tipo, x.nombre, coalesce(x.pago_diferido, false),
         coalesce(x.creado, now()), coalesce(x.actualizado, now()), x.eliminado
    from jsonb_to_recordset(coalesce(datos->'personas', '[]'::jsonb)) as x(
      id uuid, tipo text, nombre text, pago_diferido boolean,
      creado timestamptz, actualizado timestamptz, eliminado timestamptz);
  get diagnostics n_personas = row_count;

  insert into public.operaciones (id, owner_id, tipo, op, persona_id, pago_mensual, fecha_inicio, divisa,
    cantidad, equivalencia, tasa, fecha_compromiso, dia_final, estado, creado, actualizado, eliminado)
  select x.id, uid, x.tipo, x.op, x.persona_id, x.pago_mensual, x.fecha_inicio, x.divisa,
         x.cantidad, x.equivalencia, x.tasa, x.fecha_compromiso, x.dia_final, x.estado,
         coalesce(x.creado, now()), coalesce(x.actualizado, now()), x.eliminado
    from jsonb_to_recordset(coalesce(datos->'operaciones', '[]'::jsonb)) as x(
      id uuid, tipo text, op integer, persona_id uuid, pago_mensual text, fecha_inicio date, divisa text,
      cantidad numeric, equivalencia numeric, tasa numeric, fecha_compromiso date, dia_final date,
      estado text, creado timestamptz, actualizado timestamptz, eliminado timestamptz);
  get diagnostics n_operaciones = row_count;

  insert into public.pagos (id, owner_id, tipo, operacion_id, fecha, cantidad, orden, creado, actualizado, eliminado)
  select x.id, uid, x.tipo, x.operacion_id, x.fecha, x.cantidad, x.orden,
         coalesce(x.creado, now()), coalesce(x.actualizado, now()), x.eliminado
    from jsonb_to_recordset(coalesce(datos->'pagos', '[]'::jsonb)) as x(
      id uuid, tipo text, operacion_id uuid, fecha date, cantidad numeric, orden bigint,
      creado timestamptz, actualizado timestamptz, eliminado timestamptz);
  get diagnostics n_pagos = row_count;

  if datos ? 'ajustes' and jsonb_typeof(datos->'ajustes') = 'object' then
    insert into public.ajustes (owner_id, tipo_cambio, zona_horaria)
    values (uid,
            coalesce((datos->'ajustes'->>'tipo_cambio')::numeric, 18),
            coalesce(datos->'ajustes'->>'zona_horaria', 'America/Los_Angeles'));
  end if;

  return jsonb_build_object('personas', n_personas, 'operaciones', n_operaciones, 'pagos', n_pagos);
end;
$$;
revoke execute on function public.restaurar_respaldo(jsonb) from public, anon;
grant execute on function public.restaurar_respaldo(jsonb) to authenticated;
