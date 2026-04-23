"use client";

import { useRef, useState, useCallback, useTransition, useActionState, useEffect } from "react";
import { Camera, CameraOff, RefreshCw, CheckCircle, MapPin, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { selfCheckIn, getAttendanceUploadSignature } from "@/app/actions/attendance";
import type { AttendanceActionResult } from "@/app/actions/attendance";

interface Site {
  id: string;
  name: string;
}

interface ExistingAttendance {
  status: string;
  method: string;
  photoUrl: string | null;
  createdAt: Date;
}

interface CheckInClientProps {
  assignedSites: Site[];
  existing: ExistingAttendance | null;
}

type GeoState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "granted"; lat: number; lng: number; accuracy: number }
  | { status: "denied" };

export function CheckInClient({ assignedSites, existing }: CheckInClientProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const [selectedSiteId, setSelectedSiteId] = useState(
    assignedSites.length === 1 ? assignedSites[0].id : ""
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, formAction] = useActionState<AttendanceActionResult | null, FormData>(
    selfCheckIn,
    null
  );

  // redirect on success
  useEffect(() => {
    if (state?.success) {
      toast.success("Attendance marked! Have a great day.");
      window.location.href = "/attendance";
    }
  }, [state]);

  // Start camera
  const startCamera = useCallback(async () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch {
      toast.error("Camera access denied. Use the fallback below.");
    }
  }, [facingMode, stream]);

  // Stop camera when component unmounts
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  // Attach stream to video element when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const flipCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  // Flip → restart camera
  useEffect(() => {
    if (stream) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Capture frame from video
  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const MAX_WIDTH = 1280;
    const ratio = Math.min(1, MAX_WIDTH / video.videoWidth);
    canvas.width = video.videoWidth * ratio;
    canvas.height = video.videoHeight * ratio;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCapturedDataUrl(canvas.toDataURL("image/jpeg", 0.7));
        // Stop stream after capture
        stream?.getTracks().forEach((t) => t.stop());
        setStream(null);
        // Request geo silently
        requestGeo();
      },
      "image/jpeg",
      0.7
    );
  }, [stream]);

  // Fallback: file input capture
  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = canvasRef.current!;
      const MAX_WIDTH = 1280;
      const ratio = Math.min(1, MAX_WIDTH / img.width);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          setCapturedBlob(blob);
          setCapturedDataUrl(canvas.toDataURL("image/jpeg", 0.7));
          URL.revokeObjectURL(url);
          requestGeo();
        },
        "image/jpeg",
        0.7
      );
    };
    img.src = url;
  };

  const requestGeo = () => {
    setGeo({ status: "requesting" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          status: "granted",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        setGeo({ status: "denied" });
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const retake = () => {
    setCapturedBlob(null);
    setCapturedDataUrl(null);
    setGeo({ status: "idle" });
    startCamera();
  };

  // Upload to Cloudinary then submit form
  const handleSubmit = async () => {
    if (!capturedBlob) return;
    setIsUploading(true);

    try {
      const sig = await getAttendanceUploadSignature();
      const fd = new FormData();
      fd.append("file", capturedBlob, "selfie.jpg");
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);
      if (sig.uploadPreset) {
        fd.append("upload_preset", sig.uploadPreset);
      }

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: "POST", body: fd }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.error?.message ?? "Upload failed");

      const actionFd = new FormData();
      actionFd.append("photoUrl", data.secure_url);
      actionFd.append("photoPublicId", data.public_id);
      if (geo.status === "granted") {
        actionFd.append("latitude", String(geo.lat));
        actionFd.append("longitude", String(geo.lng));
        actionFd.append("locationAccuracy", String(geo.accuracy));
      }
      if (selectedSiteId) actionFd.append("siteId", selectedSiteId);

      startTransition(() => formAction(actionFd));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Already checked in ──────────────────────────────────────────────────
  if (existing) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle className="h-16 w-16 text-green-500" />
        <div>
          <p className="text-lg font-semibold">Already checked in today</p>
          <p className="text-sm text-muted-foreground capitalize">
            Status: {existing.status.replace("_", " ").toLowerCase()} ·{" "}
            {existing.method.toLowerCase()}
          </p>
        </div>
        {existing.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={existing.photoUrl}
            alt="Your selfie"
            className="w-40 h-40 object-cover rounded-full border-4 border-green-200"
          />
        )}
      </div>
    );
  }

  // ─── Photo captured — confirm screen ────────────────────────────────────
  if (capturedDataUrl) {
    return (
      <div className="flex flex-col gap-4">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capturedDataUrl}
            alt="Captured selfie"
            className="w-full max-w-sm mx-auto rounded-xl border object-cover"
          />
        </div>

        {/* Geo status */}
        <div className="flex items-center gap-2 text-sm">
          {geo.status === "requesting" && (
            <><MapPin className="h-4 w-4 animate-pulse text-blue-500" /> Getting location…</>
          )}
          {geo.status === "granted" && (
            <><MapPin className="h-4 w-4 text-green-500" /> Location captured (±{Math.round((geo as { status: "granted"; lat: number; lng: number; accuracy: number }).accuracy)}m)</>
          )}
          {geo.status === "denied" && (
            <><AlertCircle className="h-4 w-4 text-yellow-500" /> No location (will mark without it)</>
          )}
        </div>

        {/* Site picker */}
        {assignedSites.length > 1 && (
          <div>
            <label className="text-sm font-medium">Site (optional)</label>
            <select
              className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
            >
              <option value="">No site selected</option>
              {assignedSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Error */}
        {state && !state.success && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={retake}>
            Retake
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={isUploading || isPending || geo.status === "requesting"}
          >
            {isUploading || isPending ? "Submitting…" : "Confirm Check In"}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Camera screen ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <CardContent className="p-0 relative bg-black aspect-[4/3]">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white/60">
              <CameraOff className="h-12 w-12" />
            </div>
          )}
          {stream && (
            <button
              onClick={flipCamera}
              className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-2"
              title="Flip camera"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </CardContent>
      </Card>

      {/* Hidden canvas for compression */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-3">
        {!stream ? (
          <Button className="flex-1" onClick={startCamera}>
            <Camera className="mr-2 h-4 w-4" /> Open Camera
          </Button>
        ) : (
          <Button className="flex-1 h-14 text-base" onClick={capture}>
            Take Selfie
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        No camera access?{" "}
        <label className="underline cursor-pointer">
          Upload a photo
          <input
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            onChange={handleFileCapture}
          />
        </label>
      </p>
    </div>
  );
}
