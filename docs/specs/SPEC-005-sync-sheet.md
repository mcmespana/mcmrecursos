# SPEC-005 · Sincronización Google Sheet → BD

> **Estado:** backend implementado y probado (migración 00005: `recursos.sync_filas`).
> Pendiente: crear el Sheet real y pegar el Apps Script de abajo (15 minutos).

## Diseño: la hoja manda (push, sin cron)

Nada se sincroniza a escondidas. El Sheet lleva un **indicador visual de estado**:
en cuanto alguien edita, pasa a 🟡 «Cambios sin publicar»; al pulsar
**Banco de Recursos → Sincronizar ahora**, las filas viajan a la BD y el indicador vuelve
a ✅ con la hora. El editor siempre sabe si su trabajo está publicado o no.

```
Sheet (editores) ──menú Sincronizar──▶ RPC recursos.sync_filas ──▶ Postgres
      ▲                                        │
      └──── ids nuevos escritos de vuelta ◀────┘
```

- **Upsert por `id`** (columna A). Filas sin id reciben `R####` y el script lo escribe
  de vuelta en la hoja. El id nunca se recicla.
- **Cabeceras por nombre, no por posición**: reordenar columnas es inocuo. Las cabeceras
  canónicas son las de `docs/seed/recursos_seed.csv`; una cabecera desconocida se ignora
  (cuando queramos, caerá en `extra`).
- **Nunca DELETE**: sincronizar con `retirar_ausentes=true` pasa a `retirado` lo que ya no
  esté en la hoja, conservando valoraciones/favoritos/accesos. El script lo pregunta antes.
- **Errores por fila sin abortar el resto**: el resultado lista `errores` con nº de fila.
- **Log**: cada sync queda en `recursos.sync_log` (visible para editores/admin).
- La **clave de sincronización** vive en `recursos.sync_config` (tabla sin políticas RLS,
  solo la lee la función). Consultarla/rotarla desde el SQL editor:
  `select clave from recursos.sync_config;`

## Montaje del Sheet (cuando se cree)

1. Pestaña **`Recursos`**: fila 1 = cabeceras de `docs/seed/recursos_seed.csv` (mismo
   nombre, cualquier orden). Pegar las filas de ejemplo si se quiere.
2. Pestaña **`Listas`**: pegar `docs/seed/listas_seed.csv` y crear las validaciones de
   datos (desplegables) de tipo/etapas/nivel/edades/idioma/soporte/ubicacion/estado/
   visibilidad apuntando a sus rangos. Multiselect (etapas, edades, tags): texto separado
   por comas — validación «se rechaza la entrada» NO, solo aviso.
3. Pestaña **`Sync`**: A1 = estado (lo escribe el script), A2 = última sincronización.
4. **Extensiones → Apps Script**: pegar el código de abajo. En ⚙️ Configuración del
   proyecto → Propiedades del script, añadir `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
   `SYNC_CLAVE` (los tres valores están en `app/.env` / dashboard / sync_config).
5. Recargar el Sheet: aparece el menú **Banco de Recursos**.

## Apps Script (completo, listo para pegar)

```javascript
const HOJA_RECURSOS = 'Recursos';
const HOJA_SYNC = 'Sync';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Banco de Recursos')
    .addItem('Sincronizar ahora', 'sincronizar')
    .addItem('Sincronizar y retirar ausentes', 'sincronizarConRetirada')
    .addToUi();
}

// Trigger simple: cualquier edición en Recursos marca la hoja como pendiente.
function onEdit(e) {
  if (e.range.getSheet().getName() !== HOJA_RECURSOS) return;
  marcarEstado('🟡 Cambios sin publicar', '#fff3cd');
}

function marcarEstado(texto, color) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA_SYNC);
  hoja.getRange('A1').setValue(texto).setBackground(color).setFontWeight('bold');
}

function sincronizar() { ejecutarSync(false); }
function sincronizarConRetirada() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Retirar ausentes',
    'Los recursos que ya no estén en la hoja pasarán a estado "retirado" (no se borran). ¿Continuar?',
    ui.ButtonSet.OK_CANCEL);
  if (r === ui.Button.OK) ejecutarSync(true);
}

function ejecutarSync(retirarAusentes) {
  const props = PropertiesService.getScriptProperties();
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA_RECURSOS);
  const datos = hoja.getDataRange().getValues();
  const cabeceras = datos[0].map(String);
  const colId = cabeceras.indexOf('id');

  const filas = datos.slice(1)
    .filter((f) => f.some((c) => String(c).trim() !== ''))
    .map((f) => Object.fromEntries(cabeceras.map((c, i) => [c, String(f[i] ?? '')])));

  const res = UrlFetchApp.fetch(props.getProperty('SUPABASE_URL') + '/rest/v1/rpc/sync_filas', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      apikey: props.getProperty('SUPABASE_ANON_KEY'),
      'Content-Profile': 'recursos'
    },
    payload: JSON.stringify({
      clave_in: props.getProperty('SYNC_CLAVE'),
      filas: filas,
      retirar_ausentes: retirarAusentes
    })
  });

  if (res.getResponseCode() !== 200) {
    marcarEstado('🔴 Error al sincronizar', '#f8d7da');
    SpreadsheetApp.getUi().alert('Error: ' + res.getContentText().slice(0, 400));
    return;
  }

  const informe = JSON.parse(res.getContentText());

  // escribir de vuelta los ids asignados a filas nuevas
  (informe.ids_asignados || []).forEach((a) => {
    hoja.getRange(a.fila + 1, colId + 1).setValue(a.id);
  });

  const hojaSync = SpreadsheetApp.getActive().getSheetByName(HOJA_SYNC);
  hojaSync.getRange('A2').setValue('Última sync: ' + new Date().toLocaleString('es-ES'));

  if ((informe.errores || []).length) {
    marcarEstado(`🟠 Publicado con ${informe.errores.length} errores`, '#ffe5d0');
    SpreadsheetApp.getUi().alert(
      'Errores:\n' + informe.errores.map((e) => `Fila ${e.fila}: ${e.error}`).join('\n').slice(0, 600)
    );
  } else {
    marcarEstado('✅ Publicado', '#d1e7dd');
  }
  SpreadsheetApp.getActive().toast(
    `${informe.creadas} creados · ${informe.actualizadas} actualizados · ${informe.retiradas} retirados`,
    'Sincronización'
  );
}
```

## Probado (2026-07-19, sin Sheet, vía REST)

- [x] Upsert de fila existente (R0005) y alta sin id → asigna `R0009` y lo devuelve.
- [x] Tags fusionados por slug («ejemplo» → tag existente «Ejemplo»).
- [x] Autores y relacionados enlazados; relaciones a ids inexistentes se ignoran.
- [x] Clave incorrecta → rechazo con error claro.
- [x] Log de sync escrito en `recursos.sync_log`.

## Pendiente / futuro

- Crear el Sheet real y pegar el script (arriba).
- Escritura inversa BD → Sheet cuando se edite desde la web (fase 3).
- Botón "Sincronizar" también en `/admin` (leyendo el Sheet con cuenta de servicio) si
  algún día se quiere disparar desde la web además de desde la hoja.
