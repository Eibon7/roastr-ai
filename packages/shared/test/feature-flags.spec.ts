import { describe, it, expect } from "vitest";
import {
  FEATURE_FLAG_NAMES,
  PLAN_LIMIT_KEYS,
  isValidFeatureFlagName,
} from "../src/feature-flags/index";

describe("isValidFeatureFlagName", () => {
  it.each(FEATURE_FLAG_NAMES)("recognizes %s as a valid flag name", (name) => {
    expect(isValidFeatureFlagName(name)).toBe(true);
  });

  it("rejects an unknown flag name", () => {
    expect(isValidFeatureFlagName("totally_made_up_flag")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidFeatureFlagName("")).toBe(false);
  });

  it("is case-sensitive (does not match a differently-cased known flag)", () => {
    expect(isValidFeatureFlagName("ENABLE_SHIELD")).toBe(false);
  });

  it("rejects a known name with trailing whitespace", () => {
    expect(isValidFeatureFlagName("enable_shield ")).toBe(false);
  });
});

describe("FEATURE_FLAG_NAMES / PLAN_LIMIT_KEYS", () => {
  it("contains no duplicate flag names", () => {
    expect(new Set(FEATURE_FLAG_NAMES).size).toBe(FEATURE_FLAG_NAMES.length);
  });

  it("contains the expected shield-related flags", () => {
    expect(FEATURE_FLAG_NAMES).toContain("enable_shield");
    expect(FEATURE_FLAG_NAMES).toContain("kill_switch_autopost");
    expect(FEATURE_FLAG_NAMES).toContain("manual_review_enabled");
  });

  it("defines exactly the three plan limit keys, one per plan tier", () => {
    expect(PLAN_LIMIT_KEYS).toEqual([
      "starter_monthly_analyses",
      "pro_monthly_analyses",
      "plus_monthly_analyses",
    ]);
  });
});
