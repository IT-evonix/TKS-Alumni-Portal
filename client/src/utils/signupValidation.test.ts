import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfirmPassword } from "./signupValidation.ts";

test("empty confirm is required", () => {
  assert.equal(validateConfirmPassword("secret1", ""), "Please confirm your password");
});
test("mismatch is reported", () => {
  assert.equal(validateConfirmPassword("secret1", "secret2"), "Passwords do not match");
});
test("match is valid", () => {
  assert.equal(validateConfirmPassword("secret1", "secret1"), "");
});
test("uses the latest password, not a stale one", () => {
  assert.equal(validateConfirmPassword("newpass", "oldpass"), "Passwords do not match");
  assert.equal(validateConfirmPassword("newpass", "newpass"), "");
});
