# 004 · Dos recuentos que se contradicen a 140 px (F2)

**Superficie:** catálogo · **Riesgo:** ninguno · **Depende de:** nada (se resuelve solo con `003`)

## Contexto

Hallazgo **F2** de `docs/06-reflexion-uiux.md`, marcado **alto y trivial de arreglar**:

- Bajo el titular: «**7 recursos** · 2 autores · 141 aperturas»
- Bajo las facetas: «**2 recursos**»

Los dos dicen «recursos», los dos son ciertos —uno es el total y el otro el resultado— pero
juntos en pantalla y sin distinguirse **se leen como un error**. Y la línea de arriba nunca
cambia, así que en cuanto filtras deja de significar nada.

## Qué hacer

Elegir una de las dos, no las dos:

- **Si ya has hecho el plan `003`**, el total se va con el héroe en cuanto hay filtro y el
  problema desaparece solo. Comprueba que es así y marca este plan como DONE.
- **Si no**, etiquetar distinto el total: «7 en el banco», y dejar el del resultado como
  «2 recursos». La palabra «recursos» aparece una sola vez.

En cualquiera de los dos casos, el recuento de resultados debe llevar `aria-live="polite"`
con el texto completo para quien escucha —«2 recursos encontrados con la búsqueda actual», no
«2»— si no lo lleva ya (`design.md` §3.7).

## Validación

`cd app && npm run check`. Buscar algo que devuelva menos resultados que el total y comprobar
que no hay dos cifras contradictorias a la vista. Probar con un lector de pantalla o con el
inspector de accesibilidad que el `aria-live` anuncia la frase entera. Actualizar F2 en
`docs/06-reflexion-uiux.md`.
