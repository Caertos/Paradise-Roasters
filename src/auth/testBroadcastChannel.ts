/**
 * In-memory stand-in for `BroadcastChannel` shared by every instance in the
 * test process. Like the real API, a message reaches every other open
 * instance with the same name (asynchronously) but never its sender.
 */
export class FakeBroadcastChannel {
  static readonly instances = new Set<FakeBroadcastChannel>();

  readonly name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.add(this);
  }

  postMessage(data: unknown): void {
    if (this.closed) {
      throw new DOMException(
        "BroadcastChannel is closed.",
        "InvalidStateError",
      );
    }
    for (const other of FakeBroadcastChannel.instances) {
      if (other === this || other.name !== this.name) continue;
      setTimeout(() => {
        if (!other.closed)
          other.onmessage?.(new MessageEvent("message", { data }));
      }, 0);
    }
  }

  close(): void {
    this.closed = true;
    FakeBroadcastChannel.instances.delete(this);
  }

  /** Open instances named `name` (defaults to the auth channel). */
  static open(name = "paradise-auth"): FakeBroadcastChannel[] {
    return [...FakeBroadcastChannel.instances].filter((c) => c.name === name);
  }

  static reset(): void {
    for (const channel of FakeBroadcastChannel.instances) channel.close();
  }
}
