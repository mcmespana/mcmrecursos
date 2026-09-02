# 005 · Publicar la paleta categórica de familias como tokens

**Superficie:** global · **Riesgo:** bajo · **Depende de:** nada

## Contexto

`docs/04-diseno.md` §2 describe en prosa la paleta por familia de tipo —Sesiones=teal,
Actividades=verde, Celebración=violeta, Audiovisual=ámbar, Documentos=gris-azul— y dice que
«se validará con `validate_palette.js` (CVD ΔE ≥ 8) en claro y oscuro **antes de fijarla en
código**».

Mientras siga en prosa, cada componente que pinte una familia se inventa su tono, y la
promesa de validación no la puede comprobar nadie. `design.md` §3.9 pide paleta categórica
validada y §3.1 prohíbe el color fuera de tokens.

## Qué hacer

1. **Fijar los cinco valores en OKLCH**, claro y oscuro, en `app/src/app.css`:
   `--familia-sesiones`, `--familia-actividades`, `--familia-celebracion`,
   `--familia-audiovisual`, `--familia-documentos`, más sus `-bg` y `-fg` para el badge.
   Exponerlos en `@theme inline` como `--color-familia-*`.
2. **Validarlos**: contraste AA del texto del badge sobre su fondo en los dos temas, y
   separación perceptual ΔE ≥ 8 entre los cinco bajo las tres simulaciones de daltonismo
   (protanopia, deuteranopia, tritanopia). Si dos no separan, muévelos hasta que separen.
   Deja el resultado apuntado en `docs/04-diseno.md` §2 con fecha.
3. **Sustituir los tonos escritos a mano**:
   ```bash
   grep -rn "teal-\|violet-\|amber-\|emerald-\|slate-" app/src/lib/components --include=*.svelte
   ```
   Todo lo que pinte una familia pasa a `bg-familia-*`.
4. **El color sigue a la entidad, nunca a la posición** (`design.md` §3.9): el mapa
   familia → token vive en un solo sitio, no repartido por componentes.

## Qué NO tocar

`--warm`: es la capa social (estrellas, corazones, destacados), no una familia. No lo metas
en la paleta categórica ni lo uses como sexto color.

## Validación

`cd app && npm run check && npm run build`. Ver el catálogo con recursos de las cinco
familias, en claro y oscuro, y en un simulador de daltonismo. Comprobar que ningún badge de
familia usa ya un color de Tailwind por nombre.
