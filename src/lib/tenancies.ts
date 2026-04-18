export function isTenancySetupPending(tenancy: {
  rentAmountCents: number;
  bondAmountCents: number;
}) {
  return tenancy.rentAmountCents === 0 && tenancy.bondAmountCents === 0;
}
