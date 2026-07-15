import { NextRequest, NextResponse } from "next/server";
import { deleteEntrant } from "@/lib/db";

// Permanently removes one entrant. The database's ON DELETE CASCADE on the
// edges table removes any edges referencing this id automatically. The
// frontend gates this behind its own confirm step - this route trusts
// whatever id it's given, since the confirmation already happened in the UI.
export async function POST(request: NextRequest) {
  const { id } = (await request.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "An entrant id is required." }, { status: 400 });
  }

  const deleted = await deleteEntrant(id);
  if (!deleted) {
    return NextResponse.json({ error: "Entrant not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
