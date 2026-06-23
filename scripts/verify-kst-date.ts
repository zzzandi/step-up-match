import assert from "node:assert/strict";

import {
  getKstDateKey,
} from "../src/utils/kstDate.ts";

assert.equal(
  getKstDateKey(
    new Date(
      "2026-06-23T14:59:59.999Z"
    )
  ),
  "2026-06-23",
  "KST 자정 전에는 같은 날짜여야 합니다."
);

assert.equal(
  getKstDateKey(
    new Date(
      "2026-06-23T15:00:00.000Z"
    )
  ),
  "2026-06-24",
  "UTC 15시는 KST 다음 날 자정이어야 합니다."
);

assert.equal(
  getKstDateKey(
    new Date(
      "2026-01-31T15:00:00.000Z"
    )
  ),
  "2026-02-01",
  "월 경계에서도 정확한 날짜를 반환해야 합니다."
);

console.log(
  "KST date scenarios: PASS (3)"
);
