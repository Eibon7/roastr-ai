import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { PersonaController } from "../../src/modules/persona/persona.controller";
import type { PersonaService } from "../../src/modules/persona/persona.service";

function makeReq(userId: string | null = "user-1") {
  return { user: userId ? { id: userId } : undefined };
}

const PROFILE = { identities: ["a"], redLines: ["b"], tolerances: ["c"] };

describe("PersonaController", () => {
  let persona: PersonaService;
  let controller: PersonaController;

  beforeEach(() => {
    persona = {
      getPersona: vi.fn().mockResolvedValue(PROFILE),
      updatePersona: vi.fn().mockResolvedValue(PROFILE),
    } as unknown as PersonaService;
    controller = new PersonaController(persona);
  });

  describe("GET /persona", () => {
    it("throws 401 when there is no authenticated user", async () => {
      await expect(controller.getPersona(makeReq(null))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("returns the user's persona", async () => {
      const result = await controller.getPersona(makeReq("user-1"));
      expect(persona.getPersona).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(PROFILE);
    });
  });

  describe("PUT /persona", () => {
    it("throws 401 when there is no authenticated user", async () => {
      await expect(controller.updatePersona(makeReq(null), PROFILE)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("delegates validation and persistence to the service", async () => {
      const result = await controller.updatePersona(makeReq("user-1"), PROFILE);
      expect(persona.updatePersona).toHaveBeenCalledWith("user-1", PROFILE);
      expect(result).toEqual(PROFILE);
    });

    it("propagates validation errors from the service uncaught", async () => {
      const { BadRequestException } = await import("@nestjs/common");
      vi.mocked(persona.updatePersona).mockRejectedValue(new BadRequestException("bad payload"));
      await expect(controller.updatePersona(makeReq("user-1"), {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
