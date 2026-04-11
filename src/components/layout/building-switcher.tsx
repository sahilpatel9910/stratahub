"use client";

import { useState, useEffect } from "react";
import { useBuildingContext } from "@/hooks/use-building-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  // Unique org names in order
  const orgNames = Array.from(
    new Set(buildings.map((b) => b.organisationName))
  );

  // Org of the currently selected building
  const selectedBuildingOrg = selectedBuildingId
    ? (buildings.find((b) => b.id === selectedBuildingId)?.organisationName ?? null)
    : null;

  const [selectedOrg, setSelectedOrg] = useState<string>(
    selectedBuildingOrg ?? (orgNames.length === 1 ? orgNames[0] : "")
  );

  // Keep org in sync if building is changed externally
  useEffect(() => {
    if (selectedBuildingOrg && selectedBuildingOrg !== selectedOrg) {
      setSelectedOrg(selectedBuildingOrg);
    }
  }, [selectedBuildingOrg, selectedOrg]);

  // Buildings visible in the building dropdown
  const orgBuildings = selectedOrg
    ? buildings.filter((b) => b.organisationName === selectedOrg)
    : buildings;

  // Auto-select when there is exactly one building
  useEffect(() => {
    if (orgBuildings.length === 1 && !selectedBuildingId) {
      setSelectedBuilding(orgBuildings[0].id, orgBuildings[0].name);
    }
  }, [orgBuildings, selectedBuildingId, setSelectedBuilding]);

  function handleOrgChange(orgName: string | null) {
    if (!orgName) return;
    setSelectedOrg(orgName);
    // Clear building if it belonged to the previous org
    const currentOrg = selectedBuildingId
      ? buildings.find((b) => b.id === selectedBuildingId)?.organisationName
      : null;
    if (currentOrg && currentOrg !== orgName) {
      clearSelectedBuilding();
    }
  }

  function handleBuildingChange(buildingId: string | null) {
    if (!buildingId) return;
    const building = buildings.find((b) => b.id === buildingId);
    if (building) setSelectedBuilding(building.id, building.name);
  }

  return (
    <div className="flex items-center gap-2">
      {/* Organisation selector */}
      <Select
        value={selectedOrg}
        onValueChange={handleOrgChange}
        itemToStringLabel={(v) => String(v ?? "")}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Select org" />
        </SelectTrigger>
        <SelectContent>
          {orgNames.map((name) => (
            <SelectItem key={name} value={name} label={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Building selector — filtered by selected org */}
      <Select
        value={selectedBuildingId ?? ""}
        onValueChange={handleBuildingChange}
        itemToStringLabel={(v) => {
          const s = String(v ?? "");
          const b = buildings.find((b) => b.id === s);
          return b ? b.name : s;
        }}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Select building" />
        </SelectTrigger>
        <SelectContent>
          {orgBuildings.map((b) => (
            <SelectItem key={b.id} value={b.id} label={b.name}>
              <div>
                <p className="font-medium text-sm">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.suburb}</p>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
