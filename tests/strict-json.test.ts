import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeStrictJson,
  parseStrictJson,
  type StrictJsonLimits,
} from "../src/services/crypto/strict-json.ts";

const limits: StrictJsonLimits = { maxBytes: 4096, maxDepth: 16 };

test("le parseur accepte un document JSON strict et conserve les tableaux", () => {
  const source = ' { "z": [1, {"b": true, "a": null}], "a": "Niger" } ';
  const value = parseStrictJson(source, limits);
  assert.equal(canonicalizeStrictJson(source, limits), '{"a":"Niger","z":[1,{"a":null,"b":true}]}');
  assert.equal(Array.isArray((value as Record<string, unknown>).z), true);
});

test("le parseur rejette les noms de propriétés dupliqués", () => {
  assert.throws(() => parseStrictJson('{"role":"user","role":"admin"}', limits), /duplicate_property/);
});

test("le parseur détecte les doublons après décodage des échappements", () => {
  assert.throws(() => parseStrictJson(String.raw`{"a":1,"\u0061":2}`, limits), /duplicate_property/);
});

test("les mêmes noms sont permis dans des objets distincts", () => {
  assert.doesNotThrow(() => parseStrictJson('{"left":{"id":1},"right":{"id":2}}', limits));
});

test("la clé __proto__ reste une propriété de données sans modifier le prototype", () => {
  const value = parseStrictJson('{"__proto__":{"polluted":true}}', limits);
  assert.equal(Object.getPrototypeOf(value as object), null);
  assert.equal(Object.hasOwn(value as object, "__proto__"), true);
  assert.equal((value as Record<string, unknown>)["__proto__"] !== undefined, true);
});

test("le parseur rejette les surrogates isolés dans les valeurs et les clés", () => {
  assert.throws(() => parseStrictJson(String.raw`{"value":"\uD800"}`, limits), /lone_surrogate/);
  assert.throws(() => parseStrictJson(String.raw`{"\uD800":1}`, limits), /lone_surrogate/);
});

test("le parseur rejette les nombres qui débordent IEEE-754", () => {
  assert.throws(() => parseStrictJson("1e400", limits), /non_finite_number/);
});

test("le parseur applique la grammaire JSON et rejette les données finales", () => {
  for (const invalid of ["01", "+1", "1.", "1e", '{"a":1,}', "[1,]", "true false", '"unterminated']) {
    assert.throws(() => parseStrictJson(invalid, limits), undefined, invalid);
  }
});

test("la limite de taille est calculée en octets UTF-8", () => {
  assert.throws(() => parseStrictJson('{"x":"😀"}', { maxBytes: 8, maxDepth: 4 }), /max_bytes/);
  assert.doesNotThrow(() => parseStrictJson('{"x":"😀"}', { maxBytes: 32, maxDepth: 4 }));
});

test("la limite de profondeur est explicite et appliquée", () => {
  assert.doesNotThrow(() => parseStrictJson("[[0]]", { maxBytes: 32, maxDepth: 2 }));
  assert.throws(() => parseStrictJson("[[[0]]]", { maxBytes: 32, maxDepth: 2 }), /max_depth/);
});

test("les limites manquantes ou incohérentes sont refusées", () => {
  assert.throws(() => parseStrictJson("null", { maxBytes: 0, maxDepth: 1 }), /limits/);
  assert.throws(() => parseStrictJson("null", { maxBytes: 10, maxDepth: -1 }), /limits/);
  assert.throws(() => parseStrictJson("null", { maxBytes: 10, maxDepth: 129 }), /limits/);
});

test("la canonicalisation stricte rejette un JSON dupliqué avant JCS", () => {
  assert.throws(() => canonicalizeStrictJson('{"device":"root","device":"secondary"}', limits), /duplicate_property/);
});
