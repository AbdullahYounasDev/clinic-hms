// lib/utils/barcode/zxing-scanner.ts
"use client";

import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { ScannerOptions, ScanResult, CameraCapabilities, ScannerStatus } from "./types";

export * from "./types";

/**
 * Creates default ZXing decode hints supporting all standard pharmaceutical
 * and commercial 1D and 2D barcode formats (including GS1 DataMatrix).
 */
export function createDefaultHints(): Map<DecodeHintType, unknown> {
  const hints = new Map<DecodeHintType, unknown>();
  const formats: BarcodeFormat[] = [
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.CODE_128,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.ITF,
    BarcodeFormat.PDF_417,
    BarcodeFormat.AZTEC,
  ];

  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

/**
 * Centralized, reusable ZXing camera scanner class.
 * Handles camera lifecycle, multi-format decoding, device selection,
 * hardware torch/zoom controls, and debouncing.
 */
export class ZxingBarcodeScanner {
  private reader: BrowserMultiFormatReader;
  private controls: IScannerControls | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private mediaStream: MediaStream | null = null;
  private currentTrack: MediaStreamTrack | null = null;

  private status: ScannerStatus = "idle";
  private options: ScannerOptions | null = null;

  // Debouncing & duplicate prevention
  private lastScannedText: string = "";
  private lastScannedTimestamp: number = 0;

  // Camera capabilities
  private isTorchActive: boolean = false;
  private availableDevices: MediaDeviceInfo[] = [];
  private activeDeviceId: string | undefined = undefined;

  constructor() {
    const hints = createDefaultHints();
    this.reader = new BrowserMultiFormatReader(hints);
  }

  /**
   * Returns current status of the scanner
   */
  public getStatus(): ScannerStatus {
    return this.status;
  }

  /**
   * Enumerate available video cameras
   */
  public async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices.filter((d) => d.kind === "videoinput");
      return this.availableDevices;
    } catch {
      return [];
    }
  }

  /**
   * Get live capabilities of the current camera stream (torch, zoom, devices)
   */
  public getCapabilities(): CameraCapabilities {
    let hasTorch = false;
    let hasZoom = false;
    let minZoom: number | undefined;
    let maxZoom: number | undefined;
    let currentZoom: number | undefined;

    if (this.currentTrack && typeof this.currentTrack.getCapabilities === "function") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = this.currentTrack.getCapabilities() as any;
        hasTorch = Boolean(caps?.torch);
        if (caps?.zoom) {
          hasZoom = true;
          minZoom = caps.zoom.min;
          maxZoom = caps.zoom.max;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settings = this.currentTrack.getSettings() as any;
        currentZoom = settings?.zoom;
      } catch {
        // Capability query failed or not supported
      }
    }

    return {
      hasTorch,
      isTorchOn: this.isTorchActive,
      hasZoom,
      minZoom,
      maxZoom,
      currentZoom,
      availableCameras: this.availableDevices,
      activeDeviceId: this.activeDeviceId,
    };
  }

  /**
   * Start scanning on a given HTMLVideoElement
   */
  public async start(
    videoElement: HTMLVideoElement,
    options: ScannerOptions
  ): Promise<void> {
    if (typeof window === "undefined" || !videoElement) {
      return;
    }

    // If already running on this video element, stop it cleanly first
    this.stop();

    this.videoElement = videoElement;
    this.options = options;
    this.status = "starting";
    this.lastScannedText = "";
    this.lastScannedTimestamp = 0;
    this.isTorchActive = false;

    try {
      // 1. Refresh list of cameras
      await this.getAvailableCameras();

      // 2. Determine target camera device or constraints
      const preferredMode = options.preferredFacingMode || "environment";
      let chosenDeviceId = options.deviceId;

      if (!chosenDeviceId && this.availableDevices.length > 0) {
        // Try to locate a rear/environment camera by label if facingMode isn't mapped
        const rearCamera = this.availableDevices.find((d) =>
          /back|rear|environment|main/i.test(d.label)
        );
        if (preferredMode === "environment" && rearCamera) {
          chosenDeviceId = rearCamera.deviceId;
        } else {
          chosenDeviceId = this.availableDevices[0].deviceId;
        }
      }

      this.activeDeviceId = chosenDeviceId;

      // 3. Build constraints with high quality camera stream and resolution for 2D DataMatrix
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: chosenDeviceId
          ? {
              deviceId: { exact: chosenDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              facingMode: { ideal: preferredMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      };

      // 4. Decode from video constraints
      this.controls = await this.reader.decodeFromConstraints(
        constraints,
        videoElement,
        (result, error) => {
          if (result) {
            const rawText = result.getText();
            if (!rawText) return;

            const now = Date.now();
            const debounceMs = options.debounceMs ?? 1500;

            // Prevent rapid duplicate bursts of the exact same code
            if (
              rawText === this.lastScannedText &&
              now - this.lastScannedTimestamp < debounceMs
            ) {
              return;
            }

            this.lastScannedText = rawText;
            this.lastScannedTimestamp = now;

            const scanResult: ScanResult = {
              text: rawText.trim(),
              format: result.getBarcodeFormat()?.toString(),
              rawBytes: result.getRawBytes(),
            };

            options.onScan(scanResult);
          } else if (error) {
            // ZXing NotFoundException fires continuously on frames without barcodes; ignore it
            // Only report real fatal stream errors
            const isNotFound =
              error.name === "NotFoundException" ||
              error.message?.includes("No MultiFormat Readers were able to detect");
            if (!isNotFound && options.onError) {
              options.onError(error);
            }
          }
        }
      );

      // 5. Capture the active media stream and track for torch/zoom controls and cleanup
      const stream = videoElement.srcObject as MediaStream | null;
      if (stream) {
        this.mediaStream = stream;
        const tracks = stream.getVideoTracks();
        if (tracks.length > 0) {
          this.currentTrack = tracks[0];
        }
      }

      this.status = "scanning";
      if (options.onReady) {
        options.onReady();
      }
    } catch (err) {
      this.status = "error";
      this.stop();
      if (options.onError) {
        options.onError(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.error("Failed to start ZXing scanner:", err);
      }
      throw err;
    }
  }

  /**
   * Toggle hardware torch/flashlight if supported by current video track
   */
  public async toggleTorch(): Promise<boolean> {
    if (!this.currentTrack) return false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = this.currentTrack.getCapabilities() as any;
      if (!caps?.torch) return false;

      const nextState = !this.isTorchActive;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.currentTrack as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });

      this.isTorchActive = nextState;
      return this.isTorchActive;
    } catch {
      return false;
    }
  }

  /**
   * Set hardware zoom if supported by current video track
   */
  public async setZoom(zoomLevel: number): Promise<void> {
    if (!this.currentTrack) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = this.currentTrack.getCapabilities() as any;
      if (!caps?.zoom) return;

      const clampedZoom = Math.min(
        Math.max(zoomLevel, caps.zoom.min || 1),
        caps.zoom.max || 1
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.currentTrack as any).applyConstraints({
        advanced: [{ zoom: clampedZoom }],
      });
    } catch {
      // Zoom constraint failed or unsupported
    }
  }

  /**
   * Switch active camera to another video device ID
   */
  public async switchCamera(deviceId: string): Promise<void> {
    if (!this.videoElement || !this.options) return;
    const currentOptions = { ...this.options, deviceId };
    await this.start(this.videoElement, currentOptions);
  }

  /**
   * Stop scanning, release all video tracks, and shut down camera LED hardware
   */
  public stop(): void {
    // 1. Stop ZXing reader controls
    if (this.controls) {
      try {
        this.controls.stop();
      } catch {
        // ignore
      }
      this.controls = null;
    }

    // 2. Explicitly stop and release all MediaStream tracks
    if (this.currentTrack) {
      try {
        this.currentTrack.stop();
      } catch {
        // ignore
      }
      this.currentTrack = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }
      this.mediaStream = null;
    }

    // 3. Clear video element source
    if (this.videoElement) {
      try {
        const stream = this.videoElement.srcObject as MediaStream | null;
        if (stream) {
          stream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              // ignore
            }
          });
        }
        this.videoElement.srcObject = null;
      } catch {
        // ignore
      }
      this.videoElement = null;
    }

    this.isTorchActive = false;
    this.status = "stopped";
  }

  /**
   * Fully destroy scanner instance
   */
  public destroy(): void {
    this.stop();
    this.options = null;
  }
}
