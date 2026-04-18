"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  canAccessManagerPath,
  getManagerHomePath,
} from "@/lib/auth/roles";
import type { UserRole } from "@/generated/prisma/client";

export function ManagerRouteGuard({ roles }: { roles: UserRole[] }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!canAccessManagerPath(roles, pathname)) {
      router.replace(getManagerHomePath(roles));
    }
  }, [pathname, roles, router]);

  return null;
}
