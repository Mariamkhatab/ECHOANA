// Turn the model's raw scores into a room recommendation, mirroring the Python
// pipeline: enforce the single/double hard constraint (caretaker -> doubles {B,C},
// solo -> singles {A,D}) by masking ineligible groups, then pick the best eligible group.

import { scoreGroups, FEATURE_ORDER, CLASS_CODES } from "./model.js";

export const CODE_GROUP = { 0: "A", 1: "B", 2: "C", 3: "D" };
const GROUP_CODE = { A: 0, B: 1, C: 2, D: 3 };
const SOLO_GROUPS = ["A", "D"];
const CARETAKER_GROUPS = ["B", "C"];

// Rooms per group (from data/rooms.csv) and the object names to light up in the 3D model.
export const GROUP_ROOMS = {
  A: ["A1", "A2", "A3", "A4"],
  B: ["B1", "B2", "B3"],
  C: ["C1"],
  D: ["D1", "D2"],
};

export const GROUP_META = {
  A: { name: "Group A", orient: "South · maximum sun", color: "#ff5a1f",
       desc: "South-facing single — the sunniest rooms, closest to the care suite. For guests who are low on sunlight or vitamin&nbsp;D and want easy access to care." },
  B: { name: "Group B", orient: "West · afternoon sun", color: "#ff7844",
       desc: "West-facing shared room with strong afternoon sun. For sun-seeking guests staying with a partner or carer." },
  C: { name: "Group C", orient: "North · calm light", color: "#3b7dd8",
       desc: "North-facing shared room with soft, glare-free light. For light-sensitive guests staying with a partner or carer." },
  D: { name: "Group D", orient: "North · garden view", color: "#5b8c5a",
       desc: "North / courtyard single — gentle light with a garden view, near the care suite. For low mood where greenery helps more than direct sun." },
};

const caretakerIndex = FEATURE_ORDER.indexOf("caretaker_present");

export function recommend(features) {
  const raw = scoreGroups(features); // score per class, aligned to CLASS_CODES
  const hasCaretaker = features[caretakerIndex] === 1;
  const eligible = hasCaretaker ? CARETAKER_GROUPS : SOLO_GROUPS;
  const eligibleCodes = new Set(eligible.map((g) => GROUP_CODE[g]));

  // mask ineligible groups, then pick the best eligible one
  let best = -1, bestScore = -Infinity, eligibleSum = 0;
  CLASS_CODES.forEach((code, i) => {
    if (!eligibleCodes.has(code)) return;
    eligibleSum += Math.max(raw[i], 0);
    if (raw[i] > bestScore) { bestScore = raw[i]; best = i; }
  });

  const group = CODE_GROUP[CLASS_CODES[best]];
  const confidence = eligibleSum > 0 ? Math.max(bestScore, 0) / eligibleSum : 1 / eligible.length;
  const rooms = GROUP_ROOMS[group];
  return { group, rooms, exampleRoom: rooms[0], confidence, meta: GROUP_META[group] };
}
