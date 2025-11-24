# API Platform Quirks & Edge Cases

**Purpose:** Document platform-specific API quirks and edge cases discovered during integration work to prevent repeating the same debugging sessions.

**Last Updated:** 2025-11-02

**Usage:** Read this file when debugging API errors. Add new quirks when you encounter ≥2 occurrences of the same issue.

---

## Document Format

For each quirk, include:

````markdown
### Platform - Quirk Title

**Pattern:** Brief description of the symptom

**Root cause:** What actually causes this behavior

**Error example:**

```json
{ "error": "Sample error message" }
```
````

**Fix:**

```javascript
// Code example showing the fix
```

**Occurrences:** Issue #XXX, Issue #YYY
**Last seen:** YYYY-MM-DD
**Platform:** Specific API (e.g., Twitter API v2, Instagram Graph API)

````

---

## Documented Quirks

_This section will be populated as quirks are discovered during development._

**Current count:** 0 quirks documented

---

## Contributing

When you encounter an API quirk:

1. **First occurrence:** Note it in your debugging session
2. **Second occurrence:** Document it here
3. **Update:** Add issue number + last seen date each time

**Template:**

```markdown
### Platform - [Quirk Title]

**Pattern:** [What you observe]

**Root cause:** [Why it happens]

**Error:**
```json
[Error message if applicable]
````

**Fix:**

```javascript
[Code solution]
```

**Occurrences:** Issue #XXX
**Last seen:** YYYY-MM-DD
**Platform:** [Specific API]

```

---

## Quick Reference by Platform

### Twitter / X
_No quirks documented yet_

### YouTube
_No quirks documented yet_

### Instagram
_No quirks documented yet_

### Facebook
_No quirks documented yet_

### Discord
_No quirks documented yet_

### Twitch
_No quirks documented yet_

### Reddit
_No quirks documented yet_

### TikTok
_No quirks documented yet_

### Bluesky
_No quirks documented yet_

---

## Related Documentation

- **Integration guide:** `docs/INTEGRATIONS.md`
- **Base integration class:** `src/integrations/base/BaseIntegration.js`
- **Debugging skill:** `.claude/skills/api-integration-debugging-skill.md`
- **CodeRabbit lessons:** `docs/patterns/coderabbit-lessons.md`

---

**Maintained by:** Integration engineers + API debugging skill
**Review frequency:** Monthly or when new platform added
**Format version:** 1.0
```
