"use strict";

const scenarios = [
  ["activation-routing", "quick", "Compare technical approaches for adding request caching to our API.", "technical-routing"],
  ["quick-no-artifact", "quick", "Brainstorm 3 options for API request caching, no file.", "inline-only"],
  ["bare-ambiguity", "quick", "Brainstorm a dashboard.", "clarify-intent"],
  ["product-redirect", "quick", "Is this worth building: a team dashboard?", "office-hours-redirect"],
  ["plan-redirect", "quick", "Review this existing implementation plan.", "plan-review-redirect"],
  ["scope-decomposition", "deep", "Compare adding billing, SSO, and audit logs to this product.", "select-one-concern"],
  ["anti-bias-pivot", "deep", "Choose an approach for API request caching.", "orthogonal-alternative"],
  ["same-architecture-rejection", "deep", "Compare Redis, Memcached, and KeyDB for API request caching.", "distinct-architectures"],
  ["deep-scoring-tie", "deep", "Score two equally viable approaches for API request caching.", "tie-break-or-no-winner"],
  ["handoff-completeness", "deep", "Create a decision handoff for the selected API request caching approach.", "complete-handoff"],
].map(([id, profile, prompt, expectation]) => ({ id, profile, prompt, expectation }));

function selectScenarios(tier) {
  if (tier === "quick") return scenarios.filter((scenario) => scenario.profile === "quick");
  if (tier === "deep") return scenarios.filter((scenario) => scenario.profile === "deep");
  if (tier === "all") return scenarios;
  throw new Error("Unknown tier: " + tier);
}

module.exports = { selectScenarios };
