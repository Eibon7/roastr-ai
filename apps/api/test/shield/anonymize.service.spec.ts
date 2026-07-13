import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { AnonymizeService } from "../../src/modules/shield/anonymize.service";
import { hashIdentifier } from "@roastr/shared";

const mockFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

/** Chainable Supabase query-builder mock: every method returns `this`, and
 * the object itself is thenable so `await` resolves to the configured result
 * regardless of how many links are chained before the terminal call. */
function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "lt", "upsert", "update", "maybeSingle"]) {
    obj[m] = vi.fn(() => obj);
  }
  (obj as { then: PromiseLike<unknown>["then"] }).then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);
  return obj;
}

describe("AnonymizeService", () => {
  let service: AnonymizeService;
  let config: ConfigService;
  const HMAC_KEY = "test-hmac-secret";

  beforeEach(() => {
    mockFrom.mockReset();
    config = {
      getOrThrow: vi.fn((key: string) => {
        if (key === "SUPABASE_URL") return "https://test.supabase.co";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-key";
        if (key === "ANONYMIZE_HMAC_KEY") return HMAC_KEY;
        throw new Error(`Unknown config: ${key}`);
      }),
    } as unknown as ConfigService;
    service = new AnonymizeService(config);
  });

  it("anonymizes eligible offenders and hashes offender_id with the keyed HMAC", async () => {
    const candidates = [
      { id: "row-1", offender_id: "user-abc", last_strike: null, created_at: "2020-01-01" },
    ];
    mockFrom
      .mockReturnValueOnce(chain({ data: candidates, error: null }))
      .mockReturnValueOnce(chain({ error: null }));

    const result = await service.anonymizeOldOffenders("2024-01-01T00:00:00.000Z");

    expect(result).toEqual({ anonymized: 1 });
    const upsertChain = mockFrom.mock.results[1].value as { upsert: ReturnType<typeof vi.fn> };
    const [updates] = upsertChain.upsert.mock.calls[0];
    expect(updates[0].id).toBe("row-1");
    expect(updates[0].offender_id).toBe(hashIdentifier("user-abc", HMAC_KEY));
  });

  it("skips records whose offender_id is already anonymized", async () => {
    const already = "anon:" + "a".repeat(64);
    const candidates = [
      { id: "row-1", offender_id: already, last_strike: null, created_at: "2020-01-01" },
    ];
    mockFrom.mockReturnValueOnce(chain({ data: candidates, error: null }));

    const result = await service.anonymizeOldOffenders("2024-01-01T00:00:00.000Z");

    expect(result).toEqual({ anonymized: 0 });
    // No second `from` call for upsert should have happened.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("returns { anonymized: 0 } for an empty candidate set without touching upsert", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }));

    const result = await service.anonymizeOldOffenders("2024-01-01T00:00:00.000Z");

    expect(result).toEqual({ anonymized: 0 });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("propagates the error when the candidate fetch fails (no silent swallow)", async () => {
    const dbError = new Error("connection reset");
    mockFrom.mockReturnValueOnce(chain({ data: null, error: dbError }));

    await expect(
      service.anonymizeOldOffenders("2024-01-01T00:00:00.000Z"),
    ).rejects.toThrow("connection reset");
  });

  it("propagates the error when the upsert write fails (no silent swallow)", async () => {
    const candidates = [
      { id: "row-1", offender_id: "user-abc", last_strike: null, created_at: "2020-01-01" },
    ];
    const upsertError = new Error("write failed");
    mockFrom
      .mockReturnValueOnce(chain({ data: candidates, error: null }))
      .mockReturnValueOnce(chain({ error: upsertError }));

    await expect(
      service.anonymizeOldOffenders("2024-01-01T00:00:00.000Z"),
    ).rejects.toThrow("write failed");
  });
});
