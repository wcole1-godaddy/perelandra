import { useEffect, useCallback } from 'react';
import { eventBus, type PerelandraEventMap } from '../../core/events';

export function useEventBus<K extends keyof PerelandraEventMap>(
  event: K,
  handler: (payload: PerelandraEventMap[K]) => void,
  deps: React.DependencyList = []
) {
  const stableHandler = useCallback(handler, deps);

  useEffect(() => {
    eventBus.on(event, stableHandler);
    return () => {
      eventBus.off(event, stableHandler);
    };
  }, [event, stableHandler]);
}

export function useEventBusMulti<K extends keyof PerelandraEventMap>(
  subscriptions: { [E in K]?: (payload: PerelandraEventMap[E]) => void },
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const entries = Object.entries(subscriptions) as [K, (p: any) => void][];
    entries.forEach(([event, handler]) => {
      eventBus.on(event, handler);
    });
    return () => {
      entries.forEach(([event, handler]) => {
        eventBus.off(event, handler);
      });
    };
  }, deps);
}
