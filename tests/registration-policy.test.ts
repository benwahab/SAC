import assert from "node:assert/strict";
import test from "node:test";
import { validateRegistrationInput } from "../src/domain/registration-policy.ts";

const valid = {
  email: "  Person.Example+SAC@Example.NE  ",
  phone: "+227 90 00 00 00",
  password: "correct horse battery",
  language: "fr",
};

test("normalise l'adresse e-mail et le téléphone international", () => {
  assert.deepEqual(validateRegistrationInput(valid), {
    ok: true,
    value: {
      email: "person.example+sac@example.ne",
      phone: "+22790000000",
      password: "correct horse battery",
      language: "fr",
    },
  });
});

test("refuse les adresses e-mail mal formées", () => {
  for (const email of ["", "x", "a@@example.ne", ".a@example.ne", "a..b@example.ne", "a@example", "a@-example.ne"]) {
    assert.deepEqual(validateRegistrationInput({ ...valid, email }), {
      ok: false,
      error: "invalid_email",
    });
  }
});

test("refuse un téléphone sans indicatif international", () => {
  for (const phone of ["90000000", "0022790000000", "+0 90000000", "+227123"]) {
    assert.deepEqual(validateRegistrationInput({ ...valid, phone }), {
      ok: false,
      error: "invalid_phone",
    });
  }
});

test("accepte les mots de passe longs avec espaces et Unicode sans les modifier", () => {
  const password = "  phrase de passe très longue 🔐  ";
  const result = validateRegistrationInput({ ...valid, password });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.password, password);
});

test("applique la longueur minimale de mot de passe déjà validée", () => {
  assert.deepEqual(validateRegistrationInput({ ...valid, password: "court" }), {
    ok: false,
    error: "password_too_short",
  });
});

test("refuse une langue non prise en charge", () => {
  assert.deepEqual(validateRegistrationInput({ ...valid, language: "xx" }), {
    ok: false,
    error: "invalid_language",
  });
});

test("ne transforme jamais une absence de mot de passe en chaîne vide", () => {
  assert.deepEqual(validateRegistrationInput({ ...valid, password: null }), {
    ok: false,
    error: "password_required",
  });
});
