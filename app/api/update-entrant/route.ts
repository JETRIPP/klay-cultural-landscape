import { NextRequest, NextResponse } from "next/server";
import { updateEntrantCategory } from "@/lib/db";

// Currently only re-categorizes an existing entrant - a research pass or a
// manual edit can put someone in the wrong bucket, and this is the fix
// without deleting and re-adding them (which would also lose their edges).
export async function POST(request: NextRequest) {
  const { id, category } = (await request.json()) as { id?: string; category?: string };
  if (!id || !category || !category.trim()) {
    return NextResponse.json({ error: "An entrant id and non-empty category are required." }, { status: 400 });
  }

  const node = await updateEntrantCategory(id, category.trim());
  if (!node) {
    return NextResponse.json({ error: "Entrant not found." }, { status: 404 });
  }

  return NextResponse.json({ node });
}
