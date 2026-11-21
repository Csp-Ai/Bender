"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BenderParlayMath = api;
})(typeof window !== "undefined" ? window : null, function () {
  const MAX_LEGS = 10;
  function americanToDecimal(value) {
    const odds = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isInteger(odds) || Math.abs(odds) < 100 || Math.abs(odds) > 20000) return null;
    return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
  }
  function decimalToAmerican(decimal) {
    if (!(decimal > 1) || !Number.isFinite(decimal)) return null;
    const val = decimal >= 2 ? Math.round((decimal - 1) * 100) : -Math.round(100 / (decimal - 1));
    return val > 0 ? "+" + val : String(val);
  }
  function analyze(legs, stake) {
    if (!Array.isArray(legs) || legs.length > MAX_LEGS) return { valid: false, errors: ["Invalid ticket size"] };
    if (!legs.length) return { valid: true, empty: true, legCount: 0, flags: [] };
    const errors = [];
    let combined = 1;
    const events = new Map(), people = new Map();
    legs.forEach(function (leg, index) {
      const decimal = americanToDecimal(leg.odds);
      if (!decimal) errors.push("Leg " + (index + 1) + " has invalid American odds");
      else combined *= decimal;
      const event = String(leg.event || "").trim().toLowerCase();
      const name = String(leg.selection || "").trim().toLowerCase();
      if (!event || !name || !String(leg.market || "").trim()) errors.push("Leg " + (index + 1) + " is missing its event, selection or market");
      if (event) events.set(event, (events.get(event) || 0) + 1);
      if (event && name) {
        const key = event + "::" + name;
        people.set(key, (people.get(key) || 0) + 1);
      }
    });
    const rawStake = stake === "" || stake === null || stake === undefined ? 0 : Number(stake);
    if (!Number.isFinite(rawStake) || rawStake < 0 || rawStake > 1000000) errors.push("Stake must be between $0 and $1,000,000");
    if (errors.length || !Number.isFinite(combined)) return { valid: false, errors };
    const flags = [];
    const sharedEvents = [...events.values()].filter(n => n > 1).length;
    const sharedPeople = [...people.values()].filter(n => n > 1).length;
    if (sharedEvents) flags.push("Multiple legs share a game. Game script, pace or injuries could link their outcomes.");
    if (sharedPeople) flags.push("Multiple legs involve the same selection in one game. Check for overlapping or conflicting outcomes.");
    if (legs.length >= 5) flags.push("Five or more legs: a single miss loses the entire ticket.");
    if (legs.some(leg => !String(leg.evidence || "").trim())) flags.push("One or more legs have no written supporting evidence.");
    if (legs.some(leg => !String(leg.source || "").trim())) flags.push("One or more prices have no recorded sportsbook/source.");
    return {
      valid: true, empty: false, legCount: legs.length,
      decimal: combined,
      american: decimalToAmerican(combined),
      independentImplied: 1 / combined,
      gross: rawStake ? rawStake * combined : null,
      profit: rawStake ? rawStake * (combined - 1) : null,
      flags, sharedEvents, sharedPeople
    };
  }
  return Object.freeze({ MAX_LEGS, americanToDecimal, decimalToAmerican, analyze });
});
