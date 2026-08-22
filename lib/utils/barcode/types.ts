// lib/utils/barcode/types.ts

export interface ScanResult {
  text: string;
  format?: string;
  rawBytes?: Uint8Array;
}

export interface ScannerOptions {
  /** Preferred camera facing mode ("environment" for rear, "user" for front). Defaults to "environment" */
  preferredFacingMode?: "environment" | "user";
  /** Specific video input device ID if user selects one */
  deviceId?: string;
  /** Duplicate scan debounce delay in milliseconds. Defaults to 1500ms */
  debounceMs?: number;
  /** Scan delay between decode attempts in milliseconds. Defaults to 300ms */
  timeBetweenScansMs?: number;
  /** Callback fired on successful scan */
  onScan: (result: ScanResult) => void;
  /** Callback fired on scanner error */
  onError?: (error: Error | string) => void;
  /** Callback fired when camera stream starts playing */
  onReady?: () => void;
}

export interface CameraCapabilities {
  hasTorch: boolean;
  isTorchOn: boolean;
  hasZoom: boolean;
  minZoom?: number;
  maxZoom?: number;
  currentZoom?: number;
  availableCameras: MediaDeviceInfo[];
  activeDeviceId?: string;
}

export type ScannerStatus = "idle" | "starting" | "scanning" | "stopped" | "error";
