export type Notice = { message: string; action?: string; undo?: () => void };

/** Transient feedback stays separate from the persistent guest collection. */
export function notify(message: string, action?: string, undo?: () => void) {
  window.dispatchEvent(new CustomEvent<Notice>('monumental:notice', { detail: { message, action, undo } }));
}
