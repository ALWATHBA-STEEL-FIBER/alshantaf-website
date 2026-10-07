import { notFound } from "next/navigation";

/** Internal rewrite target — always 404s so /admin looks nonexistent to scanners. */
export default function AdminPanelNotFound() {
  notFound();
}
