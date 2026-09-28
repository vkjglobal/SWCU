export const ASK_SWCU_CONNECTION_READY = false;
export const ASK_SWCU_NOT_READY_MESSAGE = "Ask SWCU cannot be shown until the chatbot connection is ready.";

export function planAskSwcuChange(
  previous: boolean,
  requested: boolean,
  connectionReady: boolean,
): { before: boolean; after: boolean } | null {
  if (requested && !connectionReady) {
    throw new Error(ASK_SWCU_NOT_READY_MESSAGE);
  }
  return previous === requested ? null : { before: previous, after: requested };
}

export function shouldRenderAskSwcu(enabled: boolean, connectionReady: boolean): boolean {
  return enabled && connectionReady;
}