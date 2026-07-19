import { browser } from '$app/environment';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

const CLAVE = 'mcm-social-local';

export interface ListaLocal {
	id: string;
	nombre: string;
	recursos: string[];
}

/**
 * Capa social sin cuenta: vive en localStorage de este dispositivo.
 * Al iniciar sesión, el layout la migra a la cuenta y la limpia.
 * Las valoraciones además viajan a BD como anónimas (anon_id = dispositivo).
 */
class SocialLocal {
	favoritos = new SvelteSet<string>();
	usos = new SvelteSet<string>();
	valoraciones = new SvelteMap<string, number>();
	listas = $state<ListaLocal[]>([]);
	dispositivo = $state('');
	private cargado = false;

	cargar() {
		if (!browser || this.cargado) return;
		this.cargado = true;
		try {
			const crudo = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
			for (const id of crudo.favoritos ?? []) this.favoritos.add(id);
			for (const id of crudo.usos ?? []) this.usos.add(id);
			for (const [id, n] of Object.entries(crudo.valoraciones ?? {}))
				this.valoraciones.set(id, n as number);
			this.listas = crudo.listas ?? [];
			this.dispositivo = crudo.dispositivo ?? '';
		} catch {
			// datos corruptos: se empieza de cero
		}
		if (!this.dispositivo) {
			this.dispositivo = crypto.randomUUID();
			this.guardar();
		}
	}

	private guardar() {
		if (!browser) return;
		localStorage.setItem(
			CLAVE,
			JSON.stringify({
				favoritos: [...this.favoritos],
				usos: [...this.usos],
				valoraciones: Object.fromEntries(this.valoraciones),
				listas: this.listas,
				dispositivo: this.dispositivo
			})
		);
	}

	hayDatos(): boolean {
		return (
			this.favoritos.size > 0 ||
			this.usos.size > 0 ||
			this.valoraciones.size > 0 ||
			this.listas.some((l) => l.recursos.length > 0 || l.nombre)
		);
	}

	toggleFavorito(id: string): boolean {
		const ahora = !this.favoritos.has(id);
		if (ahora) this.favoritos.add(id);
		else this.favoritos.delete(id);
		this.guardar();
		return ahora;
	}

	toggleUso(id: string): boolean {
		const ahora = !this.usos.has(id);
		if (ahora) this.usos.add(id);
		else this.usos.delete(id);
		this.guardar();
		return ahora;
	}

	valorar(id: string, estrellas: number) {
		this.valoraciones.set(id, estrellas);
		this.guardar();
	}

	crearLista(nombre: string): ListaLocal {
		const lista: ListaLocal = { id: crypto.randomUUID(), nombre, recursos: [] };
		this.listas = [...this.listas, lista];
		this.guardar();
		return lista;
	}

	alternarEnLista(listaId: string, recursoId: string): boolean {
		let dentro = false;
		this.listas = this.listas.map((l) => {
			if (l.id !== listaId) return l;
			dentro = !l.recursos.includes(recursoId);
			return {
				...l,
				recursos: dentro ? [...l.recursos, recursoId] : l.recursos.filter((r) => r !== recursoId)
			};
		});
		this.guardar();
		return dentro;
	}

	borrarLista(listaId: string) {
		this.listas = this.listas.filter((l) => l.id !== listaId);
		this.guardar();
	}

	limpiar() {
		this.favoritos.clear();
		this.usos.clear();
		this.valoraciones.clear();
		this.listas = [];
		this.guardar();
	}
}

export const socialLocal = new SocialLocal();
