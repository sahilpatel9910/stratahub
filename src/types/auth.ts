import type { UserRole } from "@/generated/prisma";

export type AuthUser = {
  id: string;
  supabaseAuthId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: UserRole;
  organisationId: string | null;
  buildingIds: string[];
};

export type SessionContext = {
  user: AuthUser | null;
};
