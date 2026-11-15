import { createContext } from "react";

/** Connects the isolated mobile presentation to AppShell's existing drawer. */
export const LeaderMobileMenuContext = createContext<
  ((trigger: HTMLButtonElement | null) => void) | null
>(null);
export const LEADER_MOBILE_QUERY = "(max-width: 767px)";
