import canonicalize from "canonicalize";

export type StrictJsonValue =
  | null
  | boolean
  | number
  | string
  | StrictJsonValue[]
  | { [key: string]: StrictJsonValue };

const MAX_SUPPORTED_DEPTH = 128;
const MAX_SUPPORTED_BYTES = 1_048_576;

export interface StrictJsonLimits {
  /** Maximum UTF-8 size of the original JSON document. */
  maxBytes: number;
  /** Maximum nesting depth; the root value has depth zero. */
  maxDepth: number;
}

function fail(message: string, index: number): never {
  throw new Error("strict_json_invalid:" + message + ":offset=" + index);
}

function assertWellFormedUnicode(value: string, index: number): void {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail("lone_surrogate", index);
      }
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail("lone_surrogate", index);
    }
  }
}

function validateLimits(limits: StrictJsonLimits): void {
  if (
    !limits ||
    !Number.isSafeInteger(limits.maxBytes) ||
    limits.maxBytes < 1 ||
    limits.maxBytes > MAX_SUPPORTED_BYTES ||
    !Number.isSafeInteger(limits.maxDepth) ||
    limits.maxDepth < 0 ||
    limits.maxDepth > MAX_SUPPORTED_DEPTH
  ) {
    throw new Error("strict_json_invalid:limits");
  }
}

/**
 * Parses untrusted JSON while rejecting duplicate decoded property names,
 * invalid Unicode, non-finite IEEE-754 numbers and caller-exceeding limits.
 * Objects use a null prototype so keys such as "__proto__" remain data.
 */
export function parseStrictJson(
  source: string,
  limits: StrictJsonLimits,
): StrictJsonValue {
  validateLimits(limits);
  if (typeof source !== "string") {
    throw new Error("strict_json_invalid:source_type");
  }
  if (source.length > limits.maxBytes) {
    throw new Error("strict_json_invalid:max_bytes");
  }
  if (new TextEncoder().encode(source).byteLength > limits.maxBytes) {
    throw new Error("strict_json_invalid:max_bytes");
  }

  let index = 0;

  const skipWhitespace = (): void => {
    while (index < source.length) {
      const code = source.charCodeAt(index);
      if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) {
        index += 1;
      } else {
        break;
      }
    }
  };

  const parseString = (): string => {
    const start = index;
    if (source.charCodeAt(index) !== 0x22) {
      fail("expected_string", index);
    }
    index += 1;

    while (index < source.length) {
      const code = source.charCodeAt(index);
      if (code === 0x22) {
        index += 1;
        let decoded: unknown;
        try {
          decoded = JSON.parse(source.slice(start, index));
        } catch {
          fail("invalid_string", start);
        }
        if (typeof decoded !== "string") {
          fail("invalid_string", start);
        }
        assertWellFormedUnicode(decoded, start);
        return decoded;
      }
      if (code < 0x20) {
        fail("unescaped_control_character", index);
      }
      if (code === 0x5c) {
        index += 1;
        if (index >= source.length) {
          fail("unterminated_escape", start);
        }
        if (source.charCodeAt(index) === 0x75) {
          index += 5;
        } else {
          index += 1;
        }
      } else {
        index += 1;
      }
    }

    fail("unterminated_string", start);
  };

  const parseNumber = (): number => {
    const rest = source.slice(index);
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(rest);
    if (!match) {
      fail("invalid_number", index);
    }
    const token = match[0];
    const value = Number(token);
    if (!Number.isFinite(value)) {
      fail("non_finite_number", index);
    }
    index += token.length;
    return value;
  };

  const parseValue = (depth: number): StrictJsonValue => {
    if (depth > limits.maxDepth) {
      fail("max_depth", index);
    }
    skipWhitespace();
    const code = source.charCodeAt(index);

    if (code === 0x22) {
      return parseString();
    }

    if (code === 0x7b) {
      index += 1;
      skipWhitespace();
      const object: { [key: string]: StrictJsonValue } = Object.create(null);
      const names = new Set<string>();
      if (source.charCodeAt(index) === 0x7d) {
        index += 1;
        return object;
      }

      while (index < source.length) {
        skipWhitespace();
        const keyStart = index;
        const key = parseString();
        if (names.has(key)) {
          fail("duplicate_property", keyStart);
        }
        names.add(key);
        skipWhitespace();
        if (source.charCodeAt(index) !== 0x3a) {
          fail("expected_colon", index);
        }
        index += 1;
        object[key] = parseValue(depth + 1);
        skipWhitespace();
        const separator = source.charCodeAt(index);
        if (separator === 0x7d) {
          index += 1;
          return object;
        }
        if (separator !== 0x2c) {
          fail("expected_object_separator", index);
        }
        index += 1;
      }
      fail("unterminated_object", index);
    }

    if (code === 0x5b) {
      index += 1;
      skipWhitespace();
      const array: StrictJsonValue[] = [];
      if (source.charCodeAt(index) === 0x5d) {
        index += 1;
        return array;
      }

      while (index < source.length) {
        array.push(parseValue(depth + 1));
        skipWhitespace();
        const separator = source.charCodeAt(index);
        if (separator === 0x5d) {
          index += 1;
          return array;
        }
        if (separator !== 0x2c) {
          fail("expected_array_separator", index);
        }
        index += 1;
      }
      fail("unterminated_array", index);
    }

    if (source.startsWith("true", index)) {
      index += 4;
      return true;
    }
    if (source.startsWith("false", index)) {
      index += 5;
      return false;
    }
    if (source.startsWith("null", index)) {
      index += 4;
      return null;
    }

    if (code === 0x2d || (code >= 0x30 && code <= 0x39)) {
      return parseNumber();
    }

    fail("unexpected_token", index);
  };

  const value = parseValue(0);
  skipWhitespace();
  if (index !== source.length) {
    fail("trailing_data", index);
  }
  return value;
}

/** Parses strict JSON and returns its RFC 8785 canonical representation. */
export function canonicalizeStrictJson(
  source: string,
  limits: StrictJsonLimits,
): string {
  const result = canonicalize(parseStrictJson(source, limits));
  if (typeof result !== "string") {
    throw new Error("strict_json_invalid:canonicalization_failed");
  }
  return result;
}
