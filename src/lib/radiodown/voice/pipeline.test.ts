import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VoiceSession } from "./session.ts";
import { validateAndChoose } from "../action/choose.ts";
import { parseChoiceRequest } from "../battle/request.ts";
import { parseVoiceCommand } from "./parser.ts";
import { recommend } from "../recommend/rules.ts";
import { reconnectCommands, parseDefaultServerFromConfigJs, websocketUrl } from "../showdown/client.ts";
import { canSendChoose } from "../lifecycle.ts";
import {
  GARCHOMP_MOVE_REQUEST,
  GARCHOMP_ROTOM_LOG,
  FORCE_SWITCH_REQUEST,
  NO_TERA_REQUEST,
} from "../fixtures/garchomp-rotom.ts";
import { DOUBLES_MOVE_REQUEST } from "../fixtures/doubles-request.ts";
import { createBattleState } from "../battle/engine.ts";

function primed() {
  const session = new VoiceSession();
  session.ingest(GARCHOMP_ROTOM_LOG);
  session.ingest(`|request|${JSON.stringify(GARCHOMP_MOVE_REQUEST)}`);
  return session;
}

describe("integration pipeline", () => {
  it("request → parse → state → voice → validate → confirm → /choose", () => {
    const sent: string[] = [];
    const session = primed();
    session.onExecute = (c: string) => sent.push(c);
    const t0 = performance.now();
    session.hear("usa terremoto");
    const reply = session.hear("sí");
    const ms = performance.now() - t0;
    assert.equal(sent[0], "/choose move earthquake|8");
    assert.match(reply.speak, /Ejecutando/);
    assert.ok(ms < 50, `voice→choose took ${ms}ms`);
  });

  it("recommendation never has a choose string and never auto-sends", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c: string) => sent.push(c);
    const rec = recommend(session.state, "es");
    assert.ok(rec);
    assert.equal("choose" in rec, false);
    assert.ok(rec.recommendedAction);
    session.hear("recomienda");
    assert.equal(sent.length, 0);
    session.hear("Haz la recomendación");
    assert.equal(sent.length, 0);
    assert.equal(session.phase, "confirming");
  });

  it("illegal move is not turned into /choose", () => {
    const request = parseChoiceRequest(JSON.stringify(GARCHOMP_MOVE_REQUEST));
    const result = validateAndChoose({ type: "move", move: "Splash", moveId: "splash" }, request);
    assert.equal(result.ok, false);
    assert.equal(result.choose, undefined);
  });

  it("fainted pokemon cannot switch in", () => {
    const request = parseChoiceRequest(JSON.stringify(GARCHOMP_MOVE_REQUEST));
    const result = validateAndChoose({ type: "switch", pokemon: "Cinderace" }, request);
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /debilitado|no está disponible/);
  });

  it("forced switch rejects a move", () => {
    const request = parseChoiceRequest(JSON.stringify(FORCE_SWITCH_REQUEST));
    const result = validateAndChoose({ type: "move", move: "Earthquake", moveId: "earthquake" }, request);
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /cambiar/);
  });

  it("illegal tera is rejected", () => {
    const request = parseChoiceRequest(JSON.stringify(NO_TERA_REQUEST));
    const result = validateAndChoose(
      { type: "move", move: "Earthquake", moveId: "earthquake", terastallize: true },
      request,
    );
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /Teracristal/);
  });

  it("ended battle cannot execute", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c: string) => sent.push(c);
    session.ingest("|win|Rival");
    session.hear("Terremoto");
    session.hear("sí");
    assert.equal(sent.length, 0);
    assert.equal(session.phase, "ended");
  });

  it("second confirm after send does not double-fire", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c: string) => sent.push(c);
    session.hear("Terremoto");
    session.hear("sí");
    session.hear("sí");
    assert.equal(sent.length, 1);
  });

  it("cancel after pending does not send", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c: string) => sent.push(c);
    session.hear("Protect");
    session.hear("no, espera");
    assert.equal(sent.length, 0);
  });

  it("STT hedge still requires confirm", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c: string) => sent.push(c);
    const reply = session.hear("creo que terremoto");
    assert.equal(sent.length, 0);
    assert.equal(session.phase, "confirming");
    assert.match(reply.speak, /Confirmas/);
  });

  it("waiting_result blocks a new action", () => {
    const session = primed();
    const sent: string[] = [];
    session.onExecute = (c: string) => sent.push(c);
    session.hear("Terremoto");
    session.hear("sí");
    session.hear("Protect");
    assert.equal(sent.length, 1);
  });
});

describe("reconnect restore", () => {
  it("replays the log and can continue the voice loop", () => {
    const session = primed();
    session.hear("Terremoto");
    const payload = `${GARCHOMP_ROTOM_LOG}\n|request|${JSON.stringify(GARCHOMP_MOVE_REQUEST)}`;
    session.restoreFromLog(payload);
    const sent: string[] = [];
    session.onExecute = (c: string) => sent.push(c);
    session.hear("Terremoto");
    session.hear("sí");
    assert.equal(sent[0], "/choose move earthquake|8");
  });

  it("reconnectCommands re-auth and rejoin the battle room", () => {
    const cmds = reconnectCommands({
      username: "RadioTrainer",
      assertion: "ASSERT",
      roomId: "battle-gen9randombattle-1",
    });
    assert.equal(cmds[0], "|/trn RadioTrainer,0,ASSERT");
    assert.equal(cmds[1], "|/join battle-gen9randombattle-1");
  });
});

describe("doubles target encoding", () => {
  it("singles omits target even if spoken", () => {
    const request = parseChoiceRequest(JSON.stringify(GARCHOMP_MOVE_REQUEST));
    const result = validateAndChoose(
      { type: "move", move: "Dragon Claw", moveId: "dragonclaw", target: { kind: "foe", slot: 1 } },
      request,
      { gameType: "singles" },
    );
    assert.equal(result.ok, true);
    assert.equal(result.choose, "/choose move dragonclaw|8");
  });

  it("doubles chosen-target move asks if missing", () => {
    const request = parseChoiceRequest(JSON.stringify(DOUBLES_MOVE_REQUEST));
    const result = validateAndChoose(
      { type: "move", move: "Dragon Claw", moveId: "dragonclaw" },
      request,
      { gameType: "doubles" },
    );
    assert.equal(result.ok, false);
    assert.ok(result.needsClarification);
  });

  it("doubles encodes +1 for a foe slot", () => {
    const request = parseChoiceRequest(JSON.stringify(DOUBLES_MOVE_REQUEST));
    const result = validateAndChoose(
      { type: "move", move: "Dragon Claw", moveId: "dragonclaw", target: { kind: "foe", slot: 1 } },
      request,
      { gameType: "doubles" },
    );
    assert.equal(result.ok, true);
    assert.equal(result.choose, "/choose move dragonclaw +1|4");
  });

  it("doubles ally target uses -1", () => {
    const request = parseChoiceRequest(JSON.stringify(DOUBLES_MOVE_REQUEST));
    const result = validateAndChoose(
      { type: "move", move: "Helping Hand", moveId: "helpinghand", activeSlot: 1, target: { kind: "ally", slot: 1 } },
      request,
      { gameType: "doubles" },
    );
    assert.equal(result.ok, true);
    assert.equal(result.choose, "/choose move helpinghand -1|4");
  });
});

describe("server discovery", () => {
  it("parses Config.defaultserver from the official config.js shape", () => {
    const js = `Config.defaultserver = { id: 'showdown', host: 'sim3.psim.us', port: 443, httpport: 8000 };`;
    const server = parseDefaultServerFromConfigJs(js);
    assert.ok(server);
    assert.equal(server.host, "sim3.psim.us");
    assert.equal(websocketUrl(server), "wss://sim3.psim.us/showdown/websocket");
  });
});

describe("lifecycle gate", () => {
  it("blocks send unless pending confirmation", () => {
    const blocked = canSendChoose({
      battle: "AWAITING_USER_ACTION",
      ended: false,
      hasLiveRequest: true,
    });
    assert.equal(blocked.ok, false);
    const ok = canSendChoose({
      battle: "ACTION_PENDING_CONFIRMATION",
      ended: false,
      hasLiveRequest: true,
    });
    assert.equal(ok.ok, true);
  });
});

describe("voice phrases", () => {
  const ctx = { state: createBattleState(), request: parseChoiceRequest(JSON.stringify(GARCHOMP_MOVE_REQUEST)) };
  it("maps the documented command set", () => {
    const phrases = [
      "Terremoto",
      "Usa terremoto",
      "Ataca con terremoto",
      "Earthquake",
      "Use earthquake",
      "Haz terremoto",
      "Protect",
      "Usa protect",
      "Cambio a Gholdengo",
      "Cambia a Gholdengo",
      "Switch Gholdengo",
      "Tera y Earthquake",
      "Teracristaliza y usa terremoto",
    ];
    for (const p of phrases) {
      const intent = parseVoiceCommand(p, ctx);
      assert.equal(intent.kind, "action", p);
    }
  });
});
