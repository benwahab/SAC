/**
 * Décodeur CBOR volontairement limité au sous-ensemble utilisé par WebAuthn.
 * Refuse les longueurs indéfinies, les clés dupliquées, les profondeurs
 * excessives et les données tronquées. Les Map conservent les clés typées.
 */
export type CborValue = number | string | Uint8Array | boolean | null | CborValue[] | Map<CborValue, CborValue>;

export function decodeCbor(input: Uint8Array): CborValue {
  if (!(input instanceof Uint8Array) || input.length === 0 || input.length > 65_536) {
    throw new Error("cbor_input_invalid");
  }
  let offset = 0;
  const readLength = (additional: number): number => {
    if (additional < 24) return additional;
    const count = additional === 24 ? 1 : additional === 25 ? 2 : additional === 26 ? 4 : additional === 27 ? 8 : 0;
    if (!count || offset + count > input.length) throw new Error("cbor_length_invalid");
    let value = 0n;
    for (let i = 0; i < count; i += 1) value = (value << 8n) | BigInt(input[offset++]);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("cbor_integer_too_large");
    const number = Number(value);
    if ((count === 1 && number < 24) || (count === 2 && number <= 0xff) ||
        (count === 4 && number <= 0xffff) || (count === 8 && number <= 0xffffffff)) {
      throw new Error("cbor_non_canonical_length");
    }
    return number;
  };
  const parse = (depth: number): CborValue => {
    if (depth > 16 || offset >= input.length) throw new Error("cbor_truncated_or_deep");
    const initial = input[offset++];
    const major = initial >> 5;
    const additional = initial & 31;
    if (major === 7) {
      if (additional === 20) return false;
      if (additional === 21) return true;
      if (additional === 22) return null;
      throw new Error("cbor_simple_value_unsupported");
    }
    const length = readLength(additional);
    if (major === 0 || major === 1) {
      const signed = major === 0 ? BigInt(length) : -1n - BigInt(length);
      if (signed < BigInt(Number.MIN_SAFE_INTEGER) || signed > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("cbor_integer_too_large");
      }
      return Number(signed);
    }
    if (major === 2 || major === 3) {
      if (length > 65_536 || offset + length > input.length) throw new Error("cbor_string_length_invalid");
      const bytes = input.slice(offset, offset + length);
      offset += length;
      if (major === 2) return bytes;
      try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { throw new Error("cbor_text_invalid"); }
    }
    if (major === 4) {
      if (length > 256) throw new Error("cbor_array_too_large");
      return Array.from({ length }, () => parse(depth + 1));
    }
    if (major === 5) {
      if (length > 256) throw new Error("cbor_map_too_large");
      const map = new Map<CborValue, CborValue>();
      for (let i = 0; i < length; i += 1) {
        const key = parse(depth + 1);
        if (map.has(key)) throw new Error("cbor_duplicate_key");
        map.set(key, parse(depth + 1));
      }
      return map;
    }
    throw new Error("cbor_major_type_unsupported");
  };
  const result = parse(0);
  if (offset !== input.length) throw new Error("cbor_trailing_data");
  return result;
}
