import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeStrictJson,
  parseStrictJson,
  type StrictJsonLimits,
} from "../src/services/crypto/strict-json.ts";

// Caller limits are additionally bounded by absolute parser ceilings (1 MiB / depth 128).
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
  assert.throws(() => parseStrictJson('{"x":"é"}', { maxBytes: 9, maxDepth: 4 }), /max_bytes/);
  assert.doesNotThrow(() => parseStrictJson('{"x":"😀"}', { maxBytes: 32, maxDepth: 4 }));
});

test("la limite de profondeur est explicite et appliquée", () => {
  assert.doesNotThrow(() => parseStrictJson("[[0]]", { maxBytes: 32, maxDepth: 2 }));
  assert.throws(() => parseStrictJson("[[[0]]]", { maxBytes: 32, maxDepth: 2 }), /max_depth/);
});

test("les limites manquantes ou incohérentes sont refusées", () => {
  assert.throws(() => parseStrictJson("null", { maxBytes: 0, maxDepth: 1 }), /limits/);
  assert.throws(() => parseStrictJson("null", { maxBytes: 10, maxDepth: -1 }), /limits/);
  assert.throws(() => parseStrictJson("null", { maxBytes: 1_048_577, maxDepth: 1 }), /limits/);
  assert.throws(() => parseStrictJson("null", { maxBytes: 10, maxDepth: 129 }), /limits/);
  assert.throws(() => parseStrictJson("null", { maxBytes: 10, maxDepth: 129 }), /limits/);
});

test("la canonicalisation stricte rejette un JSON dupliqué avant JCS", () => {
  assert.throws(() => canonicalizeStrictJson('{"device":"root","device":"secondary"}', limits), /duplicate_property/);
});


test("le parseur strict reproduit exactement le vecteur de sérialisation RFC 8785", () => {
  const source = String.raw`{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],"string":"\u20ac$\u000F\u000aA'\u0042\u0022\u005c\\\"\/","literals":[null,true,false]}`;
  const expected = String.raw`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}`;
  assert.equal(canonicalizeStrictJson(source, limits), expected);
});

test("le parseur strict refuse un surrogate isolé brut dans le texte source", () => {
  const source = '"' + String.fromCharCode(0xd800) + '"';
  assert.throws(() => parseStrictJson(source, limits), /lone_surrogate/);
});

test("la canonicalisation ne normalise pas Unicode", () => {
  const composed = canonicalizeStrictJson(String.raw`{"value":"\u00e9"}`, limits);
  const decomposed = canonicalizeStrictJson(String.raw`{"value":"e\u0301"}`, limits);
  assert.notEqual(composed, decomposed);
});


test("JCS trie les noms de propriétés selon les unités de code UTF-16", () => {
  const source = String.raw`{"\\uE000":1,"\\uD83D\\uDE00":2}`;
  assert.equal(canonicalizeStrictJson(source, limits), '{"😀":2,"":1}');
});

test("JCS sérialise -0 comme 0 et conserve les valeurs numériques IEEE-754", () => {
  assert.equal(canonicalizeStrictJson("[-0,0,1.0,1e0]", limits), "[0,0,1,1]");
});
