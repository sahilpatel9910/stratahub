import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import Link from "next/link";
import { Building2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AcceptInviteButton } from "./accept-invite-button";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  BUILDING_MANAGER: "Building Manager",
  RECEPTION: "Reception",
  OWNER: "Owner",
  TENANT: "Tenant",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Fetch the invite from DB (server-side, no API call needed)
  const invite = await db.invitation.findUnique({ where: { token } });

  if (!invite) {
    return <InviteLayout><ErrorCard title="Invite Not Found" message="This invite link is invalid or has been revoked." /></InviteLayout>;
  }

  if (invite.acceptedAt) {
    return <InviteLayout><ErrorCard title="Already Accepted" message="This invite has already been accepted." icon="check" /></InviteLayout>;
  }

  if (invite.expiresAt < new Date()) {
    return <InviteLayout><ErrorCard title="Invite Expired" message="This invite link has expired. Please ask your administrator for a new invite." icon="clock" /></InviteLayout>;
  }

  // Fetch org + building details
  const [org, building] = await Promise.all([
    db.organisation.findUnique({
      where: { id: invite.organisationId },
      select: { name: true },
    }),
    invite.buildingId
      ? db.building.findUnique({
          where: { id: invite.buildingId },
          select: { name: true, suburb: true, state: true },
        })
      : null,
  ]);

  // Check if user is already authenticated
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  return (
    <InviteLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl">You&apos;ve been invited</CardTitle>
          <CardDescription>
            You have been invited to join <strong>{org?.name ?? "an organisation"}</strong> on StrataHub.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
            <DetailRow label="Role">
              <Badge variant="outline">{ROLE_LABELS[invite.role] ?? invite.role}</Badge>
            </DetailRow>
            <DetailRow label="Organisation" value={org?.name ?? "—"} />
            {building && (
              <DetailRow
                label="Building"
                value={`${building.name}, ${building.suburb} ${building.state}`}
              />
            )}
            <DetailRow
              label="Expires"
              value={new Date(invite.expiresAt).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
          </div>

          {authUser ? (
            authUser.email?.toLowerCase() === invite.email.toLowerCase() ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Signed in as <strong>{authUser.email}</strong>
                </p>
                <AcceptInviteButton token={token} role={invite.role} />
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3 text-sm">
                <p className="font-medium text-amber-800">Wrong account</p>
                <p className="text-amber-700">
                  You&apos;re signed in as <strong>{authUser.email}</strong>, but this invite is for a different account.
                </p>
                <p className="text-amber-700">
                  Please sign out and sign in with the correct account to accept this invite.
                </p>
                <Button
                  className="w-full"
                  variant="outline"
                  render={<Link href={`/api/auth/signout?redirect=/invite/${token}`} />}
                >
                  Sign Out &amp; Switch Account
                </Button>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Sign in or create an account to accept this invite.
              </p>
              <div className="flex flex-col gap-2">
                <Button render={<Link href={`/register?invite=${token}`} />}>
                  Create Account &amp; Accept
                </Button>
                <Button variant="outline" render={<Link href={`/login?redirect=/invite/${token}`} />}>
                  Sign In &amp; Accept
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </InviteLayout>
  );
}

function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {children}
    </div>
  );
}

function ErrorCard({
  title,
  message,
  icon = "x",
}: {
  title: string;
  message: string;
  icon?: "x" | "check" | "clock";
}) {
  const Icon = icon === "check" ? CheckCircle2 : icon === "clock" ? Clock : XCircle;
  const color = icon === "check" ? "text-green-500" : icon === "clock" ? "text-amber-500" : "text-red-500";

  return (
    <Card className="w-full max-w-md text-center">
      <CardContent className="pt-10 pb-6 space-y-3">
        <Icon className={`mx-auto h-12 w-12 ${color}`} />
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button variant="outline" render={<Link href="/login" />}>
          Go to Login
        </Button>
      </CardFooter>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children ?? <span className="font-medium">{value}</span>}
    </div>
  );
}
