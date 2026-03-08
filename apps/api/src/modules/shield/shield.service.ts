import {
  resolveShieldAction as sharedResolveShieldAction,
  type PrimaryShieldAction,
  type ResolvedShieldAction,
} from "@roastr/shared";

export type { PrimaryShieldAction as ShieldAction, ResolvedShieldAction };

export const resolveShieldAction = sharedResolveShieldAction;
