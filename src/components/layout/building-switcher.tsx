"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { useBuildingContext } from "@/hooks/use-building-context";

interface Building {
  id: string;
  name: string;
  suburb: string;
  organisationName: string;
}

interface BuildingSwitcherProps {
  buildings: Building[];
}

export function BuildingSwitcher({ buildings }: BuildingSwitcherProps) {
  const { selectedBuildingId, setSelectedBuilding, clearSelectedBuilding } =
    useBuildingContext();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedBuildingId && !buildings.some((b) => b.id === selectedBuildingId)) {
      clearSelectedBuilding();
    }
  }, [buildings, clearSelectedBuilding, selectedBuildingId]);

  useEffect(() => {
    if (buildings.length === 1) {
      const b = buildings[0];
      if (selectedBuildingId !== b.id) setSelectedBuilding(b.id, b.name);
    }
  }, [buildings, selectedBuildingId, setSelectedBuilding]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (buildings.length === 0) return null;

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const orgNames = Array.from(new Set(buildings.map((b) => b.organisationName)));
  const showOrgs = orgNames.length > 1;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/85 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="max-w-[180px] truncate">
          {selectedBuilding?.name ?? "Select building"}
        </span>
        {selectedBuilding && (
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            · {selectedBuilding.organisationName}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-[1rem] border border-border bg-popover shadow-[0_24px_48px_rgba(15,23,42,0.18)]"
          >
            {showOrgs
              ? orgNames.map((org) => (
                  <div key={org}>
                    <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {org}
                    </div>
                    {buildings
                      .filter((b) => b.organisationName === org)
                      .map((b) => (
                        <BuildingOption
                          key={b.id}
                          building={b}
                          selected={b.id === selectedBuildingId}
                          onSelect={() => {
                            setSelectedBuilding(b.id, b.name);
                            setOpen(false);
                          }}
                        />
                      ))}
                  </div>
                ))
              : buildings.map((b) => (
                  <BuildingOption
                    key={b.id}
                    building={b}
                    selected={b.id === selectedBuildingId}
                    onSelect={() => {
                      setSelectedBuilding(b.id, b.name);
                      setOpen(false);
                    }}
                  />
                ))}
          </div>
        </>
      )}
    </div>
  );
}

function BuildingOption({
  building,
  selected,
  onSelect,
}: {
  building: Building;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${selected ? "bg-muted/40" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${selected ? "text-foreground" : "text-foreground/80"}`}>
          {building.name}
        </p>
        <p className="text-xs text-muted-foreground">{building.suburb}</p>
      </div>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}
