"use strict";
(function () {
  const math = window.BenderParlayMath;
  if (!math) return;
  const KEY = "bender:research-bets:ticket:v1";
  const $ = id => document.getElementById(id);
  const els = {
    form: $("rb-leg-form"), sport: $("rb-sport"), market: $("rb-market"),
    event: $("rb-event"), selection: $("rb-selection"), odds: $("rb-odds"),
    source: $("rb-source"), evidence: $("rb-evidence"), error: $("rb-form-error"),
    add: $("rb-add"), list: $("rb-legs"), count: $("rb-leg-count"),
    clear: $("rb-clear"), stake: $("rb-stake"), combined: $("rb-combined"),
    implied: $("rb-implied"), gross: $("rb-return"), profit: $("rb-profit"),
    flags: $("rb-flags"), flagCount: $("rb-flag-count"), copy: $("rb-copy"),
    saveStatus: $("rb-save-status")
  };
  let legs = [];
  const money = n => Number.isFinite(n) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n) : "—";
  function textNode(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = content;
    return node;
  }
  function load() {
    try {
      const payload = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!payload || !Array.isArray(payload.legs)) return;
      legs = payload.legs.slice(0, math.MAX_LEGS).filter(leg =>
        leg && typeof leg === "object" && typeof leg.event === "string" &&
        typeof leg.selection === "string" && typeof leg.market === "string" &&
        math.americanToDecimal(leg.odds) !== null
      ).map(leg => ({
        sport: String(leg.sport || "Other").slice(0, 32),
        event: leg.event.slice(0, 120), market: leg.market.slice(0, 60),
        selection: leg.selection.slice(0, 140), odds: String(leg.odds).slice(0, 8),
        source: String(leg.source || "").slice(0, 100),
        evidence: String(leg.evidence || "").slice(0, 600)
      }));
      if (payload.stake !== null && payload.stake !== undefined) els.stake.value = String(payload.stake).slice(0, 24);
      if (legs.length) els.saveStatus.textContent = "Recovered a draft stored in this browser. No bets were placed.";
    } catch (_) {
      els.saveStatus.textContent = "Saved drafts are unavailable in this browser; your entries will still work for this visit.";
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, legs, stake: els.stake.value }));
      els.saveStatus.textContent = "Draft saved on this device only. No bet submitted or synced.";
    } catch (_) {
      els.saveStatus.textContent = "Local saving is blocked. Copy the research brief before leaving this page.";
    }
  }
  function drawLeg(leg, index) {
    const item = textNode("article", "rb-leg", "");
    const top = textNode("div", "rb-leg-top", "");
    top.appendChild(textNode("span", "rb-leg-number", "LEG " + (index + 1) + " · " + leg.sport));
    const remove = textNode("button", "rb-leg-remove", "Remove");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove leg " + (index + 1));
    remove.addEventListener("click", () => { legs.splice(index, 1); save(); render(); });
    top.appendChild(remove);
    item.appendChild(top);
    item.appendChild(textNode("h3", "rb-leg-selection", leg.selection));
    item.appendChild(textNode("div", "rb-leg-info", leg.event + " · " + leg.market));
    const bottom = textNode("div", "rb-leg-bottom", "");
    bottom.appendChild(textNode("span", "rb-leg-info", leg.source ? "Source: " + leg.source : "Source not recorded"));
    bottom.appendChild(textNode("strong", "", Number(leg.odds) > 0 ? "+" + Number(leg.odds) : String(Number(leg.odds))));
    item.appendChild(bottom);
    item.appendChild(textNode("p", "rb-leg-evidence" + (leg.evidence ? "" : " missing"),
      leg.evidence ? "Research: " + leg.evidence : "No evidence note yet"));
    return item;
  }
  function render() {
    els.list.replaceChildren();
    els.count.textContent = "(" + legs.length + ")";
    els.clear.disabled = !legs.length;
    els.copy.disabled = !legs.length;
    els.add.disabled = legs.length >= math.MAX_LEGS;
    els.add.textContent = legs.length >= math.MAX_LEGS ? "Maximum 10 legs" : "+ Add to ticket";
    if (!legs.length) els.list.appendChild(textNode("p", "rb-empty", "No legs yet. Add a selection to start your research slip."));
    else legs.forEach((leg, index) => els.list.appendChild(drawLeg(leg, index)));
    const analysis = math.analyze(legs, els.stake.value);
    const ready = analysis.valid && !analysis.empty;
    els.combined.textContent = ready ? analysis.american : "—";
    els.implied.textContent = ready ? (analysis.independentImplied * 100).toFixed(2) + "%" : "—";
    els.gross.textContent = ready && analysis.gross !== null ? money(analysis.gross) : "—";
    els.profit.textContent = ready && analysis.profit !== null ? money(analysis.profit) : "—";
    els.flags.replaceChildren();
    if (!ready && !analysis.empty) {
      const errors = analysis.errors || ["Check your entered odds and stake"];
      errors.forEach(error => els.flags.appendChild(textNode("p", "rb-flag", error)));
      els.flagCount.textContent = errors.length + " issue" + (errors.length === 1 ? "" : "s");
    } else if (analysis.empty) {
      els.flags.appendChild(textNode("p", "rb-empty", "Add legs to see structure and evidence warnings."));
      els.flagCount.textContent = "0 flags";
    } else if (!analysis.flags.length) {
      els.flags.appendChild(textNode("p", "rb-clear-flag", "No basic structure flags detected. This is not an assessment of whether the picks will win."));
      els.flagCount.textContent = "0 flags";
    } else {
      analysis.flags.forEach(flag => els.flags.appendChild(textNode("p", "rb-flag", flag)));
      els.flagCount.textContent = analysis.flags.length + " flag" + (analysis.flags.length === 1 ? "" : "s");
    }
  }
  function showError(message) {
    els.error.hidden = !message;
    els.error.textContent = message || "";
  }
  els.form.addEventListener("submit", event => {
    event.preventDefault();
    showError("");
    if (legs.length >= math.MAX_LEGS) return showError("Ticket is limited to ten legs.");
    const leg = {
      sport: els.sport.value,
      market: els.market.value,
      event: els.event.value.trim(), selection: els.selection.value.trim(),
      odds: els.odds.value.trim(), source: els.source.value.trim(),
      evidence: els.evidence.value.trim()
    };
    if (!leg.event || !leg.selection) return showError("Add a matchup/event and your exact selection.");
    if (!math.americanToDecimal(leg.odds)) return showError("Enter valid American odds, for example -110 or +150.");
    if (legs.some(row => row.event.toLowerCase() === leg.event.toLowerCase() &&
      row.selection.toLowerCase() === leg.selection.toLowerCase() && row.market === leg.market))
      return showError("This exact leg is already on your ticket.");
    legs.push(leg);
    els.event.value = ""; els.selection.value = ""; els.odds.value = "";
    els.source.value = ""; els.evidence.value = "";
    save(); render(); els.event.focus();
  });
  els.stake.addEventListener("input", () => { save(); render(); });
  els.clear.addEventListener("click", () => {
    if (!legs.length || !window.confirm("Clear the locally saved Research Bets ticket?")) return;
    legs = []; save(); render();
  });
  function researchBrief() {
    const analysis = math.analyze(legs, els.stake.value);
    const lines = ["BENDER / RESEARCH BETS - TICKET RESEARCH REQUEST",
      "These odds are manually entered, not verified live lines. Check all source timestamps.",
      ...legs.map((leg, i) => [
        (i + 1) + ". " + leg.sport + " | " + leg.event + " | " + leg.market,
        "   Pick: " + leg.selection + " | Odds: " + (Number(leg.odds) > 0 ? "+" : "") + leg.odds +
          " | Book/source: " + (leg.source || "not recorded"),
        "   Evidence: " + (leg.evidence || "none supplied")
      ].join("\n")),
      "",
      "Ticket math: " + (analysis.valid ? analysis.american + " American odds" : "invalid ticket"),
      "Structure flags: " + (analysis.valid && !analysis.empty ? analysis.flags.join(" | ") || "none detected by basic checks" : "not evaluated"),
      "",
      "Research every leg with current dated sources and citations: opponent/game script, role/minutes/snaps,",
      "recent form plus longer sample, injury/lineup status, weather when relevant, available lines and vig,",
      "model limits, opposing evidence, overlapping game/player outcomes, and sportsbook-rule conflicts.",
      "Explicitly mark what cannot be verified; no fabricated stats, injury news, confidence, or probabilities.",
      "Challenge the weakest leg, identify any correlated legs, and explain pass / revise / research further.",
      "Do not place a wager. Do not mistake the mechanical implied rate for a calibrated chance of success."
    ];
    return lines.join("\n");
  }
  els.copy.addEventListener("click", async () => {
    if (!legs.length) return;
    const brief = researchBrief();
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("No clipboard");
      await navigator.clipboard.writeText(brief);
      els.saveStatus.textContent = "Research brief copied. Paste it into ResearchBets or your research assistant.";
    } catch (_) {
      window.prompt("Copy this research brief", brief);
      els.saveStatus.textContent = "Copy was blocked by your browser. A selectable research brief was displayed.";
    }
  });
  load();
  render();
})();