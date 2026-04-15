import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, ShieldAlert } from "lucide-react";
import { findPendingInvitationByEmail } from "@/server/auth/invitations";

export default async function AccessRequiredPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pendingInvite = user?.email
    ? await findPendingInvitationByEmail(user.email)
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(145deg,rgba(22,78,99,0.12),transparent_42%),linear-gradient(180deg,#f8fbfc_0%,#edf4f7_100%)] px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Access not active yet</CardTitle>
          <CardDescription>
            This account is signed in, but it does not currently have an active StrataHub assignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Use the same email address your administrator invited. If you were expecting access, ask them to resend or reactivate your invitation.
              </p>
            </div>
          </div>
          {pendingInvite ? (
            <p>
              A pending invitation was found for <strong>{user?.email}</strong>. Open it to complete your access setup.
            </p>
          ) : (
            <p>
              No active invitation was found for <strong>{user?.email}</strong>. Contact your strata manager or administrator for access.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {pendingInvite && (
            <Button className="w-full" render={<Link href={`/invite/${pendingInvite.token}`} />}>
              Open Pending Invitation
            </Button>
          )}
          <Button
            className="w-full"
            variant="outline"
            render={<Link href="/api/auth/signout?redirect=/login" />}
          >
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
