export const APP_NAME = "StrataHub";

export const AUSTRALIAN_STATES = [
  { value: "NSW", label: "New South Wales" },
  { value: "VIC", label: "Victoria" },
  { value: "QLD", label: "Queensland" },
  { value: "SA", label: "South Australia" },
  { value: "WA", label: "Western Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "NT", label: "Northern Territory" },
  { value: "ACT", label: "Australian Capital Territory" },
] as const;

export const USER_ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  BUILDING_MANAGER: "Building Manager",
  RECEPTION: "Reception",
  OWNER: "Owner",
  TENANT: "Tenant",
} as const;

export const UNIT_TYPE_LABELS = {
  APARTMENT: "Apartment",
  STUDIO: "Studio",
  PENTHOUSE: "Penthouse",
  TOWNHOUSE: "Townhouse",
  COMMERCIAL: "Commercial",
  STORAGE: "Storage",
  PARKING: "Parking",
} as const;

export const MAINTENANCE_CATEGORY_LABELS = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  HVAC: "HVAC",
  STRUCTURAL: "Structural",
  APPLIANCE: "Appliance",
  PEST_CONTROL: "Pest Control",
  CLEANING: "Cleaning",
  SECURITY: "Security",
  LIFT: "Lift/Elevator",
  COMMON_AREA: "Common Area",
  OTHER: "Other",
} as const;

export const PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
} as const;

export const BOND_LODGEMENT_AUTHORITIES = {
  NSW: "NSW Fair Trading - Rental Bond Board",
  VIC: "Residential Tenancies Bond Authority (RTBA)",
  QLD: "Residential Tenancies Authority (RTA)",
  SA: "Consumer and Business Services (CBS)",
  WA: "Bond Administrator - Department of Mines, Industry Regulation and Safety",
  TAS: "Rental Deposit Authority",
  NT: "Northern Territory Consumer Affairs",
  ACT: "Office of Rental Bonds",
} as const;

// Bond lodgement deadlines in business days after receiving bond
export const BOND_LODGEMENT_DEADLINES_DAYS = {
  NSW: 10,
  VIC: 10,
  QLD: 10,
  SA: 14,
  WA: 14,
  TAS: 10,
  NT: 10,
  ACT: 10,
} as const;

// Cents helper
export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}
