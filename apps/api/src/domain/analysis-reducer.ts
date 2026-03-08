import {
  analysisReducer as sharedReducer,
  type AnalysisReducerInput,
} from "@roastr/shared";
import type { AnalysisResult } from "@roastr/shared";

export type { AnalysisReducerInput } from "@roastr/shared";

export function analysisReducer(input: AnalysisReducerInput): AnalysisResult {
  return sharedReducer(input);
}
