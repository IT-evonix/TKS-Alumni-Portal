import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateField,
  validateStep,
  firstInvalidStep,
  isPhoneEmpty,
  defaultGraduationYear,
  passwordStrength,
  mapServerError,
  type StudentSignupForm,
} from "./studentSignupFields.ts";

const valid: StudentSignupForm = {
  firstName: "Aarav",
  lastName: "Sharma",
  gender: "male",
  rollNumber: "465",
  graduationYear: "2027",
  phone: "",
  email: "aarav@example.com",
  password: "secret12",
  confirmPassword: "secret12",
};

test("bare dial code counts as empty phone (optional field)", () => {
  assert.equal(isPhoneEmpty("+91"), true);
  assert.equal(isPhoneEmpty(""), true);
  assert.equal(validateField("phone", "+91"), "");
  assert.equal(isPhoneEmpty("+91 98765 43210"), false);
});

test("phone: valid Indian number passes, bad prefix/length fail", () => {
  assert.equal(validateField("phone", "+91 98765 43210"), "");
  assert.notEqual(validateField("phone", "+91 12345 67890"), "");
  assert.notEqual(validateField("phone", "+91 98765"), "");
});

test("default graduation year rolls over in April", () => {
  assert.equal(defaultGraduationYear(new Date(2026, 1, 1)), 2026);
  assert.equal(defaultGraduationYear(new Date(2026, 3, 1)), 2027);
});

test("step gating reports only that step's fields", () => {
  const empty = { ...valid, firstName: "", rollNumber: "", email: "" };
  assert.deepEqual(Object.keys(validateStep(0, empty)), ["firstName"]);
  assert.deepEqual(Object.keys(validateStep(1, empty)), ["rollNumber"]);
  assert.deepEqual(Object.keys(validateStep(2, empty)), ["email"]);
  assert.equal(firstInvalidStep(valid), -1);
  assert.equal(firstInvalidStep(empty), 0);
});

test("confirm password uses the current password", () => {
  assert.equal(validateField("confirmPassword", "abc", "abcdef"), "Passwords do not match");
  assert.equal(validateField("confirmPassword", "abcdef", "abcdef"), "");
});

test("roll number rules mirror the server", () => {
  assert.notEqual(validateField("rollNumber", "ab"), "");
  assert.notEqual(validateField("rollNumber", "12 34"), "");
  assert.equal(validateField("rollNumber", "X-A/12"), "");
});

test("password strength is advisory and monotonic", () => {
  assert.equal(passwordStrength("").score, 0);
  assert.equal(passwordStrength("abc").score, 1);
  assert.equal(passwordStrength("abcdefgh").score, 1);
  assert.equal(passwordStrength("Abcdefg1").score, 3);
  assert.equal(passwordStrength("Abcdefg1!").label, "Strong");
});

test("server errors map to the right step and field", () => {
  assert.deepEqual(mapServerError(409, "A user with this email already exists").field, "email");
  assert.equal(mapServerError(409, "A profile with this roll number already exists").step, 1);
  assert.equal(mapServerError(429, "Too many registrations").step, -1);
  assert.equal(mapServerError(400, "Invalid First Name").field, "firstName");
});
