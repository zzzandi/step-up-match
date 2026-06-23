import assert from "node:assert/strict";

import {
  isLocalOnlyMutationActive,
  runLocalOnlyMutation,
  runLocalOnlyMutationAsync,
} from "../src/services/localStateMutationGuard.ts";

assert.equal(
  isLocalOnlyMutationActive(),
  false,
  "기본 상태에서는 로컬 전용 변경 플래그가 꺼져 있어야 합니다."
);

runLocalOnlyMutation(() => {
  assert.equal(
    isLocalOnlyMutationActive(),
    true,
    "동기 로컬 복구 중에는 실시간 전파 차단 플래그가 켜져야 합니다."
  );
});

assert.equal(
  isLocalOnlyMutationActive(),
  false,
  "동기 로컬 복구가 끝나면 플래그가 꺼져야 합니다."
);

await runLocalOnlyMutationAsync(
  async () => {
    assert.equal(
      isLocalOnlyMutationActive(),
      true,
      "비동기 로컬 복구 중에도 실시간 전파 차단 플래그가 유지돼야 합니다."
    );

    await Promise.resolve();

    assert.equal(
      isLocalOnlyMutationActive(),
      true,
      "비동기 대기 이후에도 로컬 전용 변경 플래그가 유지돼야 합니다."
    );
  }
);

assert.equal(
  isLocalOnlyMutationActive(),
  false,
  "비동기 로컬 복구가 끝나면 플래그가 꺼져야 합니다."
);

console.log(
  "local-state mutation guard: PASS (6)"
);
