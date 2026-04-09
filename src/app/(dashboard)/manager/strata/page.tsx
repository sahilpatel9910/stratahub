"use client";

import { useState, useEffect } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Landmark, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toInputDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export default function StrataPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [tab, setTab] = useState("info");
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);

  // Info form state
  const [formPlanNo, setFormPlanNo] = useState("");
  const [formManagerName, setFormManagerName] = useState("");
  const [formManagerEmail, setFormManagerEmail] = useState("");
  const [formManagerPhone, setFormManagerPhone] = useState("");
  const [formAdminFund, setFormAdminFund] = useState("");
  const [formCapitalWorks, setFormCapitalWorks] = useState("");
  const [formInsuranceNo, setFormInsuranceNo] = useState("");
  const [formInsuranceExpiry, setFormInsuranceExpiry] = useState("");
  const [formNextAgm, setFormNextAgm] = useState("");

  // Meeting form state
  const [formMeetingTitle, setFormMeetingTitle] = useState("");
  const [formMeetingDate, setFormMeetingDate] = useState("");
  const [formMeetingLocation, setFormMeetingLocation] = useState("");
  const [formMeetingNotes, setFormMeetingNotes] = useState("");

  const utils = trpc.useUtils();

  const query = trpc.strata.getByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const upsertMutation = trpc.strata.upsertInfo.useMutation({
    onSuccess: () => {
      utils.strata.getByBuilding.invalidate();
      setEditInfoOpen(false);
      toast.success("Strata info saved");
    },
    onError: (err) => toast.error(err.message ?? "Failed to save strata info"),
  });

  const createMeetingMutation = trpc.strata.createMeeting.useMutation({
    onSuccess: () => {
      utils.strata.getByBuilding.invalidate();
      setMeetingOpen(false);
      resetMeetingForm();
      toast.success("Meeting added");
    },
    onError: (err) => toast.error(err.message ?? "Failed to add meeting"),
  });

  const deleteMeetingMutation = trpc.strata.deleteMeeting.useMutation({
    onSuccess: () => {
      utils.strata.getByBuilding.invalidate();
      toast.success("Meeting deleted");
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete meeting"),
  });

  const strataInfo = query.data;

  // Pre-fill form when edit dialog opens
  useEffect(() => {
    if (editInfoOpen && strataInfo) {
      setFormPlanNo(strataInfo.strataPlanNumber ?? "");
      setFormManagerName(strataInfo.strataManagerName ?? "");
      setFormManagerEmail(strataInfo.strataManagerEmail ?? "");
      setFormManagerPhone(strataInfo.strataManagerPhone ?? "");
      setFormAdminFund(
        strataInfo.adminFundBalance != null
          ? String(strataInfo.adminFundBalance / 100)
          : ""
      );
      setFormCapitalWorks(
        strataInfo.capitalWorksBalance != null
          ? String(strataInfo.capitalWorksBalance / 100)
          : ""
      );
      setFormInsuranceNo(strataInfo.insurancePolicyNo ?? "");
      setFormInsuranceExpiry(toInputDate(strataInfo.insuranceExpiry));
      setFormNextAgm(toInputDate(strataInfo.nextAgmDate));
    } else if (editInfoOpen) {
      setFormPlanNo("");
      setFormManagerName("");
      setFormManagerEmail("");
      setFormManagerPhone("");
      setFormAdminFund("");
      setFormCapitalWorks("");
      setFormInsuranceNo("");
      setFormInsuranceExpiry("");
      setFormNextAgm("");
    }
  }, [editInfoOpen, strataInfo]);

  function resetMeetingForm() {
    setFormMeetingTitle("");
    setFormMeetingDate("");
    setFormMeetingLocation("");
    setFormMeetingNotes("");
  }

  function handleSaveInfo() {
    if (!selectedBuildingId || !formPlanNo.trim()) return;
    upsertMutation.mutate({
      buildingId: selectedBuildingId,
      strataPlanNumber: formPlanNo.trim(),
      strataManagerName: formManagerName.trim() || undefined,
      strataManagerEmail: formManagerEmail.trim() || undefined,
      strataManagerPhone: formManagerPhone.trim() || undefined,
      adminFundBalance: formAdminFund
        ? Math.round(parseFloat(formAdminFund) * 100)
        : undefined,
      capitalWorksBalance: formCapitalWorks
        ? Math.round(parseFloat(formCapitalWorks) * 100)
        : undefined,
      insurancePolicyNo: formInsuranceNo.trim() || undefined,
      insuranceExpiry: formInsuranceExpiry || undefined,
      nextAgmDate: formNextAgm || undefined,
    });
  }

  function handleAddMeeting() {
    if (!selectedBuildingId || !formMeetingTitle.trim() || !formMeetingDate) return;
    createMeetingMutation.mutate({
      buildingId: selectedBuildingId,
      title: formMeetingTitle.trim(),
      meetingDate: formMeetingDate,
      location: formMeetingLocation.trim() || undefined,
      notes: formMeetingNotes.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Strata</h1>
          <p className="text-muted-foreground">
            Manage strata plan details, levies, bylaws, and meetings
          </p>
        </div>
        <Button
          onClick={() => setEditInfoOpen(true)}
          disabled={!selectedBuildingId}
        >
          <Pencil className="mr-2 h-4 w-4" />
          {strataInfo ? "Edit Info" : "Set Up Strata"}
        </Button>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view strata details.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="levies">Levies</TabsTrigger>
            <TabsTrigger value="bylaws">Bylaws</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="mt-4">
            {query.isLoading ? (
              <Card>
                <CardContent className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-full max-w-sm" />
                  ))}
                </CardContent>
              </Card>
            ) : !strataInfo ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Landmark className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">
                    Strata information has not been configured for this building.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => setEditInfoOpen(true)}
                  >
                    Set Up Strata
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Strata Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <InfoRow label="Plan Number" value={strataInfo.strataPlanNumber} />
                    <InfoRow label="Manager" value={strataInfo.strataManagerName} />
                    <InfoRow label="Email" value={strataInfo.strataManagerEmail} />
                    <InfoRow label="Phone" value={strataInfo.strataManagerPhone} />
                    <InfoRow label="Next AGM" value={formatDate(strataInfo.nextAgmDate)} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Finances &amp; Insurance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <InfoRow
                      label="Admin Fund"
                      value={
                        strataInfo.adminFundBalance != null
                          ? formatCurrency(strataInfo.adminFundBalance)
                          : null
                      }
                    />
                    <InfoRow
                      label="Capital Works Fund"
                      value={
                        strataInfo.capitalWorksBalance != null
                          ? formatCurrency(strataInfo.capitalWorksBalance)
                          : null
                      }
                    />
                    <InfoRow label="Insurance Policy" value={strataInfo.insurancePolicyNo} />
                    <InfoRow
                      label="Insurance Expiry"
                      value={formatDate(strataInfo.insuranceExpiry)}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Meetings Tab */}
          <TabsContent value="meetings" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button
                onClick={() => setMeetingOpen(true)}
                disabled={!strataInfo}
                title={!strataInfo ? "Set up strata info first" : undefined}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Meeting
              </Button>
            </div>
            {query.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-5 w-40 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !strataInfo?.meetings.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-muted-foreground text-sm">
                    No meetings recorded.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {strataInfo.meetings.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {formatDate(m.meetingDate)}
                            {m.location && ` · ${m.location}`}
                          </p>
                          {m.notes && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {m.notes}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          disabled={deleteMeetingMutation.isPending}
                          onClick={() =>
                            deleteMeetingMutation.mutate({ id: m.id })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Levies Tab */}
          <TabsContent value="levies" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Levy management coming soon. Levies are stored and can be queried via the database.
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bylaws Tab */}
          <TabsContent value="bylaws" className="mt-4">
            {!strataInfo?.bylaws.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  No bylaws recorded.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {strataInfo.bylaws.map((b) => (
                  <Card key={b.id}>
                    <CardContent className="p-4">
                      <p className="font-medium text-sm">
                        {b.bylawNumber}. {b.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {b.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Effective {formatDate(b.effectiveDate)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Edit Info Dialog */}
      <Dialog open={editInfoOpen} onOpenChange={setEditInfoOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Strata Information</DialogTitle>
            <DialogDescription>
              Configure the strata plan details for this building
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="planNo">Strata Plan Number *</Label>
              <Input
                id="planNo"
                placeholder="e.g. SP 12345"
                value={formPlanNo}
                onChange={(e) => setFormPlanNo(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mgName">Manager Name</Label>
                <Input
                  id="mgName"
                  value={formManagerName}
                  onChange={(e) => setFormManagerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mgPhone">Manager Phone</Label>
                <Input
                  id="mgPhone"
                  value={formManagerPhone}
                  onChange={(e) => setFormManagerPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mgEmail">Manager Email</Label>
              <Input
                id="mgEmail"
                type="email"
                value={formManagerEmail}
                onChange={(e) => setFormManagerEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminFund">Admin Fund Balance ($)</Label>
                <Input
                  id="adminFund"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formAdminFund}
                  onChange={(e) => setFormAdminFund(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capWorks">Capital Works Balance ($)</Label>
                <Input
                  id="capWorks"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formCapitalWorks}
                  onChange={(e) => setFormCapitalWorks(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="insNo">Insurance Policy No.</Label>
                <Input
                  id="insNo"
                  value={formInsuranceNo}
                  onChange={(e) => setFormInsuranceNo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insExpiry">Insurance Expiry</Label>
                <Input
                  id="insExpiry"
                  type="date"
                  value={formInsuranceExpiry}
                  onChange={(e) => setFormInsuranceExpiry(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextAgm">Next AGM Date</Label>
              <Input
                id="nextAgm"
                type="date"
                value={formNextAgm}
                onChange={(e) => setFormNextAgm(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditInfoOpen(false)}
              disabled={upsertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveInfo}
              disabled={!formPlanNo.trim() || upsertMutation.isPending}
            >
              {upsertMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Meeting Dialog */}
      <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Meeting</DialogTitle>
            <DialogDescription>
              Record a strata committee or general meeting
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mtTitle">Title *</Label>
              <Input
                id="mtTitle"
                placeholder="e.g. Annual General Meeting"
                value={formMeetingTitle}
                onChange={(e) => setFormMeetingTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mtDate">Date *</Label>
                <Input
                  id="mtDate"
                  type="date"
                  value={formMeetingDate}
                  onChange={(e) => setFormMeetingDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mtLocation">Location</Label>
                <Input
                  id="mtLocation"
                  placeholder="e.g. Common Room"
                  value={formMeetingLocation}
                  onChange={(e) => setFormMeetingLocation(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mtNotes">Notes</Label>
              <Textarea
                id="mtNotes"
                rows={3}
                value={formMeetingNotes}
                onChange={(e) => setFormMeetingNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMeetingOpen(false);
                resetMeetingForm();
              }}
              disabled={createMeetingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMeeting}
              disabled={
                !formMeetingTitle.trim() ||
                !formMeetingDate ||
                createMeetingMutation.isPending
              }
            >
              {createMeetingMutation.isPending ? "Adding..." : "Add Meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}
