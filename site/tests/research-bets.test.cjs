"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const calc = require("../research-bets/math.js");

function leg(event, selection, odds, extra = {}) {
  return { event, selection, market: "Player prop", odds, source: "Manual example", evidence: "User supplied research", ...extra };
}

test("American odds convert to valid decimal prices, bad lines reject", () => {
  assert.equal(calc.americanToDecimal("+150"), 2.5);
  assert.equal(calc.americanToDecimal(-200), 1.5);
  assert.equal(calc.americanToDecimal(-100), 2);
  for (const odds of [0, -99, 99, "EVEN", "", "NaN", Infinity, 120.5, 20001]) {
    assert.equal(calc.americanToDecimal(odds), null);
  }
});

test("two independent odds multiply mathematically, not as calibrated prediction", () => {
  const result = calc.analyze([leg("Game A", "Selection X", -110), leg("Game B", "Selection Y", 150)], 100);
  assert.equal(result.valid, true);
  assert.equal(result.legCount, 2);
  assert.ok(Math.abs(result.decimal - 4.7727272727) < 1e-8);
  assert.ok(Math.abs(result.gross - 477.2727272727) < 1e-8);
  assert.ok(Math.abs(result.profit - 377.2727272727) < 1e-8);
  assert.ok(Math.abs(result.independentImplied - 0.2095238095) < 1e-8);
  assert.equal(result.american, "+377");
});

test("correlation and missing-evidence risks are visible instead of hidden", () => {
  const result = calc.analyze([
    leg("Same Game", "Player A 20+", -115),
    leg("Same Game", "Player A 25+", -110, { evidence: "", source: "" })
  ], "10");
  assert.equal(result.valid, true);
  assert.equal(result.sharedEvents, 1);
  assert.equal(result.sharedPeople, 0);
  assert.ok(result.flags.some(s => s.includes("share a game")));
  assert.ok(result.flags.some(s => s.includes("no written supporting evidence")));
  assert.ok(result.flags.some(s => s.includes("no recorded sportsbook")));
});

test("invalid ticket, too many legs and stake fail closed", () => {
  assert.equal(calc.analyze([leg("Game A", "Pick", -99)], 10).valid, false);
  assert.equal(calc.analyze([leg("Game A", "Pick", -110)], "-4").valid, false);
  assert.equal(calc.analyze([leg("", "Pick", -110)], 10).valid, false);
  assert.equal(calc.analyze(Array.from({ length: 11 }, (_, i) => leg("Game " + i, "Pick", 110)), 10).valid, false);
  assert.equal(calc.analyze([], 0).empty, true);
  const result = calc.analyze([leg("Game A", "Pick", 100)], 0);
  assert.equal(result.gross, null);
  assert.equal(result.profit, null);
});

test("Bender navigation routes to native builder and dependencies load in order", () => {
  const site = path.join(__dirname, "..");
  const home = fs.readFileSync(path.join(site, "index.html"), "utf8");
  const builder = fs.readFileSync(path.join(site, "research-bets/index.html"), "utf8");
  for (const markup of [home, builder]) assert.ok(markup.includes('href="/research-bets/"'));
  assert.ok(home.includes('href="/research-bets/">Research Bets</a>'));
  assert.ok(builder.includes("MANUAL ODDS"));
  assert.ok(builder.includes("not a predicted win rate"));
  assert.ok(builder.indexOf("research-bets/math.js") < builder.indexOf("research-bets/research-bets.js"));
  assert.ok(!builder.includes("<iframe"));
});
