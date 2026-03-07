import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FeatureFlagService } from "./feature-flag.service";
import type { FeatureFlagName } from "@roastr/shared";

export const FEATURE_FLAG_KEY = "feature_flag";
export const RequireFlag = (flagName: FeatureFlagName) =>
  SetMetadata(FEATURE_FLAG_KEY, flagName);

@Injectable()
export class RequireFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagName = this.reflector.getAllAndOverride<FeatureFlagName>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!flagName) return true;

    if (!this.featureFlagService.isEnabled(flagName)) {
      throw new ForbiddenException(
        `Feature "${flagName}" is not enabled`,
      );
    }

    return true;
  }
}
