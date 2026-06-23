let localOnlyMutationDepth = 0;

export function isLocalOnlyMutationActive() {
  return localOnlyMutationDepth > 0;
}

export function runLocalOnlyMutation<T>(
  callback: () => T
) {
  localOnlyMutationDepth += 1;

  try {
    return callback();
  } finally {
    localOnlyMutationDepth -= 1;
  }
}

export async function runLocalOnlyMutationAsync<T>(
  callback: () => Promise<T>
) {
  localOnlyMutationDepth += 1;

  try {
    return await callback();
  } finally {
    localOnlyMutationDepth -= 1;
  }
}
