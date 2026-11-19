/**
 * Cross-tab auth notifications over `BroadcastChannel("paradise-auth")`.
 *
 * The access token lives in each tab's memory while the refresh cookie is
 * shared, so a logout in one tab must tell the others to drop their state,
 * and a login lets guest tabs restore the session from the new cookie.
 * Without `BroadcastChannel` every call is a no-op.
 */

export type AuthMessage = { type: "logout" } | { type: "login" };

export interface AuthChannel {
  /** Sends `message` to every other tab; never delivered to this one. */
  post(message: AuthMessage): void;
  close(): void;
}

const CHANNEL_NAME = "paradise-auth";

function isAuthMessage(data: unknown): data is AuthMessage {
  if (!data || typeof data !== "object") return false;
  const { type } = data as { type?: unknown };
  return type === "logout" || type === "login";
}

const noopChannel: AuthChannel = {
  post() {},
  close() {},
};

export function openAuthChannel(
  onMessage: (message: AuthMessage) => void,
): AuthChannel {
  if (typeof BroadcastChannel === "undefined") return noopChannel;

  const channel = new BroadcastChannel(CHANNEL_NAME);
  let closed = false;
  channel.onmessage = (event: MessageEvent) => {
    if (!closed && isAuthMessage(event.data)) onMessage(event.data);
  };

  return {
    post(message) {
      if (!closed) channel.postMessage(message);
    },
    close() {
      if (closed) return;
      closed = true;
      channel.onmessage = null;
      channel.close();
    },
  };
}
