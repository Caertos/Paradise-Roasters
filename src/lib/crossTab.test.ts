import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeBroadcastChannel } from "../auth/testBroadcastChannel";
import { openAuthChannel, type AuthMessage } from "./crossTab";

afterEach(() => {
  FakeBroadcastChannel.reset();
  vi.unstubAllGlobals();
});

describe("openAuthChannel", () => {
  beforeEach(() => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  });

  it("delivers a message to other tabs but not to the sender", async () => {
    const senderSeen = vi.fn<(message: AuthMessage) => void>();
    const receiverSeen = vi.fn<(message: AuthMessage) => void>();
    const sender = openAuthChannel(senderSeen);
    openAuthChannel(receiverSeen);

    sender.post({ type: "logout" });

    await vi.waitFor(() =>
      expect(receiverSeen).toHaveBeenCalledWith({ type: "logout" }),
    );
    expect(senderSeen).not.toHaveBeenCalled();
  });

  it("ignores messages that are not auth messages", async () => {
    const seen = vi.fn<(message: AuthMessage) => void>();
    openAuthChannel(seen);
    const foreign = new FakeBroadcastChannel("paradise-auth");

    foreign.postMessage({ type: "something-else" });
    foreign.postMessage("logout");
    foreign.postMessage({ type: "login" });

    await vi.waitFor(() => expect(seen).toHaveBeenCalledTimes(1));
    expect(seen).toHaveBeenCalledWith({ type: "login" });
  });

  it("closes the underlying channel and ignores posts afterwards", () => {
    const channel = openAuthChannel(() => {});
    expect(FakeBroadcastChannel.open()).toHaveLength(1);

    channel.close();

    expect(FakeBroadcastChannel.open()).toHaveLength(0);
    expect(() => channel.post({ type: "logout" })).not.toThrow();
  });
});

describe("openAuthChannel without BroadcastChannel", () => {
  it("returns a no-op channel", () => {
    vi.stubGlobal("BroadcastChannel", undefined);

    const channel = openAuthChannel(() => {});

    expect(() => channel.post({ type: "logout" })).not.toThrow();
    expect(() => channel.close()).not.toThrow();
  });
});
