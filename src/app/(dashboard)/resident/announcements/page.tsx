"use client";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Building notices and updates from management
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : announcements.length === 0 ? (
        <div className="rounded-lg border bg-white px-6 py-12 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No announcements at the moment</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-lg border bg-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold">{a.title}</h2>
                    <Badge className={PRIORITY_COLORS[a.priority] ?? ""}>
                      {PRIORITY_LABELS[a.priority] ?? a.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
