"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ZxingBarcodeScanner } from "@/lib/utils/barcode";
import { Modal, Button, Alert } from "@/components/ui";
import { Camera, Loader2, Barcode as BarcodeIcon, Flashlight } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

interface PharmacyScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanResult: (searchQuery: string) => void;
}

export function PharmacyScannerModal({
  open,
  onClose,
  onScanResult,
}: PharmacyScannerModalProps) {
  const [scannerStarting, setScannerStarting] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const scannerRef = useRef<ZxingBarcodeScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current = null;
    }
    setHasTorch(false);
    setIsTorchOn(false);
  }, []);

  const closeScanner = useCallback(() => {
    stopScanner();
    setScannerError("");
    setCameraPermissionDenied(false);
    setCheckingBarcode(false);
    onClose();
  }, [onClose, stopScanner]);

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      if (checkingBarcode) return;
      stopScanner();

      const rawCode = decodedText.trim();
      const { parseBarcodeData } = await import("@/lib/utils/barcode-parser");
      const parsed = parseBarcodeData(rawCode);
      const code = parsed.barcode || rawCode;

      setCheckingBarcode(true);
      setScannerError("");

      try {
        const res = await axios.get("/api/pharmacy/barcode", {
          params: { barcode: code },
        });
        const result = res.data?.data;
        if (result?.status === "found" && result.medicine) {
          const m = result.medicine;
          onScanResult(m.name);
          toast.success(`Found medicine: ${m.name}`);
        } else {
          onScanResult(parsed.name || code);
          toast.info(`Scanned Code: ${code}`);
        }
        closeScanner();
      } catch {
        onScanResult(parsed.name || code);
        toast.info(`Scanned Code: ${code}`);
        closeScanner();
      } finally {
        setCheckingBarcode(false);
      }
    },
    [checkingBarcode, closeScanner, onScanResult, stopScanner]
  );

  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }

    let isMounted = true;
    const scanner = new ZxingBarcodeScanner();
    scannerRef.current = scanner;
    setScannerStarting(true);
    setScannerError("");
    setCameraPermissionDenied(false);

    const timer = setTimeout(async () => {
      if (!isMounted || !videoRef.current) return;
      try {
        await scanner.start(videoRef.current, {
          preferredFacingMode: "environment",
          onScan: (result) => {
            if (isMounted) handleScanSuccess(result.text);
          },
          onError: (err) => {
            if (!isMounted) return;
            const errStr = String(err);
            if (/permission|notallowed/i.test(errStr)) {
              setCameraPermissionDenied(true);
            } else {
              setScannerError("Unable to access camera. Please check camera permissions.");
            }
          },
          onReady: () => {
            if (!isMounted) return;
            setScannerStarting(false);
            const caps = scanner.getCapabilities();
            setHasTorch(caps.hasTorch);
          },
        });
      } catch (err: unknown) {
        if (!isMounted) return;
        const errStr = String(err);
        setScannerStarting(false);
        if (/permission|notallowed/i.test(errStr)) {
          setCameraPermissionDenied(true);
        } else {
          setScannerError("Failed to start camera. Please verify device camera is available.");
        }
      }
    }, 80);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      scanner.stop();
    };
  }, [open, handleScanSuccess, stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleToggleTorch = async () => {
    if (scannerRef.current) {
      const nextState = await scannerRef.current.toggleTorch();
      setIsTorchOn(nextState);
    }
  };

  return (
    <Modal open={open} onClose={closeScanner} title="Scan Medicine Barcode" size="md">
      <div className="space-y-3">
        {cameraPermissionDenied ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 bg-red-50 rounded-lg border border-red-200">
            <Camera className="w-10 h-10 text-red-300 mb-3" />
            <p className="text-xs font-semibold text-red-700 mb-1">Camera Access Required</p>
            <p className="text-xs text-red-500 text-center mb-4 max-w-xs">
              Please allow camera access in your browser settings to scan barcodes.
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={closeScanner}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            {scannerError && <Alert type="error">{scannerError}</Alert>}

            <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-gray-900">
              <div className="relative w-full h-[260px] flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {/* Visual alignment reticle */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-36 border-2 border-teal-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] relative">
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-teal-400/60 shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                  </div>
                </div>
              </div>

              {hasTorch && (
                <div className="absolute top-2 right-2 z-10">
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className={`p-2 rounded-full text-xs font-medium cursor-pointer shadow transition-colors ${
                      isTorchOn ? "bg-amber-400 text-gray-900" : "bg-black/60 text-white hover:bg-black/80"
                    }`}
                    title="Toggle Flashlight"
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {(scannerStarting || checkingBarcode) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
                  <div className="flex items-center gap-2 text-gray-600 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {checkingBarcode ? "Looking up medicine..." : "Starting camera..."}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
              <BarcodeIcon className="w-3.5 h-3.5" />
              Align the barcode within the frame. It will scan automatically.
            </p>

            <div className="flex justify-end pt-2 border-t border-gray-300">
              <Button type="button" variant="secondary" onClick={closeScanner}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
