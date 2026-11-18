import assert from "node:assert/strict";
import test from "node:test";
import canonicalize from "canonicalize";

// RFC 8785, section 3.2.2.1. The fixture is parsed from JSON so the
// canonicalizer receives the actual Unicode/control characters, not source escapes.
test("RFC 8785 JCS-01: numbers, strings and literals", () => {
  const input = JSON.parse(String.raw`{
    "numbers": [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],
    "string": "\\u20ac$\\u000F\\u000aA'\\u0042\\u0022\\u005c\\\\\\u0022\\/",
    "literals": [null, true, false]
  }`);
  const expected = String.raw`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA'B\\\"\\\\\\\\\"/" }`.replace(/" \\}$/, '"}');
  assert.equal(canonicalize(input), expected);
});

test("RFC 8785 JCS-02: property names are sorted by UTF-16 code units", () => {
  const input = {
    "€": "Euro Sign",
    "\r": "Carriage Return",
    "דּ": "Hebrew Letter Dalet With Dagesh",
    "1": "One",
    "😀": "Emoji: Grinning Face",
    "\u0080": "Control",
    "ö": "Latin Small Letter O With Diaeresis",
  };
  const expected = String.raw`{"\\r":"Carriage Return","1":"One","\\u0080":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}`;
  assert.equal(canonicalize(input), expected);
});

test("JCS trie récursivement les objets sans réordonner les tableaux", () => {
  assert.equal(
    canonicalize({ z: [{ b: 2, a: 1 }, { d: 4, c: 3 }], a: { y: 2, x: 1 } }),
    '{"a":{"x":1,"y":2},"z":[{"a":1,"b":2},{"c":3,"d":4}]}',
  );
});

test("JCS refuse les nombres non finis", () => {
  assert.throws(() => canonicalize({ value: Number.NaN }), /NaN/);
  assert.throws(() => canonicalize({ value: Number.POSITIVE_INFINITY }), /Infinity/);
  assert.throws(() => canonicalize({ value: Number.NEGATIVE_INFINITY }), /Infinity/);
});

test("JCS refuse les chaînes contenant un surrogate isolé", () => {
  assert.throws(() => canonicalize({ value: "\\uD800" }), /Lone surrogate/);
});

test("JCS produit des octets UTF-8 stables pour le même objet logique", () => {
  const first = canonicalize({ z: "Niamey", a: "Niger", nested: { b: 2, a: 1 } });
  const second = canonicalize({ nested: { a: 1, b: 2 }, a: "Niger", z: "Niamey" });
  assert.equal(first, second);
  assert.deepEqual(
    new TextEncoder().encode(first),
    new TextEncoder().encode(second),
  );
});
