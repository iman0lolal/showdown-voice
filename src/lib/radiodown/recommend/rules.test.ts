import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { typeEffectiveness } from "./type-chart.ts";
import { BattleEngine } from "../battle/engine.ts";
import { parseProtocolPayload } from "../protocol/parse-line.ts";
import { parseChoiceRequest } from "../battle/request.ts";
import { GARCHOMP_MOVE_REQUEST, GARCHOMP_ROTOM_LOG } from "../fixtures/garchomp-rotom.ts";
import { recommend } from "./rules.ts";

describe("type chart", () => {
  it("Ground vs Electric/Water is 2x (Water is neutral to Ground)", () => {
    assert.equal(typeEffectiveness("Ground", ["Electric", "Water"]), 2);
  });
  it("Dragon vs Fairy is 0", () => {
    assert.equal(typeEffectiveness("Dragon", ["Fairy"]), 0);
  });
});

describe("rule recommender", () => {
  it("prefers Earthquake vs Rotom-Wash and does not execute", () => {
    const engine = new BattleEngine();
    for (const chunk of parseProtocolPayload(GARCHOMP_ROTOM_LOG)) engine.feed(chunk.events);
    engine.setRequest(parseChoiceRequest(JSON.stringify(GARCHOMP_MOVE_REQUEST)));
    const rec = recommend(engine.state, "es");
    assert.ok(rec);
    assert.equal(rec.action.type, "move");
    if (rec.action.type === "move") assert.equal(rec.action.moveId, "earthquake");
    assert.match(rec.why, /Earthquake|Terremoto|efectivo/i);
  });
});
