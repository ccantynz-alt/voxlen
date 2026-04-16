import { beforeEach, describe, expect, it, vi } from "vitest";

// invoke() is the only external dependency — mock it to simulate Rust-side
// license-status responses without spinning up a Tauri webview.
const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

async function freshStore() {
  vi.resetModules();
  const mod = await import("./entitlement");
  return mod;
}

describe("useEntitlementStore", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("defaults to free before refresh()", async () => {
    const { useEntitlementStore } = await freshStore();
    const s = useEntitlementStore.getState();
    expect(s.tier).toBe("free");
    expect(s.isLoaded).toBe(false);
  });

  it("applies a paid status from the Rust side", async () => {
    invokeMock.mockResolvedValueOnce({
      tier: "professional",
      email: "counsel@example.com",
      expires: 9_999_999_999,
      valid: true,
      reason: null,
    });
    const { useEntitlementStore } = await freshStore();
    await useEntitlementStore.getState().refresh();
    const s = useEntitlementStore.getState();
    expect(s.tier).toBe("professional");
    expect(s.email).toBe("counsel@example.com");
    expect(s.valid).toBe(true);
    expect(s.isLoaded).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("get_license_status");
  });

  it("falls back to free when the Rust side errors", async () => {
    invokeMock.mockRejectedValueOnce(new Error("bridge down"));
    const { useEntitlementStore } = await freshStore();
    await useEntitlementStore.getState().refresh();
    expect(useEntitlementStore.getState().tier).toBe("free");
    expect(useEntitlementStore.getState().isLoaded).toBe(true);
  });

  it("activate() returns null on success and updates the tier", async () => {
    invokeMock.mockResolvedValueOnce({
      tier: "pro",
      email: "founder@example.com",
      expires: null,
      valid: true,
      reason: null,
    });
    const { useEntitlementStore } = await freshStore();
    const err = await useEntitlementStore.getState().activate("VOXLEN-foo.bar");
    expect(err).toBeNull();
    expect(useEntitlementStore.getState().tier).toBe("pro");
    expect(invokeMock).toHaveBeenCalledWith("activate_license", {
      key: "VOXLEN-foo.bar",
    });
  });

  it("activate() surfaces a string error from the Rust command", async () => {
    invokeMock.mockRejectedValueOnce("license expired");
    const { useEntitlementStore } = await freshStore();
    const err = await useEntitlementStore.getState().activate("VOXLEN-bad");
    expect(err).toBe("license expired");
    expect(useEntitlementStore.getState().tier).toBe("free");
  });

  it("clear() resets the store to free even if the Rust command errors", async () => {
    // First, seed with a paid tier.
    invokeMock.mockResolvedValueOnce({
      tier: "lifetime",
      email: "x@y.z",
      expires: null,
      valid: true,
      reason: null,
    });
    const { useEntitlementStore } = await freshStore();
    await useEntitlementStore.getState().refresh();
    expect(useEntitlementStore.getState().tier).toBe("lifetime");

    // Then clear with a failing bridge.
    invokeMock.mockRejectedValueOnce(new Error("kaboom"));
    await useEntitlementStore.getState().clear();
    expect(useEntitlementStore.getState().tier).toBe("free");
  });

  it("isPaid() matches the server-side Tier::is_paid() semantics", async () => {
    const { isPaid } = await freshStore();
    expect(isPaid("free")).toBe(false);
    expect(isPaid("pro")).toBe(true);
    expect(isPaid("professional")).toBe(true);
    expect(isPaid("lifetime")).toBe(true);
  });
});
