import assert from "node:assert/strict";

import {
  getDashboardDateAction,
} from "../src/services/dashboardDateRollover.ts";

assert.equal(
  getDashboardDateAction(
    null,
    "2026-06-24"
  ),
  "INITIALIZE"
);
assert.equal(
  getDashboardDateAction(
    "2026-06-24",
    "2026-06-24"
  ),
  "UNCHANGED"
);
assert.equal(
  getDashboardDateAction(
    "2026-06-23",
    "2026-06-24"
  ),
  "RECOVER"
);

console.log(
  "Dashboard date rollover: 3 checks passed."
);
