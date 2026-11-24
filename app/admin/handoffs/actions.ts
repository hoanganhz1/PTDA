"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { logError, logEvent } from "@/lib/log";

const ALLOWED_STATUS = new Set(["new", "contacted", "done"]);

export async function updateHandoffStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!id || !ALLOWED_STATUS.has(status)) {
    return;
  }

  try {
    getDb().prepare("UPDATE handoff_requests SET status = ? WHERE id = ?").run(status, id);
    logEvent("handoff_status_updated", { status });
  } catch (error) {
    logError("handoff_status_failed", error);
  }

  revalidatePath("/admin/handoffs");
}
