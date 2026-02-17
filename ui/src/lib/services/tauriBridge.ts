interface TauriInternals {
  invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}

function getInternals(): TauriInternals | null {
  if (typeof window === 'undefined') return null;
  const internals = (window as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  return internals && typeof internals.invoke === 'function' ? internals : null;
}

export function isTauriRuntime(): boolean {
  return getInternals() !== null;
}

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const internals = getInternals();
  if (!internals) {
    throw new Error('E_TAURI_UNAVAILABLE: Tauri runtime bridge is not available.');
  }
  return internals.invoke<T>(cmd, args);
}
