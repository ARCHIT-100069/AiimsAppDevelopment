"use client";

import { useEffect, useState } from "react";
import type { FacilityResponse, QueueEntry } from "@aiims/api-contracts";
import { Badge, Button, Card, Field, Select } from "@aiims/ui-web";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** The OPD "now serving" board — reception/doctor view (D-4.3). */
export function QueueBoard({ facilities, date }: { facilities: FacilityResponse[]; date: string }) {
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(id: string) {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/bff/opd-queue?facilityId=${id}&date=${date}`);
    const body = res.ok ? await res.json() : { entries: [] };
    setEntries(body.entries ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load(facilityId);
  }, [facilityId]);

  return (
    <section aria-labelledby="queue-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="queue-heading" className="text-2xl font-bold text-slate-900">
            OPD queue
          </h1>
          <p className="mt-1 text-sm text-slate-500">{date} · live waiting list</p>
        </div>
        <div className="flex items-end gap-3">
          <Field label="Facility">
            <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" onClick={() => load(facilityId)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card className="mt-6 p-10 text-center text-sm text-slate-500">
          No one is waiting right now.
        </Card>
      ) : (
        <ol className="mt-6 space-y-3">
          {entries.map((e) => (
            <li key={e.appointmentId}>
              <Card className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-lg font-bold text-teal-700">
                  {e.queueToken}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {e.patientName ?? e.patientId.slice(0, 8)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {e.practitionerName ?? "—"} · arrived {timeOf(e.checkedInAt)}
                  </p>
                </div>
                <Badge tone={e.status === "in_progress" ? "green" : "sky"}>
                  {e.status === "in_progress" ? "In consult" : `Position ${e.position}`}
                </Badge>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
