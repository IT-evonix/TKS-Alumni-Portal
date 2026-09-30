/**
 * npx tsx --test server/utils/student-signup-validation.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStudentSignup } from "./student-signup-validation.ts";

const NOW = new Date("2026-09-30T00:00:00Z");
const base = {
  firstName: "John",
  lastName: "O'Doe-Smith",
  email: "  John.Doe@Example.com ",
  password: "secret1",
  rollNumber: " ab-12/3 ",
  graduationYear: "2026",
};
const bad = (over: Record<string, unknown>, msg?: string) => {
  const r = validateStudentSignup({ ...base, ...over }, NOW);
  assert.equal(r.ok, false, JSON.stringify(over));
  if (msg && !r.ok) assert.equal(r.error, msg);
};

test("valid minimal input is normalised", () => {
  const r = validateStudentSignup(base, NOW);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.data.email, "john.doe@example.com");
  assert.equal(r.data.rollNumber, "AB-12/3");
  assert.equal(r.data.graduationYear, 2026);
  assert.equal(r.data.batch, "2026");
  assert.equal(r.data.phone, null);
  assert.equal(r.data.gender, null);
  assert.equal(r.data.course, null);
});

test("valid full input", () => {
  const r = validateStudentSignup({ ...base, phone: "+91 98765 43210", gender: "prefer_not_to_say", course: "Sci", branch: "PCM", batch: "2026-A", graduationYear: 2031 }, NOW);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.data.phone, "+91 98765 43210");
    assert.equal(r.data.graduationYear, 2031);
    assert.equal(r.data.batch, "2026-A");
  }
});

test("non-object body / missing fields", () => {
  for (const b of [undefined, null, "x", 5, [], {}]) {
    assert.equal(validateStudentSignup(b, NOW).ok, false);
  }
  for (const k of Object.keys(base)) bad({ [k]: undefined }, "Required fields (including Roll Number) are missing");
  bad({ firstName: "   " }, "Required fields (including Roll Number) are missing");
});

test("non-string types rejected", () => {
  bad({ password: 123456 }, "Invalid input format");
  bad({ email: ["a@b.com"] }, "Invalid input format");
  bad({ rollNumber: {} }, "Invalid input format");
  bad({ phone: 9876543210 }, "Invalid input format");
});

test("names", () => {
  bad({ firstName: "<b>Jo</b>" }, "Invalid First Name");
  bad({ firstName: "A" }, "Invalid First Name");
  bad({ firstName: "Jo3" }, "Invalid First Name");
  bad({ firstName: "x".repeat(51) }, "Invalid First Name");
  bad({ lastName: "Doe😀" }, "Invalid Last Name");
});

test("email", () => {
  bad({ email: "notanemail" }, "Invalid email address");
  bad({ email: "a@b" }, "Invalid email address");
  bad({ email: "a".repeat(250) + "@b.com" }, "Invalid email address");
});

test("password", () => {
  bad({ password: "12345" }, "Password must be at least 6 characters");
  bad({ password: "x".repeat(129) }, "Password must be 128 characters or less");
  assert.ok(validateStudentSignup({ ...base, password: "x".repeat(128) }, NOW).ok);
  assert.ok(validateStudentSignup({ ...base, password: "  spaces ok  " }, NOW).ok);
});

test("roll number", () => {
  bad({ rollNumber: "1" }, "Roll Number is too short. Please enter your valid school roll number.");
  bad({ rollNumber: "x".repeat(31) }, "Roll Number is too long");
  bad({ rollNumber: "AB CD1" });
  bad({ rollNumber: "AB<1>" });
  assert.ok(validateStudentSignup({ ...base, rollNumber: "x".repeat(30) }, NOW).ok);
});

test("graduation year bounds follow injected now", () => {
  bad({ graduationYear: "2017" }, "Graduation year must be 2018 or later");
  assert.ok(validateStudentSignup({ ...base, graduationYear: "2018" }, NOW).ok);
  assert.ok(validateStudentSignup({ ...base, graduationYear: "2031" }, NOW).ok);
  bad({ graduationYear: "2032" }, "Graduation year cannot be later than 2031");
  bad({ graduationYear: "2026abc" }, "Invalid graduation year");
  bad({ graduationYear: 2026.5 }, "Invalid graduation year");
  bad({ graduationYear: "abcd" }, "Invalid graduation year");
  bad({ graduationYear: "2999" });
});

test("gender and phone", () => {
  bad({ gender: "robot" }, "Invalid gender");
  assert.ok(validateStudentSignup({ ...base, gender: "" }, NOW).ok);
  bad({ phone: "123" }, "Invalid phone number");
  bad({ phone: "1".repeat(16) }, "Invalid phone number");
  const r = validateStudentSignup({ ...base, phone: "+91<script>9876543210" }, NOW);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.data.phone, "+919876543210");
});
