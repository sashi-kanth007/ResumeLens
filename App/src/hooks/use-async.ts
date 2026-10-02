import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/utils/format';

type AsyncState<T> = {
  data?: T;
  error?: string;
  loading: boolean;
};

type Options = {
  /** Reload every time the screen gains focus (e.g. returning from a detail screen). */
  refetchOnFocus?: boolean;
};

/**
 * Runs `fn` on mount (or on every focus) and tracks loading/error state.
 * `fn` should be stable (wrap it in useCallback when it closes over props).
 */
export function useAsync<T>(fn: () => Promise<T>, { refetchOnFocus = false }: Options = {}) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const data = await fn();
      if (mounted.current) setState({ data, loading: false });
    } catch (error) {
      if (mounted.current) setState((prev) => ({ ...prev, loading: false, error: getErrorMessage(error) }));
    }
  }, [fn]);

  useEffect(() => {
    mounted.current = true;
    if (!refetchOnFocus) reload();
    return () => {
      mounted.current = false;
    };
  }, [reload, refetchOnFocus]);

  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus) reload();
    }, [reload, refetchOnFocus]),
  );

  return { ...state, reload };
}
