const MAX_LENGTH = 5000;
const CONTROL_CHARS = new RegExp("[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]", "g");

export function sanitizeCommentText(text: string): string {
  const normalized = text.normalize("NFC").replace(CONTROL_CHARS, "");
  return normalized.length > MAX_LENGTH ? normalized.slice(0, MAX_LENGTH) : normalized;
}
