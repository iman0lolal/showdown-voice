import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseUpdateSearch,
  battleRoomsFromSearch,
  planVoiceBattleJoin,
  isBattleRoomId,
} from "./client.ts";

describe("parseUpdateSearch", () => {
  it("parses a live battle room", () => {
    const line =
      '|updatesearch|{"searching":[],"games":{"battle-gen9randombattle-12345":"RadioTrainer vs. Rival"}}';
    const search = parseUpdateSearch(line);
    assert.ok(search);
    assert.deepEqual(search.searching, []);
    assert.equal(search.games?.["battle-gen9randombattle-12345"], "RadioTrainer vs. Rival");
  });

  it("treats games:null as no rooms", () => {
    const search = parseUpdateSearch('|updatesearch|{"searching":["gen9randombattle"],"games":null}');
    assert.ok(search);
    assert.deepEqual(search.searching, ["gen9randombattle"]);
    assert.equal(search.games, null);
    assert.deepEqual(battleRoomsFromSearch(search), []);
  });

  it("ignores non-battle games such as Mafia", () => {
    const search = parseUpdateSearch(
      '|updatesearch|{"searching":[],"games":{"mafia-1":"Mafia","battle-gen9ou-9":"A vs. B"}}',
    );
    assert.ok(search);
    const rooms = battleRoomsFromSearch(search);
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0]?.roomId, "battle-gen9ou-9");
  });

  it("returns null on garbage", () => {
    assert.equal(parseUpdateSearch("|updatesearch|{nope"), null);
    assert.equal(parseUpdateSearch("|updateuser|x|1"), null);
  });
});

describe("planVoiceBattleJoin", () => {
  it("joins the single active battle (START VOICE BATTLE happy path)", () => {
    const plan = planVoiceBattleJoin({
      searching: [],
      games: { "battle-gen9randombattle-1": "You vs. Them" },
    });
    assert.equal(plan.action, "join");
    if (plan.action === "join") {
      assert.equal(plan.roomId, "battle-gen9randombattle-1");
      assert.equal(plan.title, "You vs. Them");
    }
  });

  it("asks when several battles are open", () => {
    const plan = planVoiceBattleJoin({
      searching: [],
      games: {
        "battle-gen9randombattle-1": "A vs. B",
        "battle-gen9ou-2": "A vs. C",
      },
    });
    assert.equal(plan.action, "choose");
    if (plan.action === "choose") assert.equal(plan.battles.length, 2);
  });

  it("waits if the user is already searching", () => {
    const plan = planVoiceBattleJoin({ searching: ["gen9randombattle"], games: null });
    assert.equal(plan.action, "searching");
  });

  it("reports none so the shell can start a search", () => {
    const plan = planVoiceBattleJoin({ searching: [], games: null });
    assert.equal(plan.action, "none");
  });

  it("does not treat a mafia room as a battle to join", () => {
    const plan = planVoiceBattleJoin({
      searching: [],
      games: { "mafia-99": "Mafia" },
    });
    assert.equal(plan.action, "none");
  });
});

describe("isBattleRoomId", () => {
  it("only matches battle-*", () => {
    assert.equal(isBattleRoomId("battle-gen9randombattle-1"), true);
    assert.equal(isBattleRoomId("lobby"), false);
    assert.equal(isBattleRoomId("mafia-1"), false);
  });
});
