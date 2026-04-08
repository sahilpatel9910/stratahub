"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BuildingContextState {
  selectedBuildingId: string | null;
  selectedBuildingName: string | null;
  setSelectedBuilding: (id: string, name: string) => void;
  clearSelectedBuilding: () => void;
}

export const useBuildingContext = create<BuildingContextState>()(
  persist(
    (set) => ({
      selectedBuildingId: null,
      selectedBuildingName: null,
      setSelectedBuilding: (id, name) =>
        set({ selectedBuildingId: id, selectedBuildingName: name }),
      clearSelectedBuilding: () =>
        set({ selectedBuildingId: null, selectedBuildingName: null }),
    }),
    {
      name: "strata-hub-building",
    }
  )
);
