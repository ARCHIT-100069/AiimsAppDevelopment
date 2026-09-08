"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PatientResponse } from "@aiims/api-contracts";
import { Badge, Button, Card, EmptyState, IDCard, IconScan, TextInput } from "@aiims/ui-web";

/* The browser-native barcode reader (Chromium). Feature-detected — no
 * polyfill, no external decoding library. Minimal shape typed locally since
 * lib.dom doesn't yet ship it. */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

const genderLabel: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  unknown: "Unknown",
};

function ageFromBirthDate(birthDate: string): number | null {
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const notYetBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (notYetBirthday) age -= 1;
  return age;
}

type LookupStatus = "idle" | "searching" | "found" | "notfound" | "error";

export function ScanApp() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [scannerValue, setScannerValue] = useState("");
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [matched, setMatched] = useState<PatientResponse | null>(null);
  const [source, setSource] = useState<"scanner" | "camera" | "simulate" | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // Starts false to match the server-rendered markup, then flips after mount —
  // `window` isn't available during SSR, so checking it during render would
  // make the client's first paint disagree with the server's HTML.
  const [cameraSupported, setCameraSupported] = useState(false);

  const [samples, setSamples] = useState<PatientResponse[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);

  useEffect(() => {
    setCameraSupported("BarcodeDetector" in window);
    inputRef.current?.focus();
    (async () => {
      try {
        const res = await fetch("/api/bff/patients?limit=6");
        const body = (await res.json().catch(() => ({ data: [] }))) as {
          data?: PatientResponse[];
        };
        setSamples(body.data ?? []);
      } finally {
        setSamplesLoading(false);
      }
    })();
    return () => stopCamera();
  }, []);

  async function lookup(mrn: string, via: "scanner" | "camera" | "simulate") {
    const value = mrn.trim();
    if (!value) return;
    stopCamera();
    setSource(via);
    setStatus("searching");
    setMatched(null);
    try {
      const res = await fetch(`/api/bff/patients?mrn=${encodeURIComponent(value)}&limit=1`);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const body = (await res.json()) as { data?: PatientResponse[] };
      const found = body.data?.[0];
      if (found) {
        setMatched(found);
        setStatus("found");
      } else {
        setStatus("notfound");
      }
    } catch {
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setMatched(null);
    setSource(null);
    setScannerValue("");
    inputRef.current?.focus();
  }

  function onScannerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Hardware barcode scanners behave as keyboards: they type the payload
    // character-by-character then send Enter, exactly like a person typing
    // fast and pressing Enter — nothing scanner-specific to wire up.
    if (e.key === "Enter") {
      e.preventDefault();
      void lookup(scannerValue, "scanner");
    }
  }

  function stopCamera() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  async function startCamera() {
    setCameraError(null);
    if (!window.BarcodeDetector) {
      setCameraError("This browser doesn't support live barcode scanning.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);

      const detector = new window.BarcodeDetector({
        formats: ["code_128", "code_39", "ean_13", "qr_code"],
      });
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            void lookup(codes[0].rawValue, "camera");
            return;
          }
        } catch {
          // transient decode failure on a mid-motion frame — keep polling
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError("Camera access was denied or no camera is available on this device.");
    }
  }

  const sourceLabel = { scanner: "scanner input", camera: "camera", simulate: "simulated scan" };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
          <IconScan width={22} height={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Scan patient ID</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Identify a patient from their hospital-issued MRN barcode, then confirm identity before
            opening the chart. Nothing opens automatically from a scan.
          </p>
        </div>
      </div>

      {status === "found" && matched ? (
        <Card className="p-6">
          <p className="mb-4 text-sm font-medium text-slate-700">
            Matched from {source ? sourceLabel[source] : "scan"} — verify this is the right patient
            before continuing.
          </p>
          <IDCard
            kind="patient"
            name={`${matched.nameGiven} ${matched.nameFamily}`}
            idLabel="MRN"
            idValue={matched.mrn}
            subtitle={`${genderLabel[matched.gender] ?? matched.gender} · ${
              ageFromBirthDate(matched.birthDate) ?? "—"
            } yrs`}
            meta={[{ label: "Date of birth", value: matched.birthDate }]}
          />
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => router.push(`/patients/${matched.id}`)}>
              Confirm &amp; open chart
            </Button>
            <Button variant="secondary" className="flex-1" onClick={reset}>
              Not this patient — scan again
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Scanner input</h2>
              <Badge tone="teal">Hardware-ready</Badge>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              Click the field, then scan with a USB or Bluetooth barcode scanner — it types the MRN
              and presses Enter automatically. You can also type an MRN by hand.
            </p>
            <TextInput
              ref={inputRef}
              value={scannerValue}
              onChange={(e) => setScannerValue(e.target.value)}
              onKeyDown={onScannerKeyDown}
              placeholder="Scan or type an MRN, then press Enter"
              autoFocus
              className="font-mono"
            />
            {status === "searching" && source !== "camera" ? (
              <p className="mt-2 text-sm text-slate-500">Looking up…</p>
            ) : null}
            {status === "notfound" ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                No patient found for that ID. Check the MRN and try again.
              </p>
            ) : null}
            {status === "error" ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                Couldn't reach the patient directory. Try again in a moment.
              </p>
            ) : null}
          </Card>

          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Camera scan</h2>
              {cameraSupported ? (
                <Badge tone="teal">Live</Badge>
              ) : (
                <Badge tone="slate">Unsupported</Badge>
              )}
            </div>
            {!cameraSupported ? (
              <p className="text-sm text-slate-500">
                This browser doesn't support live barcode scanning (the BarcodeDetector API isn't
                available). Use the scanner input above, or a Chromium-based browser for camera
                scanning.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-500">
                  Use the device camera to read the barcode straight off a printed patient card.
                </p>
                {cameraActive ? (
                  <div className="relative overflow-hidden rounded-lg bg-slate-900">
                    <video ref={videoRef} muted playsInline className="w-full" />
                    <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-teal-400/70" />
                  </div>
                ) : null}
                <div className="mt-3 flex gap-2">
                  {!cameraActive ? (
                    <Button variant="secondary" onClick={() => void startCamera()}>
                      Start camera scan
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={stopCamera}>
                      Stop camera
                    </Button>
                  )}
                </div>
                {cameraError ? (
                  <p className="mt-2 text-sm text-red-600" role="alert">
                    {cameraError}
                  </p>
                ) : null}
              </>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Simulate a scan</h2>
              <Badge tone="amber">Demo aid</Badge>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              No physical scanner or camera handy? Pick an existing patient below to simulate what
              scanning their card would produce — it runs the exact same lookup, it's just a
              shortcut to demo the flow.
            </p>
            {samplesLoading ? (
              <p className="text-sm text-slate-400">Loading sample patients…</p>
            ) : samples.length === 0 ? (
              <EmptyState>No patients registered yet to simulate against.</EmptyState>
            ) : (
              <div className="flex flex-wrap gap-2">
                {samples.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void lookup(p.mrn, "simulate")}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-teal-300 hover:bg-teal-50"
                  >
                    <span className="block font-medium text-slate-800">
                      {p.nameGiven} {p.nameFamily}
                    </span>
                    <span className="block font-mono text-xs text-slate-400">{p.mrn}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
