import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoxlenGrammar } from "./grammar";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("VoxlenGrammar API mode", () => {
  beforeEach(() => fetchMock.mockReset());

  it("uses the deployed grammar endpoint when voxlenKey is configured", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({
      corrected: "Corrected.", changes: [], score: 1,
    }) });
    const result = await new VoxlenGrammar({ voxlenKey: "jwt", writingStyle: "professional" })
      .correct("corrected");
    expect(fetchMock.mock.calls[0][0]).toBe("https://www.voxlen.ai/api/grammar");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer jwt");
    expect(result).toMatchObject({ original: "corrected", corrected: "Corrected." });
  });
});
