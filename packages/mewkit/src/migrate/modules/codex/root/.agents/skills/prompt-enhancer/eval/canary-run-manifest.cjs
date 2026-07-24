"use strict";

const CORE_IDS = [
  "01", "02", "03", "04", "05", "06", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21",
];
const DEEP_IDS = ["07", "08", "09", "10"];

function selectCanaryIds(tier) {
  if (tier === "core") return CORE_IDS;
  if (tier === "deep") return DEEP_IDS;
  if (tier === "all") return [...CORE_IDS, ...DEEP_IDS];
  throw new Error(`Unknown tier: ${tier}`);
}

module.exports = { DEEP_IDS, selectCanaryIds };
