import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VoiceSession } from "./session.ts";
import { GARCHOMP_MOVE_REQUEST, GARCHOMP_ROTOM_LOG } from "../fixtures/garchomp-rotom.ts";

describe("VoiceSession confirmation loop", () => {
  function primed() {
    const session = new VoiceSession();
    session.ingest(GARCHOMP_ROTOM_LOG);
    session.ingest(`|request|${JSON.stringify(GARCHOMP_MOVE_REQUEST)}`);
    return session;
  }

  it("never executes on first recognition", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c) => sent.push(c);
    const reply = session.hear("Terremoto");
    assert.equal(session.phase, "confirming");
    assert.equal(sent.length, 0);
    assert.match(reply.speak, /Confirmas|Confirm/i);
    assert.ok(reply.speak.toLowerCase().includes("earthquake"));
  });

  it("executes only after sí", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c) => sent.push(c);
    session.hear("Terremoto");
    const reply = session.hear("sí");
    assert.equal(sent[0], "/choose move earthquake|8");
    assert.match(reply.speak, /Ejecutando/);
    assert.equal(session.phase, "waiting_result");
  });

  it("cancel does not send", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c) => sent.push(c);
    session.hear("Protect");
    session.hear("cancelar");
    assert.equal(sent.length, 0);
    assert.equal(session.phase, "awaiting_command");
  });

  it("does not auto-send a recommendation", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c) => sent.push(c);
    const rec = session.hear("recomienda");
    assert.equal(sent.length, 0);
    assert.match(rec.speak, /recomend/i);
    session.hear("Haz la recomendación");
    assert.equal(sent.length, 0);
    assert.equal(session.phase, "confirming");
    session.hear("hazlo");
    assert.equal(sent.length, 1);
  });

  it("answers opponent query without executing", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c) => sent.push(c);
    const reply = session.hear("¿Qué tiene el rival?");
    assert.equal(sent.length, 0);
    assert.match(reply.speak, /Rotom/i);
    assert.match(reply.speak, /Hydro Pump|Will-O-Wisp|Volt Switch/i);
  });
});
