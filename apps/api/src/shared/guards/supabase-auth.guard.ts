import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createClient } from "@supabase/supabase-js";
import { ConfigService } from "@nestjs/config";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException();

    const supabase = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_ANON_KEY"),
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) throw new UnauthorizedException();

    request.user = user;
    return true;
  }

  private extractToken(request: { headers: Record<string, string> }): string | null {
    const auth = request.headers["authorization"];
    if (!auth?.startsWith("Bearer ")) return null;
    return auth.slice(7);
  }
}
