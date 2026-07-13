import { Controller, Get, Put, Body, Req, UnauthorizedException } from "@nestjs/common";
import type { PersonaProfile } from "@roastr/shared";
import { PersonaService } from "./persona.service";

@Controller("persona")
export class PersonaController {
  constructor(private readonly persona: PersonaService) {}

  @Get()
  async getPersona(@Req() req: { user?: { id: string } }): Promise<PersonaProfile> {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.persona.getPersona(req.user.id);
  }

  @Put()
  async updatePersona(
    @Req() req: { user?: { id: string } },
    @Body() body: unknown,
  ): Promise<PersonaProfile> {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.persona.updatePersona(req.user.id, body);
  }
}
