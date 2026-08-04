import { SvelteSet } from 'svelte/reactivity';

/**
 * Selección de filas para las acciones en lote (SPEC-008 §2).
 *
 * Vive fuera del componente por dos razones. Una, que hay dos listas en juego y confundirlas es
 * fácil: la **pintada** (la tanda de 100 filas) manda para el rango con shift, y la **filtrada**
 * (todo lo que cumple la búsqueda, aunque no esté pintado) manda para «marcar todo» y para lo que
 * recibe la acción. Dos, que así se puede probar sin sesión de administrador.
 *
 * Los marcados se guardan por id, no por objeto: el `load` trae objetos nuevos en cada refresco y
 * una selección por referencia se perdería al guardar cualquier cosa.
 */
export function crearSeleccion<T>({
	visibles,
	todos,
	idDe
}: {
	/** Filas pintadas, en el orden en que se ven. Base del rango con shift. */
	visibles: () => T[];
	/** Todo lo que pasa el filtro, pintado o no. */
	todos: () => T[];
	idDe: (item: T) => string;
}) {
	const marcados = new SvelteSet<string>();
	let ultima = -1;

	return {
		tiene: (id: string) => marcados.has(id),

		/**
		 * Lo seleccionado que además sigue pasando el filtro. Si marcas tres, buscas otra cosa y
		 * pulsas «eliminar», la acción no puede caer sobre recursos que ya no ves.
		 */
		get seleccionados() {
			return todos().filter((item) => marcados.has(idDe(item)));
		},

		get cuantos() {
			return this.seleccionados.length;
		},

		get todosMarcados() {
			const lista = todos();
			return lista.length > 0 && lista.every((item) => marcados.has(idDe(item)));
		},

		/** La casilla de la cabecera marca TODO lo filtrado, no solo la tanda pintada. */
		alternarTodos() {
			if (this.todosMarcados) {
				marcados.clear();
			} else {
				for (const item of todos()) marcados.add(idDe(item));
			}
			ultima = -1;
		},

		/** Clic en la casilla de una fila. Con shift, marca el rango desde la última tocada. */
		fila(indice: number, evento?: { shiftKey?: boolean }) {
			const lista = visibles();
			const item = lista[indice];
			if (!item) return;
			const id = idDe(item);

			if (evento?.shiftKey && ultima >= 0 && ultima < lista.length) {
				const [desde, hasta] = indice < ultima ? [indice, ultima] : [ultima, indice];
				// el rango entero acaba como acabe la fila pulsada: si se marca, se marcan todas
				const marcar = !marcados.has(id);
				for (let i = desde; i <= hasta; i++) {
					const fila = lista[i];
					if (!fila) continue;
					if (marcar) marcados.add(idDe(fila));
					else marcados.delete(idDe(fila));
				}
			} else if (marcados.has(id)) {
				marcados.delete(id);
			} else {
				marcados.add(id);
			}
			ultima = indice;
		},

		limpiar() {
			marcados.clear();
			ultima = -1;
		},

		olvidar(id: string) {
			marcados.delete(id);
		}
	};
}
