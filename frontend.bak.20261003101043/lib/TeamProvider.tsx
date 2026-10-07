"use client";

import { createContext, useContext } from "react";
import type { TeamMember } from "./types";

const TeamContext = createContext<TeamMember[]>([]);

export function TeamProvider({ team, children }: { team: TeamMember[]; children: React.ReactNode }) {
  return <TeamContext.Provider value={team}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  return useContext(TeamContext);
}
