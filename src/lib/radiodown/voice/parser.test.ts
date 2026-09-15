import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseVoiceCommand } from "./parser.ts";
import { parseChoiceRequest } from "../battle/request.ts";
import { GARCHOMP_MOVE_REQUEST } from "../fixtures/garchomp-rotom.ts";
import { createBattleState } from "../battle/engine.ts";

const request = parseChoiceRequest(JSON.stringify(GARCHOMP_MOVE_REQUEST));
const ctx = { state: createBattleState(), request };

describe("parseVoiceCommand", () => {
  it("treats Spanish variants as Earthquake", () => {
    for (const phrase of ["Terremoto", "usa terremoto", "haz terremoto", "ataca con terremoto", "quiero terremoto"]) {
      const intent = parseVoiceCommand(phrase, ctx);
      assert.equal(intent.kind, "action");
      if (intent.kind === "action" && intent.action.type === "move") {
        assert.equal(intent.action.moveId, "earthquake");
      }
    }
  });

  it("parses tera + move", () => {
    const intent = parseVoiceCommand("Tera y usa Earthquake", ctx);
    assert.equal(intent.kind, "action");
    if (intent.kind === "action" && intent.action.type === "move") {
      assert.equal(intent.action.moveId, "earthquake");
      assert.equal(intent.action.terastallize, true);
    }
  });

  it("parses switch in Spanish", () => {
    const intent = parseVoiceCommand("Cambio a Gholdengo", ctx);
    assert.equal(intent.kind, "action");
    if (intent.kind === "action") {
      assert.equal(intent.action.type, "switch");
      if (intent.action.type === "switch") assert.equal(intent.action.pokemon, "gholdengo");
    }
  });

  it("asks which pokemon when switch is bare", () => {
    const intent = parseVoiceCommand("Cambia", ctx);
    assert.equal(intent.kind, "action");
    if (intent.kind === "action" && intent.action.type === "switch") {
      assert.equal(intent.action.pokemon, "");
    }
  });

  it("maps confirm / deny / rec", () => {
    assert.equal(parseVoiceCommand("sí", ctx).kind, "confirm");
    assert.equal(parseVoiceCommand("hazlo", ctx).kind, "confirm");
    assert.equal(parseVoiceCommand("cancelar", ctx).kind, "deny");
    assert.equal(parseVoiceCommand("Haz la recomendación", ctx).kind, "accept_recommendation");
  });

  it("maps situation queries", () => {
    assert.equal(parseVoiceCommand("¿Qué tiene el rival?", ctx).kind, "query");
    assert.equal(parseVoiceCommand("¿Qué puedo hacer?", ctx).kind, "query");
    assert.equal(parseVoiceCommand("Dime las opciones", ctx).kind, "query");
  });
});
