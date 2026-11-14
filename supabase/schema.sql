-- Todo Motos: tabla de productos
-- Ejecútalo una sola vez en Supabase: SQL Editor -> New query -> Run

create table if not exists public.productos (
  id               bigint generated always as identity primary key,
  nombre           text    not null check (char_length(nombre) between 1 and 120),
  referencia       text    check (referencia is null or char_length(referencia) <= 60),
  medida           text    check (medida is null or char_length(medida) <= 60),
  precio           integer not null check (precio >= 0),
  imagen_url       text,
  imagen_public_id text,
  agotado          boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists productos_created_at_idx on public.productos (created_at desc);

-- Seguridad: RLS activado y SIN políticas.
-- Nadie puede leer ni escribir directo desde internet con la clave pública (anon).
-- Solo el servidor, que usa la service_role key, puede acceder a la tabla.
alter table public.productos enable row level security;
