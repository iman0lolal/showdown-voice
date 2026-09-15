# Radiodown

Cliente de voz para [Pokémon Showdown](https://pokemonshowdown.com). Tú decides cada turno. Radiodown narra el estado, valida la jugada y solo envía `/choose` cuando confirmas.

No es un bot. No juega ladder solo. No hace clic en la web oficial.

**Producto:** app nativa iPhone (Voice Battle). **Secundario:** extensión de Chrome. **No:** Android. Esta demo web es el harness de desarrollo, no el producto.

Repositorio: https://github.com/iman0lolal/showdown-voice

[PokeCoachAI](https://github.com/iman0lolal/PokeCoachAI) es **otro** proyecto. Este repo no lo toca.

## Dónde estamos

| Fase | Estado |
|---|---|
| Battle Core TypeScript | Listo (oráculo + tests) |
| Viabilidad iOS | Listo — [`docs/IOS.md`](docs/IOS.md) |
| **Spec MVP iOS** | Listo — [`docs/IOS-MVP-SPEC.md`](docs/IOS-MVP-SPEC.md) |
| App Swift | **No.** Esperando `IMPLEMENT IOS MVP` |
| Chrome extension | Fase 8 — [`docs/CHROME.md`](docs/CHROME.md) |
| Android | **Cancelado** |

La experiencia objetivo:

```
Showdown en Safari → Voice Battle → START VOICE BATTLE
→ auto-join → AirPods → bloquear → voz → confirmación → /choose
```

Contrato técnico de esa prueba (arquitectura, audio, estados, límites, criterio de 10 turnos): **[`docs/IOS-MVP-SPEC.md`](docs/IOS-MVP-SPEC.md)**.

iOS = **port Swift del core**, no JavaScriptCore ni WASM. TypeScript se queda como oráculo y como core de Chrome.

## Núcleo

```
Pokémon Showdown (websocket)
        ↓
Battle Event Parser  →  Battle State
        ↓
Voice Session (narrar → escuchar → confirmar)
        ↓
Action Validator  →  /choose …
        ↓
Pokémon Showdown
```

La IA / heurística es opcional y **nunca ejecuta**. `requireConfirm` es invariante.

## Requisitos (oráculo)

- Node 22+ (`--experimental-strip-types`)
- Sin dependencias npm para el núcleo

```bash
git clone https://github.com/iman0lolal/showdown-voice.git
cd showdown-voice
npm test
npm run demo
```

No hay `.env`. El login de Showdown usa usuario/contraseña (en iOS, Keychain). No se suben secretos a este repo.

## ToS / bots

| Uso | ¿Aceptable aquí? |
|---|---|
| Cliente de voz: tú eliges, él envía `/choose` | Sí, por diseño |
| Lector de estado + recomendación | Sí, no ejecuta |
| Accessibility / OCR sobre la web oficial | No |
| Jugar ladder sin confirmación humana | No. `requireConfirm` es obligatorio |

## Licencia

MIT. Pokémon y Pokémon Showdown son marcas de sus respectivos dueños. Cliente no oficial.
