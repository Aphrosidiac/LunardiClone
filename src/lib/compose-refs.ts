// Module 820783 (radix compose-refs).
import { useCallback, type Ref, type RefCallback } from 'react';

type PossibleRef<T> = Ref<T> | undefined | null;

function setRef<T>(ref: PossibleRef<T>, value: T | null): void | (() => void) {
  if (typeof ref === 'function') return ref(value) as void | (() => void);
  if (ref !== null && ref !== undefined) (ref as { current: T | null }).current = value;
}

export function composeRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup === 'function') hasCleanup = true;
      return cleanup;
    });
    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup === 'function') cleanup();
          else setRef(refs[i], null);
        }
      };
    }
  };
}

export function useComposedRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(composeRefs(...refs), refs);
}
