import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseProtocolLine, parseProtocolPayload } from "./parse-line.ts";

describe("parseProtocolLine", () => {
  it("parses a move with target", () => {
    const ev = parseProtocolLine("|move|p1a: Garchomp|Earthquake|p2a: Rotom-Wash");
    assert.ok(ev);
    assert.equal(ev.type, "move");
    assert.deepEqual(ev.args, ["p1a: Garchomp", "Earthquake", "p2a: Rotom-Wash"]);
  });

  it("parses keyword args", () => {
    const ev = parseProtocolLine("|-damage|p1a: Zarude|28/100|[from] item: Leftovers");
    assert.ok(ev);
    assert.equal(ev.type, "-damage");
    assert.equal(ev.args[1], "28/100");
    assert.equal(ev.kwArgs.from, "item: Leftovers");
  });

  it("parses request json without splitting inside", () => {
    const ev = parseProtocolLine('|request|{"active":[{"moves":[{"move":"Protect"}]}]}');
    assert.ok(ev);
    assert.equal(ev.type, "request");
    assert.ok(ev.args[0]?.includes('"Protect"'));
  });
});

describe("parseProtocolPayload", () => {
  it("splits room-scoped chunks", () => {
    const chunks = parseProtocolPayload(">battle-gen9ou-1\n|turn|8\n|move|p1a: A|Protect|p1a: A\n");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.roomId, "battle-gen9ou-1");
    assert.equal(chunks[0]?.events[0]?.type, "turn");
  });

  it("unwraps sockjs arrays", () => {
    const payload = `a${JSON.stringify(["|challstr|4|abc"])}`;
    const chunks = parseProtocolPayload(payload);
    assert.equal(chunks[0]?.events[0]?.type, "challstr");
    assert.equal(chunks[0]?.events[0]?.args[0], "4");
  });
});
