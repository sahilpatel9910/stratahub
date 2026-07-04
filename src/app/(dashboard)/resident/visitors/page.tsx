"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, UserCheck, Users } from "lucide-react";
import { formatDateTime } from "@/lib/constants";

const PURPOSE_LABELS: Record<string, string> = {
  PERSONAL: "Personal",
  DELIVERY: "Delivery",
  TRADESPERSON: "Tradesperson",
  REAL_ESTATE: "Real Estate",
  INSPECTION: "Inspection",
  OTHER: "Other",
};

export default function ResidentVisitorsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorCompany, setVisitorCompany] = useState("");
  const [purpose, setPurpose] = useState("PERSONAL");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [notes, setNotes] = useState("");

  const { data: visitors = [], isLoading, refetch } = trpc.visitors.listMyVisitors.useQuery();
  const { data: building } = trpc.resident.getMyBuilding.useQuery();

  const utils = trpc.useUtils();

  const createVisitor = trpc.visitors.create.useMutation({
    onSuccess: () => {
      toast.success("Visitor pre-registered successfully");
      setCreateOpen(false);
      resetForm();
      refetch();
      void utils.visitors.listMyVisitors.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setVisitorName("");
    setVisitorPhone("");
    setVisitorCompany("");
    setPurpose("PERSONAL");
    setVehiclePlate("");
    setNotes("");
  }

  function handleSubmit() {
    if (!visitorName.trim()) return toast.error("Visitor name is required");
    if (!building?.id) return toast.error("No building found");
    createVisitor.mutate({
      buildingId: building.id,
      visitorName: visitorName.trim(),
      visitorPhone: visitorPhone.trim() || undefined,
      visitorCompany: visitorCompany.trim() || undefined,
      purpose: purpose as "PERSONAL",
      vehiclePlate: vehiclePlate.trim() || undefined,
      notes: notes.trim() || undefined,
      preApproved: true,
    });
  }

  const upcoming = visitors.filter((v) => !v.departureTime);
  const past = visitors.filter((v) => !!v.departureTime);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Header */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow-label text-primary/80">Resident Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Visitor pre-registration
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Pre-register expected visitors so reception can grant them quick entry.
            </p>
          </div>
          <Button
            className="h-11 rounded-xl px-5"
            onClick={() => setCreateOpen(true)}
            disabled={!building}
          >
            <Plus className="mr-2 h-4 w-4" />
            Register Visitor
          </Button>
        </div>
      </section>

      {/* Upcoming / Active */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
            Active visitors
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-registered or currently on-site visitors
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="space-y-3 px-6 py-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </CardContent>
          </Card>
        ) : upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No active visitors</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Pre-register a visitor so reception knows to expect them.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((v) => (
              <VisitorCard key={v.id} visitor={v} />
            ))}
          </div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
              Past visitors
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Previously registered visitors who have departed
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {past.map((v) => (
              <VisitorCard key={v.id} visitor={v} isPast />
            ))}
          </div>
        </div>
      )}

      {/* Register Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">Pre-register a Visitor</DialogTitle>
            <DialogDescription className="px-6">
              Let reception know who to expect. Pre-approved visitors can be signed in faster.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-7 pb-6">
            <div className="flex flex-col gap-5 py-6">
              <div className="flex flex-col gap-1.5">
                <Label>Visitor name <span className="text-destructive">*</span></Label>
                <Input
                  className="h-11 rounded-xl bg-background"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="e.g. John Smith"
                  maxLength={200}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Phone</Label>
                  <Input
                    className="h-11 rounded-xl bg-background"
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    placeholder="0412 345 678"
                    maxLength={30}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Company</Label>
                  <Input
                    className="h-11 rounded-xl bg-background"
                    value={visitorCompany}
                    onChange={(e) => setVisitorCompany(e.target.value)}
                    placeholder="Optional"
                    maxLength={200}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Purpose</Label>
                  <Select
                    value={purpose}
                    onValueChange={(v) => v !== null && setPurpose(v)}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PURPOSE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Vehicle plate</Label>
                  <Input
                    className="h-11 rounded-xl bg-background"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="Optional"
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Notes</Label>
                <Textarea
                  className="min-h-20 rounded-xl bg-background"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional info for reception..."
                  rows={3}
                  maxLength={1000}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="px-7">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createVisitor.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createVisitor.isPending}>
              {createVisitor.isPending ? "Registering..." : "Pre-register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Visitor Card ────────────────────────────────────────────────────────────

function VisitorCard({
  visitor,
  isPast = false,
}: {
  visitor: {
    id: string;
    visitorName: string;
    visitorPhone: string | null;
    visitorCompany: string | null;
    purpose: string;
    vehiclePlate: string | null;
    preApproved: boolean;
    arrivalTime: Date | string | null;
    departureTime: Date | string | null;
    createdAt: Date | string;
  };
  isPast?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card px-5 py-4 ${isPast ? "opacity-60" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm text-foreground truncate">
            {visitor.visitorName}
          </p>
          {visitor.visitorCompany && (
            <span className="text-xs text-muted-foreground">· {visitor.visitorCompany}</span>
          )}
          <Badge className="text-[11px] bg-secondary text-secondary-foreground">
            {PURPOSE_LABELS[visitor.purpose] ?? visitor.purpose}
          </Badge>
          {visitor.preApproved && (
            <Badge className="text-[11px] bg-emerald-100 text-emerald-700">
              <UserCheck className="mr-1 h-3 w-3" />
              Pre-approved
            </Badge>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Registered: {formatDateTime(visitor.createdAt)}</span>
          {visitor.arrivalTime && (
            <span>· Arrived: {formatDateTime(visitor.arrivalTime)}</span>
          )}
          {visitor.departureTime && (
            <span>· Departed: {formatDateTime(visitor.departureTime)}</span>
          )}
          {visitor.vehiclePlate && (
            <span>· Plate: {visitor.vehiclePlate}</span>
          )}
        </div>
      </div>
    </div>
  );
}
