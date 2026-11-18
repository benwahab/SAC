import assert from "node:assert/strict";
import test from "node:test";
import canonicalize from "canonicalize";

// RFC 8785, section 3.2.2.1.
test("RFC 8785 JCS-01: numbers, strings and literals", () => {
  const input = {
    numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 1e-27],
    string: "€$\u000f\nA'B\"\\\\\"/",
    literals: [null, true, false],
  };
  const expected = String.raw`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}`;
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
  const expected = String.raw`{"\r":"Carriage Return","1":"One","\u0080":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}`.replace("\\u0080", "\u0080");
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
  assert.throws(() => canonicalize({ value: "\uD800" }), /Lone surrogate/);
});

test("JCS produit des octets UTF-8 stables pour le même objet logique", () => {
  const first = canonicalize({ z: "Niamey", a: "Niger", nested: { b: 2, a: 1 } });
  const second = canonicalize({ nested: { a: 1, b: 2 }, a: "Niger", z: "Niamey" });
  assert.equal(first, second);
  assert.deepEqual(new TextEncoder().encode(first), new TextEncoder().encode(second));
});


test("RFC 8785 Appendix B: IEEE-754 number serialization vectors", () => {
  const vectors: Array<[string, string]> = [
    ["0000000000000000", "0"],
    ["8000000000000000", "0"],
    ["0000000000000001", "5e-324"],
    ["8000000000000001", "-5e-324"],
    ["7fefffffffffffff", "1.7976931348623157e+308"],
    ["ffefffffffffffff", "-1.7976931348623157e+308"],
    ["4340000000000000", "9007199254740992"],
    ["c340000000000000", "-9007199254740992"],
    ["4430000000000000", "295147905179352830000"],
    ["44b52d02c7e14af5", "9.999999999999997e+22"],
    ["44b52d02c7e14af6", "1e+23"],
    ["44b52d02c7e14af7", "1.0000000000000001e+23"],
    ["444b1ae4d6e2ef4e", "999999999999999700000"],
    ["444b1ae4d6e2ef4f", "999999999999999900000"],
    ["444b1ae4d6e2ef50", "1e+21"],
    ["3eb0c6f7a0b5ed8c", "9.999999999999997e-7"],
    ["3eb0c6f7a0b5ed8d", "0.000001"],
    ["41b3de4355555553", "333333333.3333332"],
    ["41b3de4355555554", "333333333.33333325"],
    ["41b3de4355555555", "333333333.3333333"],
    ["41b3de4355555556", "333333333.3333334"],
    ["41b3de4355555557", "333333333.33333343"],
    ["becbf647612f3696", "-0.0000033333333333333333"],
    ["43143ff3c1cb0959", "1424953923781206.2"],
  ];

  for (const [hex, expected] of vectors) {
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, BigInt("0x" + hex), false);
    assert.equal(canonicalize(view.getFloat64(0, false)), expected, "IEEE-754 vector " + hex);
  }
});

test("RFC 8785 Appendix B: out-of-range NaN and Infinity vectors are rejected", () => {
  for (const hex of ["7fffffffffffffff", "7ff0000000000000"]) {
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, BigInt("0x" + hex), false);
    assert.throws(() => canonicalize(view.getFloat64(0, false)));
  }
});
