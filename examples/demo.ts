/**
 * Offline voice loop. No network, no Showdown login.
 *
 *   node --experimental-strip-types examples/demo.ts
 *
 * Demonstrates: narrate → hear "Terremoto" → confirm "sí" → /choose
 * A recommendation is spoken but never sent until you confirm.
 */
import { VoiceSession } from "../src/lib/voxdown/voice/session.ts";
import {
  AFTER_EARTHQUAKE_LOG,
  GARCHOMP_MOVE_REQUEST,
  GARCHOMP_ROTOM_LOG,
  TURN9_REQUEST,
} from "../src/lib/voxdown/fixtures/garchomp-rotom.ts";

const session = new VoiceSession();
session.onExecute = (choose) => {
  console.log(`\n>>> SHOWDOWN  ${choose}\n`);
};

function say(who: string, text: string) {
  console.log(`${who}  ${text}`);
}

say("LOG", "Cargando turno 8 (Garchomp vs Rotom-Wash)…");
const intro = session.ingest(GARCHOMP_ROTOM_LOG);
session.ingest(`|request|${JSON.stringify(GARCHOMP_MOVE_REQUEST)}`);
if (intro) say("ASISTENTE", intro.speak);

const rec = session.hear("recomienda");
say("YO", "recomienda");
say("ASISTENTE", rec.speak);

say("YO", "Terremoto");
say("ASISTENTE", session.hear("Terremoto").speak);

say("YO", "sí");
say("ASISTENTE", session.hear("sí").speak);

say("LOG", "Showdown responde: Volt Switch → Corviknight.");
session.ingest(AFTER_EARTHQUAKE_LOG);
const next = session.ingest(`|request|${JSON.stringify(TURN9_REQUEST)}`);
if (next) say("ASISTENTE", next.speak);
