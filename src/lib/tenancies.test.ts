import test from "node:test";
import assert from "node:assert/strict";
import { isTenancySetupPending } from "@/lib/tenancies";

test("isTenancySetupPending detects zeroed placeholder tenancies", () => {
  assert.equal(
    isTenancySetupPending({ rentAmountCents: 0, bondAmountCents: 0 }),
    true
  );
});

test("isTenancySetupPending ignores configured tenancies", () => {
  assert.equal(
    isTenancySetupPending({ rentAmountCents: 45000, bondAmountCents: 180000 }),
    false
  );
});
