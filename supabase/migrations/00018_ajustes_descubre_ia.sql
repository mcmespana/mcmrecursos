-- SPEC-007 §fase 2 / SPEC-010 §fase 4 · «Recomiéndame…» en Descubre + interruptor de funciones
--
-- Tabla de ajustes clave/valor para poder APAGAR funciones desde /admin/config sin
-- tocar código ni redesplegar. Nace por la IA de Descubre (que llama a Gemini y podría
-- fallar, ponerse cara o dar malos resultados un mal día), pero sirve para cualquier
-- flag futuro: una fila, un interruptor.
--
-- Lectura pública a propósito: son banderas de interfaz (¿enseño el buscador de IA?),
-- nunca secretos. Escritura solo admin.

create table if not exists recursos.ajuste (
	clave text primary key,
	valor text not null,
	descripcion text,
	updated_at timestamptz not null default now(),
	updated_by uuid references recursos.perfil (id) on delete set null
);

comment on table recursos.ajuste is
	'Ajustes de la app editables desde /admin/config. Valores en texto ("on"/"off" para flags).';

alter table recursos.ajuste enable row level security;

drop policy if exists "ajuste lo lee cualquiera" on recursos.ajuste;
create policy "ajuste lo lee cualquiera" on recursos.ajuste for select
	using (true);

drop policy if exists "ajuste lo cambia admin" on recursos.ajuste;
create policy "ajuste lo cambia admin" on recursos.ajuste for all
	using (recursos.es_admin()) with check (recursos.es_admin());

insert into recursos.ajuste (clave, valor, descripcion) values
	(
		'descubre_ia',
		'on',
		'Buscador «Recomiéndame…» de /descubre (Gemini + embeddings). Ponlo en off si falla, se pone caro o da malas recomendaciones: Descubre sigue funcionando con el mazo normal.'
	)
on conflict (clave) do nothing;

notify pgrst, 'reload schema';
