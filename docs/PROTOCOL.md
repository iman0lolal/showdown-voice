# Protocolo de Pokémon Showdown (comprobado 2026-09)

No existe una API REST de batallas en vivo. El canal es el websocket.

## Descubrimiento del servidor

No asumas `sim3` para siempre. El cliente oficial lee `play.pokemonshowdown.com/config/config.js`:

```
Config.defaultserver = {
  id: 'showdown',
  host: 'sim3.psim.us',
  port: 443,
  httpport: 8000
}
```

Radiodown parsea ese JS (`parseDefaultServerFromConfigJs`) y cae a `wss://sim3.psim.us/showdown/websocket` si no hay red.

PROTOCOL.md también documenta `ws://sim3.psim.us:8000/showdown/websocket`.

## Transporte

- Cliente → servidor: `ROOMID|TEXT`
- Servidor → cliente: `>ROOMID` + líneas `|TYPE|data`
- SockJS: `o` (open), `h` (heartbeat), `a["…"]` (payload). Ignorar `o`/`h`.
- Keepalive del cliente oficial: `|/cmd ping` si no llega nada ~20s.

## Login

1. `|challstr|CHALLSTR` (`CHALLSTR` contiene `|`)
2. Cuenta: POST `https://play.pokemonshowdown.com/api/login` `name`, `pass`, `challstr`
3. Invitado: GET `https://play.pokemonshowdown.com/api/getassertion?userid=&challstr=`
4. Respuesta `]` + JSON → `/trn USERNAME,0,ASSERTION`
5. Sesión: GET `api/upkeep?challstr=`

Un `User` puede tener varias `Connection` (Safari + app nativa). Tras `/trn`, el servidor fusiona la conexión en ese usuario.

## `|updatesearch|` — batallas activas (auto-join)

```
|updatesearch|{"searching":["gen9randombattle"],"games":{"battle-gen9randombattle-123":"A vs. B"}}
```

- `searching`: formatos en cola.
- `games`: `{roomid: title}` o `null`. Incluye Mafia y otros; filtrar `battle-*`.
- Llega al login y cada vez que cambia una búsqueda o una partida.

START VOICE BATTLE: `/trn` → leer `games` → `/join battle-…`. No hace falta que Safari nos avise. Invitados de Safari ≠ invitados de la app: hace falta cuenta con nombre.

Core: `parseUpdateSearch`, `planVoiceBattleJoin`.

## Reconexión

El protocolo no tiene un frame “resume”. El cliente oficial abre un socket nuevo, espera `|challstr|`, vuelve a `/trn` y `/join battle-…`. El servidor reenvía el log de la sala y el `|request|` actual. Radiodown: `reconnectCommands` + `VoiceSession.restoreFromLog`.

## `|request|` = fuente de verdad de la decisión

Privado del jugador. Los replays públicos no lo incluyen.

Campos que usamos: `active[].moves` (id, pp, maxpp, target, disabled), `canTerastallize`, `canMegaEvo*`, `canZMove`, `canDynamax`, `trapped`, `maybeTrapped`, `side.pokemon` (ident, details, condition, active, item, ability, moves, teraType), `forceSwitch`, `wait`, `teamPreview`, `rqid`.

`/choose` solo se construye contra ese objeto. Un movimiento que no está ahí no se envía.

## `/choose` (SIM-PROTOCOL + cliente oficial)

- Singles: `move earthquake` — **sin** target
- Tera: `move earthquake terastallize` (el cliente oficial usa `terastallize`, no `terastalize`)
- Mega / Z / Dmax: `mega` / `zmove` / `max`
- Cambio: `switch N` (1-based en `side.pokemon`)
- Doubles: `move thunderbolt +1, move helpinghand -1` (arquitectura lista; el MVP no juega doubles)

## Eventos de batalla

Implementados en el motor: `player`, `teamsize`, `gametype`, `gen`, `tier`, `rated`, `rule`, `poke`, `start`, `turn`, `request`, `switch`, `drag`, `replace`, `detailschange`, `move`, `-damage`, `-heal`, `-sethp`, `-status`, `-curestatus`, `-boost`, `-unboost`, `-setboost`, clearboosts, `-weather`, `-fieldstart/end`, `-sidestart/end`, `-ability`, `-item`, `-enditem`, `-terastallize`, `-mega`, `-burst`, `faint`, `-start/end`, `-immune`, `-resisted`, `-supereffective`, `-crit`, `-miss`, `-fail`, `-activate`, `cant`, `win`, `tie`, `error`, `split`.

MVP no necesita animaciones (`-anim`, `-zpower`, `-hitcount`, …): no cambian la decisión legal.

## Soporte de formato

```
supported now: singles (Random Battle / OU fixtures)
data model:    singles | doubles | triples | multi
playable MVP:  singles only
```
