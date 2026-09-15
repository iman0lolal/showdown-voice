import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateAndChoose } from "./choose.ts";
import { parseChoiceRequest } from "../battle/request.ts";
import { GARCHOMP_MOVE_REQUEST } from "../fixtures/garchomp-rotom.ts";

const request = parseChoiceRequest(JSON.stringify(GARCHOMP_MOVE_REQUEST));

describe("validateAndChoose", () => {
  it("builds /choose move earthquake|rqid", () => {
    const result = validateAndChoose(
      { type: "move", move: "Terremoto", moveId: "earthquake" },
      request,
    );
    assert.equal(result.ok, true);
    assert.equal(result.choose, "/choose move earthquake|8");
  });

  it("appends terastallize when legal", () => {
    const result = validateAndChoose(
      { type: "move", move: "Earthquake", moveId: "earthquake", terastallize: true },
      request,
    );
    assert.equal(result.ok, true);
    assert.equal(result.choose, "/choose move earthquake terastallize|8");
  });

  it("rejects illegal moves instead of clicking blindly", () => {
    const result = validateAndChoose(
      { type: "move", move: "Splash", moveId: "splash" },
      request,
    );
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /no está/);
  });

  it("resolves switch by name to 1-based slot", () => {
    const result = validateAndChoose({ type: "switch", pokemon: "Gholdengo" }, request);
    assert.equal(result.ok, true);
    assert.equal(result.choose, "/choose switch 2|8");
  });

  it("asks for clarification on empty switch", () => {
    const result = validateAndChoose({ type: "switch", pokemon: "" }, request);
    assert.equal(result.ok, false);
    assert.ok(result.needsClarification);
  });

  it("refuses fainted pokemon", () => {
    const result = validateAndChoose({ type: "switch", pokemon: "Cinderace" }, request);
    assert.equal(result.ok, false);
  });
});
