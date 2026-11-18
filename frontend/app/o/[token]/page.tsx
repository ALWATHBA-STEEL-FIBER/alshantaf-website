import type { Metadata } from "next";
import { OrderPortal } from "@/components/OrderPortal";

export const metadata: Metadata = {
  title: "إيصال الطلب",
  robots: { index: false, follow: false },
};

export default async function PublicOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OrderPortal token={token} />;
}
