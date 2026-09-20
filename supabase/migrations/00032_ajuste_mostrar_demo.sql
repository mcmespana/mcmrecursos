-- 00032 · Interruptor «Recursos de muestra» en /admin/config → Funciones
--
-- El catálogo de demostración (migración 00031, `es_demo`) se cuela en portada, Descubre e
-- itinerarios con su insignia «Demo». Estaba bien para enseñar cómo se verá el banco lleno,
-- pero ahora hace falta poder apagarlo sin tocar código: un interruptor más en `ajuste`,
-- igual que `descubre_ia` (migración 00018).
--
-- Nace en «off»: los recursos de muestra se ocultan del todo (público y privado) hasta que
-- alguien los vuelva a encender a propósito desde el panel. No se borra ni un dato.

insert into recursos.ajuste (clave, valor, descripcion) values
	(
		'mostrar_demo',
		'off',
		'Recursos de muestra del catálogo de demostración (SPEC-017, es_demo). Apagado los quita de portada, Descubre e itinerarios, en público y en privado, sin borrar nada.'
	)
on conflict (clave) do nothing;

notify pgrst, 'reload schema';
