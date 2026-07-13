import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PersonaService } from "../../src/modules/persona/persona.service";
import { TokenEncryptionService } from "../../src/shared/crypto/token-encryption.service";

type MockMethods = {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

type MockChain = Promise<{ data: unknown; error: unknown }> & MockMethods;

function makeChain(defaultResult: { data: unknown; error: unknown } = { data: null, error: null }): MockChain {
  const chain = Promise.resolve(defaultResult) as unknown as MockChain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(defaultResult));
  return chain;
}

const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

function makeConfig(): ConfigService {
  return {
    getOrThrow: vi.fn((key: string) => {
      if (key === "SUPABASE_URL") return "https://test.supabase.co";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service-key";
      throw new Error(`Unknown config: ${key}`);
    }),
    get: vi.fn((key: string) => (key === "TOKEN_ENCRYPTION_KEY" ? "a-valid-32-character-secret-key!" : undefined)),
  } as unknown as ConfigService;
}

const VALID_PROFILE = {
  identities: ["músico independiente"],
  redLines: ["racismo"],
  tolerances: ["críticas artísticas"],
};

describe("PersonaService", () => {
  let encryption: TokenEncryptionService;
  let service: PersonaService;

  beforeEach(() => {
    vi.clearAllMocks();
    const config = makeConfig();
    encryption = new TokenEncryptionService(config);
    service = new PersonaService(config, encryption);
  });

  describe("getPersona()", () => {
    it("returns an empty persona when no row exists", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
      await expect(service.getPersona("user-1")).resolves.toEqual({
        identities: [],
        redLines: [],
        tolerances: [],
      });
    });

    it("returns an empty persona when the column is null", async () => {
      mockFrom.mockReturnValue(makeChain({ data: { roastr_persona_config: null }, error: null }));
      await expect(service.getPersona("user-1")).resolves.toEqual({
        identities: [],
        redLines: [],
        tolerances: [],
      });
    });

    it("decrypts and returns a previously stored persona", async () => {
      const ciphertext = encryption.encrypt(JSON.stringify(VALID_PROFILE));
      mockFrom.mockReturnValue(
        makeChain({
          data: { roastr_persona_config: ciphertext.toString("base64") },
          error: null,
        }),
      );

      await expect(service.getPersona("user-1")).resolves.toEqual(VALID_PROFILE);
    });

    it("returns an empty persona (does not throw) when the stored config is corrupted", async () => {
      mockFrom.mockReturnValue(
        makeChain({
          data: { roastr_persona_config: Buffer.from("not-valid-ciphertext").toString("base64") },
          error: null,
        }),
      );

      await expect(service.getPersona("user-1")).resolves.toEqual({
        identities: [],
        redLines: [],
        tolerances: [],
      });
    });

    it("propagates a Supabase read error", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: "connection refused" } }));
      await expect(service.getPersona("user-1")).rejects.toThrow(
        /Failed to load persona: connection refused/,
      );
    });
  });

  describe("updatePersona()", () => {
    it("rejects a non-object payload", async () => {
      await expect(service.updatePersona("user-1", null)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.updatePersona("user-1", "oops")).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(["identities", "redLines", "tolerances"])(
      "rejects when %s is missing or not an array of strings",
      async (field) => {
        const payload = { ...VALID_PROFILE, [field]: "not-an-array" };
        await expect(service.updatePersona("user-1", payload)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it("rejects an entry longer than 200 characters", async () => {
      const payload = { ...VALID_PROFILE, identities: ["a".repeat(201)] };
      await expect(service.updatePersona("user-1", payload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("accepts empty arrays (fields can be cleared but not deleted)", async () => {
      const updateChain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(updateChain);

      const result = await service.updatePersona("user-1", {
        identities: [],
        redLines: [],
        tolerances: [],
      });

      expect(result).toEqual({ identities: [], redLines: [], tolerances: [] });
    });

    it("encrypts and persists the persona, then returns the stored profile", async () => {
      const updateChain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(updateChain);

      const result = await service.updatePersona("user-1", VALID_PROFILE);

      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ roastr_persona_config: expect.any(Buffer) }),
      );
      expect(updateChain.eq).toHaveBeenCalledWith("id", "user-1");
      expect(result).toEqual(VALID_PROFILE);

      // The persisted ciphertext must actually decrypt back to the same profile.
      const [[persistedArg]] = updateChain.update.mock.calls;
      const decrypted = JSON.parse(encryption.decrypt(persistedArg.roastr_persona_config));
      expect(decrypted).toEqual(VALID_PROFILE);
    });

    it("propagates a Supabase write error", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: "row locked" } }));
      await expect(service.updatePersona("user-1", VALID_PROFILE)).rejects.toThrow(
        /Failed to update persona: row locked/,
      );
    });
  });
});
