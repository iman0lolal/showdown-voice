import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BattleEngine } from "./engine.ts";
import { parseProtocolPayload } from "../protocol/parse-line.ts";
import { FOESKII_REPLAY } from "../fixtures/foeskii-replay.ts";
import { GARCHOMP_ROTOM_LOG, GARCHOMP_MOVE_REQUEST } from "../fixtures/garchomp-rotom.ts";
import { parseChoiceRequest } from "./request.ts";

function feed(log: string) {
  const engine = new BattleEngine();
  for (const chunk of parseProtocolPayload(log)) engine.feed(chunk.events);
  return engine;
}

describe("BattleEngine + real replay fixture", () => {
  it("tracks turn, HP, faint, tera, weather, hazards, known moves", () => {
    const engine = feed(FOESKII_REPLAY);
    const s = engine.state;
    assert.equal(s.gen, 9);
    assert.equal(s.gameType, "singles");
    assert.equal(s.p1.name, "Foeskii");
    assert.equal(s.p2.name, "pichulover874");
    assert.equal(s.turn, 11);
    assert.equal(s.rated, true);

    const zarude = s.p1.pokemon.find((p) => p.species === "Zarude");
    assert.ok(zarude);
    assert.equal(zarude.fainted, true);
    assert.equal(zarude.hp.percent, 0);
    assert.ok(zarude.moves.some((m) => m.id === "bulkup"));

    const manaphy = s.p1.pokemon.find((p) => p.species === "Manaphy");
    assert.ok(manaphy);
    assert.equal(manaphy.terastallized, true);
    assert.equal(manaphy.teraType, "Ground");
    assert.equal(manaphy.active, true);

    const krook = s.p2.pokemon.find((p) => p.species === "Krookodile");
    assert.ok(krook);
    assert.equal(krook.ability, "Intimidate");
    assert.ok(krook.moves.some((m) => m.id === "closecombat"));

    const corvi = s.p2.pokemon.find((p) => p.species === "Corviknight");
    assert.ok(corvi);
    assert.equal(corvi.item, null);
    assert.equal(corvi.itemKnown, true);

    assert.equal(s.field.weather?.id, "sunnyday");
    assert.equal(s.p1.hazards.stealthRock, true);
  });
});

describe("BattleEngine + synthetic request", () => {
  it("applies a |request| and perspective", () => {
    const engine = feed(GARCHOMP_ROTOM_LOG);
    engine.setRequest(parseChoiceRequest(JSON.stringify(GARCHOMP_MOVE_REQUEST)));
    const s = engine.state;
    assert.equal(s.perspective, "p1");
    assert.equal(s.turn, 8);
    const garchomp = s.p1.pokemon.find((p) => p.species === "Garchomp");
    assert.ok(garchomp);
    assert.equal(garchomp.active, true);
    assert.equal(garchomp.status, "brn");
    assert.equal(s.request?.kind, "move");
    assert.equal(s.request?.active?.[0]?.moves.length, 4);
    const rotom = s.p2.pokemon.find((p) => p.species.startsWith("Rotom"));
    assert.ok(rotom);
    assert.equal(rotom.hp.percent, 64);
    assert.ok(rotom.moves.some((m) => m.id === "hydropump"));
  });
});
