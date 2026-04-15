"use client";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BellRing, CalendarDays, Megaphone } from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export default function ResidentAnnouncementsPage() {
  const { data: announcements = [], isLoading } = trpc.resident.getMyAnnouncements.useQuery();
  const urgentCount = announcements.filter((announcement) => announcement.priority === "URGENT").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Resident Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Announcements and notices
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Stay across building updates, urgent notices, and time-sensitive communication from management.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">At a glance</p>
            <div className="mt-4 space-y-3">
              <ResidentAnnouncementSignal label="Live announcements" value={`${announcements.length}`} />
              <ResidentAnnouncementSignal label="Urgent notices" value={`${urgentCount}`} />
              <ResidentAnnouncementSignal
                label="Latest update"
                value={
                  announcements[0]
                    ? new Date(announcements[0].createdAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })
                    : "No updates"
                }
              />
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-12 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No announcements at the moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <article key={a.id} className="app-panel px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/55 text-accent-foreground">
                      <BellRing className="h-4 w-4" />
                    </div>
                    <h2 className="font-semibold text-foreground">{a.title}</h2>
                    <Badge className={PRIORITY_COLORS[a.priority] ?? ""}>
                      {PRIORITY_LABELS[a.priority] ?? a.priority}
                    </Badge>
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="flex items-center justify-end gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(a.createdAt).toLocaleDateString("en-AU")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.author.firstName} {a.author.lastName}
                  </p>
                  {a.expiresAt && (
                    <p className="text-xs text-orange-500 mt-1">
                      Expires {new Date(a.expiresAt).toLocaleDateString("en-AU")}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ResidentAnnouncementSignal({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
