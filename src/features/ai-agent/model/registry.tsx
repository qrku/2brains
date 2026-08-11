'use client';

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createMcpRegistry } from '@/shared/lib/mcp';
import type { McpRegistry, McpTool } from '@/shared/lib/mcp/types';

const Ctx = createContext<McpRegistry | null>(null);

/** Holds a single registry instance for the whole app lifetime. */
export function AgentStoreProvider({ children }: { children: ReactNode }) {
  const registry = useMemo(() => createMcpRegistry(), []);
  return <Ctx.Provider value={registry}>{children}</Ctx.Provider>;
}

export function useAgentRegistry(): McpRegistry {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAgentRegistry must be inside AgentStoreProvider');
  return ctx;
}

/**
 * Registers `tools` under `namespace` for as long as the calling component is mounted.
 *
 * Tool factories (e.g. `createSpaceTools(state, dispatch, workspaceId)`) close over the
 * caller's current render's state, so the `tools` array is a *new array with new closures*
 * on every render. A naive `useEffect(..., [tools])` would therefore unregister+re-register
 * on every single render — wasteful churn, and if anything downstream ever reacts to registry
 * changes (e.g. a tool-count badge subscribed via effects), that churn can snowball into a
 * render loop.
 *
 * Fix: register only once per `namespace` (effect keyed on `[registry, namespace]`). What we
 * register is a set of thin, stable proxy tools whose `run` looks up the *current* real tool
 * by name — via a ref that's updated on every render — at call time. So the registry entry
 * itself never churns, but invoking a tool always runs against this render's fresh
 * state/dispatch closures, not stale ones captured at mount.
 */
export function useRegisterTools(namespace: string, tools: McpTool[]): void {
  const registry = useAgentRegistry();
  const toolsRef = useRef(tools);
  toolsRef.current = tools;

  useEffect(() => {
    const namesAtMount = toolsRef.current.map((t) => t.name);
    const proxies: McpTool[] = namesAtMount.map((name) => {
      const initial = toolsRef.current.find((t) => t.name === name)!;
      return {
        name: initial.name,
        description: initial.description,
        inputSchema: initial.inputSchema,
        destructive: initial.destructive,
        run: (args) => {
          const live = toolsRef.current.find((t) => t.name === name) ?? initial;
          return live.run(args);
        },
      };
    });
    return registry.register(namespace, proxies);
  }, [registry, namespace]);
}
