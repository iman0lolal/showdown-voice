# Chrome extension — plataforma secundaria (Fase 8)

No se implementa hasta que iOS funcione. Este documento es la investigación.

## Veredicto

**Sí.** Una extensión MV3 puede ser Voice Battle en el escritorio:

- Detectar la battle room por la URL (`play.pokemonshowdown.com/battle-*`) — más fácil que iOS.
- O loguearse como el mismo usuario y unirse vía `|updatesearch|` / websocket propio.
- Micrófono + TTS en un **offscreen document**.
- Enviar `/choose` por el websocket propio (no clicar el DOM).
- `requireConfirm = true` igual que iOS.

Chrome en iPhone **no sirve**: es WebKit, sin extensiones.

## Auto-detect

| Fuente | Cómo | Preferencia |
|---|---|---|
| Content script | `location.pathname` / `chrome.tabs` → `battle-gen9…` | Primaria. Cero login extra si ya estás en la pestaña. |
| Websocket propio | misma cuenta + `\|updatesearch\|` | Si Voice Battle corre sin la pestaña de Showdown. |
| Mensaje al page world | leer `app.curRoom.id` del cliente oficial | Frágil ante cambios del cliente. Evitar si hay URL. |

No OCR. No simular clicks en los botones de movimiento.

Arquitectura recomendada: **la extensión ES el segundo cliente** (como iOS). La pestaña oficial puede quedar abierta; `/choose` lo manda la extensión. Si el usuario también clica en la página, hay carrera — documentar “deja que hable la extensión”.

Inyectar en el websocket de la página es posible (`debugger` / monkey-patch) y peor: frágil, y Review de Chrome lo odia.

## APIs MV3

```
permissions: ["offscreen", "storage", "tabs", "alarms"]
host_permissions: [
  "wss://*.psim.us/*",
  "https://play.pokemonshowdown.com/*"
]
content_scripts: play.pokemonshowdown.com
```

| Pieza | Dónde | Por qué |
|---|---|---|
| Detección de URL | content script + service worker | El SW no ve el DOM; el content script sí |
| WebSocket Showdown | offscreen document | El SW se duerme; un socket en el SW se corta |
| Micrófono `getUserMedia` | offscreen (`USER_MEDIA`) | El SW no tiene DOM. Hay que **conceder el permiso en una página visible** (options / popup) una vez; después el offscreen puede capturar |
| TTS | offscreen (`AUDIO_PLAYBACK`) | `speechSynthesis` necesita documento |
| Core TS | bundle en offscreen | El core ya es portable, sin DOM |

Heartbeat: `chrome.alarms` no basta para un combate. El offscreen de audio mantiene el contexto. Si el usuario cierra Chrome, se acabó — no hay equivalente al lock-screen de iOS, y no hace falta.

## UX

Toolbar / popup:

```
VOICE BATTLE
  🟢 Ready · battle-gen9randombattle-…
  [ START VOICE BATTLE ]
```

En combate: overlay mínimo o solo popup + voz. El producto sigue siendo auriculares, no un HUD encima de Showdown.

## Límites honestos

- El SW MV3 **no** puede ser el proceso de la batalla. Offscreen sí.
- Permiso de micrófono: una vez, origen de la extensión, página visible.
- Chrome puede pausar audio en pestaña de fondo agresivo; offscreen con `AUDIO_PLAYBACK` es el mecanismo soportado.
- No hay pantalla bloqueada de portátil comparable a iOS; si el OS duerme, el socket muere.
- Edge/Chromium: mismo diseño. Firefox: APIs distintas; fuera de alcance.

## Relación con el core

```
Battle Core (TypeScript)
   ├── iOS  (port Swift; TS = oráculo)
   ├── Chrome extension (TS directo)
   └── CLI / web harness (TS directo)
```

Fase 8. No antes.
