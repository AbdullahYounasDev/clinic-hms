"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Modal, Button, Alert } from "@/components/ui";
import { Camera, Loader2, Barcode as BarcodeIcon } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

interface PharmacyScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanResult: (searchQuery: string) => void;
}

const SCANNER_ELEMENT_ID = "pharmacy-client-barcode-scanner";

export function PharmacyScannerModal({
  open,
  onClose,
  onScanResult,
}: PharmacyScannerModalProps) {
  const [scannerStarting, setScannerStarting] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const forceStopMediaTracks = () => {
    try {
      const el = document.getElementById(SCANNER_ELEMENT_ID);
      if (el) {
        const videos = el.getElementsByTagName("video");
        for (let i = 0; i < videos.length; i++) {
          const stream = videos[i].srcObject as MediaStream | null;
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const stopScanner = useCallback(async () => {
    forceStopMediaTracks();
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    forceStopMediaTracks();
  }, []);

  const closeScanner = useCallback(async () => {
    await stopScanner();
    setScannerError("");
    setCameraPermissionDenied(false);
    setCheckingBarcode(false);
    onClose();
  }, [onClose, stopScanner]);

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      if (checkingBarcode) return;
      await stopScanner();

      const code = decodedText.trim();
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
          onScanResult(code);
          toast.info(`Scanned Code: ${code}`);
        }
        await closeScanner();
      } catch {
        onScanResult(code);
        toast.info(`Scanned Code: ${code}`);
        await closeScanner();
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

    const timer = setTimeout(() => {
      const el = document.getElementById(SCANNER_ELEMENT_ID);
      if (!el) {
        setCameraPermissionDenied(true);
        setScannerError("Scanner element not found. Please try again.");
        return;
      }

      setScannerError("");
      setCameraPermissionDenied(false);
      setScannerStarting(true);

      const instance = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = instance;

      instance
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => handleScanSuccess(decodedText),
          () => {
            /* ignore per-frame miss */
          }
        )
        .then(() => {
          setScannerStarting(false);
        })
        .catch(() => {
          setScannerStarting(false);
          setCameraPermissionDenied(true);
        });
    }, 100);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [open, handleScanSuccess, stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

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

            <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-gray-50">
              <div id={SCANNER_ELEMENT_ID} className="w-full min-h-[260px]" />

              {(scannerStarting || checkingBarcode) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
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

            <style jsx global>{`
              #${SCANNER_ELEMENT_ID} > div:first-child > div {
                border: 3px solid #0d9488 !important;
                border-radius: 8px !important;
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
              }
            `}</style>

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
