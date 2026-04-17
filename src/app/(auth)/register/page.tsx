import Link from "next/link";
import { Building2, CheckCircle2, Clock, MailX, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "./register-form";
import { getInvitationStatus } from "@/lib/auth/invitations";
import { findInvitationByToken } from "@/server/auth/invitations";
import { db } from "@/server/db/client";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: token } = await searchParams;

  if (!token) {
    return (
      <AuthMessageCard
        icon="mail"
        title="Invitation Required"
        description="Account creation is invite-only. Ask your strata manager or administrator to send you an invitation link."
      />
    );
  }

  const invite = await findInvitationByToken(token);
  const inviteStatus = getInvitationStatus(invite);

  if (inviteStatus === "missing") {
    return (
      <AuthMessageCard
        title="Invite Not Found"
        description="This registration link is invalid or has been removed."
      />
    );
  }

  if (inviteStatus === "accepted") {
    return (
      <AuthMessageCard
        icon="check"
        title="Invite Already Used"
        description="This invitation has already been accepted. Sign in with the invited email to continue."
        actionHref={`/login?redirect=/invite/${token}`}
        actionLabel="Go to Login"
      />
    );
  }

  if (inviteStatus === "revoked") {
    return (
      <AuthMessageCard
        title="Invite Revoked"
        description="This registration link has been revoked. Ask your administrator to send a fresh invitation."
      />
    );
  }

  if (inviteStatus === "expired") {
    return (
      <AuthMessageCard
        icon="clock"
        title="Invite Expired"
        description="This registration link has expired. Ask your administrator for a new invitation."
      />
    );
  }

  const activeInvite = invite!;

  const [organisation, building] = await Promise.all([
    db.organisation.findUnique({
      where: { id: activeInvite.organisationId },
      select: { name: true },
    }),
    activeInvite.buildingId
      ? db.building.findUnique({
          where: { id: activeInvite.buildingId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <RegisterForm
      inviteToken={token}
      invitedEmail={activeInvite.email}
      organisationName={organisation?.name ?? "StrataHub"}
      buildingName={building?.name}
    />
  );
}

function AuthMessageCard({
  title,
  description,
  actionHref = "/login",
  actionLabel = "Go to Login",
  icon = "x",
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: "x" | "check" | "clock" | "mail";
}) {
  const Icon =
    icon === "check"
      ? CheckCircle2
      : icon === "clock"
        ? Clock
        : icon === "mail"
          ? MailX
          : XCircle;
  const color =
    icon === "check"
      ? "text-green-500"
      : icon === "clock"
        ? "text-amber-500"
        : icon === "mail"
          ? "text-slate-500"
          : "text-red-500";

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <Icon className={`mx-auto h-12 w-12 ${color}`} />
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="outline" render={<Link href={actionHref} />}>
          {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
