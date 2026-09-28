import type { ReactNode } from "react";
import { ASK_SWCU_CONNECTION_READY, shouldRenderAskSwcu } from "@/lib/ask-swcu-policy";

function connectedAssistant(): ReactNode {
  // Add the approved provider integration here, not to individual pages.
  return null;
}

export function AskSwcuWidget({ enabled }: { enabled: boolean }) {
  if (!shouldRenderAskSwcu(enabled, ASK_SWCU_CONNECTION_READY)) return null;
  const assistant = connectedAssistant();
  if (!assistant) return null;
  return (
    <div className="fixed bottom-24 right-4 z-40 md:bottom-6 md:right-6">
      {assistant}
    </div>
  );
}