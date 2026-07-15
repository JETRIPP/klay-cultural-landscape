import HomeClient from "@/components/HomeClient";
import { getGraphData } from "@/lib/db";

// Data lives in Postgres now and changes whenever a teammate adds/edits/
// deletes an entrant - never statically cache this page.
export const dynamic = "force-dynamic";

export default async function Page() {
  const { nodes, edges } = await getGraphData();
  return <HomeClient initialNodes={nodes} initialEdges={edges} />;
}
