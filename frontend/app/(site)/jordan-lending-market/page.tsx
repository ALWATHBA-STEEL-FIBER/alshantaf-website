import { redirect } from "next/navigation";

/** Legacy lending-market URL → land & parcels market. */
export default function LegacyLendingMarketRedirect() {
  redirect("/jordan-land-market");
}
