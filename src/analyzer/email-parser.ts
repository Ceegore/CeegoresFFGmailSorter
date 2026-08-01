import { err, ok, type Result } from "@/shared/result";

export interface ParsedEmailCandidate {
  readonly displayName: string | null;
  readonly email: string;
}

export type EmailParseError =
  "EMPTY" | "CONTROL_CHARACTER" | "TOO_LONG" | "MULTIPLE_EMAILS" | "INVALID_SYNTAX";

// Local-part and domain character classes. The spec (§49.2) authored these
// with String.raw, but a raw backtick inside the local class is an invalid
// escape under the regex `u` flag, so the classes are written as plain
// strings here. The matching behavior is identical to the spec's intent.
// DATA-002: V1 supports ASCII-only local parts per the spec. SMTPUTF8 local
// parts (RFC 6531, e.g. "üser@example.com" or "用户@example.com") are a known
// limitation — the LOCAL class is ASCII by design, so emails with Unicode
// local parts are correctly rejected rather than silently truncated. Gmail's
// web UI does not emit such addresses in the row attributes V1 reads, so this
// does not lose recurring senders in practice.
const LOCAL = "[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+";
const DOMAIN =
  "(?:[A-Z0-9\\u0080-\\u{10FFFF}](?:[A-Z0-9\\u0080-\\u{10FFFF}-]{0,61}[A-Z0-9\\u0080-\\u{10FFFF}])?)" +
  "(?:\\.(?:[A-Z0-9\\u0080-\\u{10FFFF}](?:[A-Z0-9\\u0080-\\u{10FFFF}-]{0,61}[A-Z0-9\\u0080-\\u{10FFFF}])?))+";
// BUG-005: require boundaries before and after the email so a valid-looking
// ASCII suffix inside an invalid Unicode token (e.g. "üser@example.com" →
// "ser@example.com") is NOT extracted. The boundary must be a non-token char
// (start, whitespace, <, (, ", or comma) — not any letter/digit.
const BOUNDARY_START = "(?:^|(?<=[\\s<(\"',;\\[]))";
const BOUNDARY_END = "(?=[\\s>)\"',;\\]]|$)";
const EMAIL_FIND_PATTERN = new RegExp(`${BOUNDARY_START}${LOCAL}@${DOMAIN}${BOUNDARY_END}`, "giu");
const ASCII_FULL_PATTERN =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/iu;
// BUG-055: strip Unicode format characters (category Cf), bidi controls, and
// zero-width characters from display names to prevent visual spoofing.
const FORMAT_CHARS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\p{Cf}]/gu;
// Intentionally matches control characters so we can reject them. The lint
// rule no-control-regex is about accidental matches in user text; here the
// whole point is detection.
// eslint-disable-next-line no-control-regex
const CONTROL_PATTERN = /[\u0000-\u001F\u007F]/u;
const RAW_DOMAIN_PATTERN =
  /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?)+$/u;

function normalizeDomain(rawDomain: string): string | null {
  const domain = rawDomain.normalize("NFKC").replace(/\.$/u, "").toLowerCase();
  if (!RAW_DOMAIN_PATTERN.test(domain) || /[/\\?#:@]/u.test(domain)) return null;
  try {
    const hostname = new URL(`https://${domain}/`).hostname.toLowerCase();
    return hostname && !hostname.includes("/") ? hostname : null;
  } catch {
    return null;
  }
}

export function normalizeEmail(raw: string): Result<string, EmailParseError> {
  const trimmed = raw.normalize("NFKC").trim().replace(/^<|>$/gu, "");
  if (!trimmed) return err("EMPTY");
  if (CONTROL_PATTERN.test(trimmed)) return err("CONTROL_CHARACTER");
  if (trimmed.length > 320) return err("TOO_LONG");
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1 || trimmed.indexOf("@") !== at)
    return err("INVALID_SYNTAX");
  const local = trimmed.slice(0, at).toLowerCase();
  const domain = normalizeDomain(trimmed.slice(at + 1));
  if (!domain || local.length > 64 || domain.length > 255 || /^\.|\.$|\.\./u.test(local))
    return err("INVALID_SYNTAX");
  const normalized = `${local}@${domain}`;
  if (normalized.length > 320) return err("TOO_LONG");
  return ASCII_FULL_PATTERN.test(normalized) ? ok(normalized) : err("INVALID_SYNTAX");
}

export function parseEmailCandidate(value: string): Result<ParsedEmailCandidate, EmailParseError> {
  const normalizedValue = value.normalize("NFKC").trim();
  if (!normalizedValue) return err("EMPTY");
  if (CONTROL_PATTERN.test(normalizedValue)) return err("CONTROL_CHARACTER");
  if (normalizedValue.length > 1_024) return err("TOO_LONG");

  const rawMatches = [...normalizedValue.matchAll(EMAIL_FIND_PATTERN)].map((match) => ({
    raw: match[0],
    // H-1: defensively fall back to -1 if index is somehow absent. The current
    // TS lib types RegExpMatchArray.index as `number`, so without the disable
    // `no-unnecessary-condition` would flag the `??`; we keep the guard anyway
    // because the runtime contract is "index may be undefined" (ES2018 matchAll
    // polyfills and the spec's IteratorResult both permit it) and the downstream
    // slice arithmetic would silently produce a wrong display name otherwise.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    index: match.index ?? -1,
  }));
  const normalizedMatches = rawMatches
    .map((match) => ({ ...match, normalized: normalizeEmail(match.raw) }))
    .filter((match) => match.normalized.ok);
  const unique = [
    ...new Map(
      normalizedMatches.map((match) => [match.normalized.ok ? match.normalized.value : "", match]),
    ).values(),
  ];
  if (unique.length === 0) return err("INVALID_SYNTAX");
  if (unique.length > 1) return err("MULTIPLE_EMAILS");
  const match = unique[0];
  if (!match?.normalized.ok) return err("INVALID_SYNTAX");

  const displayNameRaw =
    `${normalizedValue.slice(0, match.index)} ${normalizedValue.slice(match.index + match.raw.length)}`
      .replace(/[<>()[\]"]+/gu, " ")
      .replace(FORMAT_CHARS, "") // BUG-055: strip bidi/format chars
      .replace(/\s+/gu, " ")
      .trim();
  // ITI-044: when the same address appears twice (e.g. "a@b.com <a@b.com>"),
  // slicing around the first match leaves the second copy in the display name.
  // Strip any remaining exact occurrences of the raw matched address, then
  // collapse whitespace again.
  const displayNameClean =
    displayNameRaw
      .replace(new RegExp(match.raw.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "giu"), "")
      .replace(/\s+/gu, " ")
      .trim() || null;
  return ok({ displayName: displayNameClean, email: match.normalized.value });
}
