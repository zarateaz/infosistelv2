import { getDashboardLiveSnapshot } from "@/lib/dashboardLive";
import { InteractiveDashboard } from "./InteractiveDashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const initialData = await getDashboardLiveSnapshot();
  return <InteractiveDashboard initialData={initialData} />;
}
