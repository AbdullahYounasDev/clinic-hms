// components/pharmacy/MedicineCreateModal.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { ZxingBarcodeScanner } from "@/lib/utils/barcode";
import {
    Modal,
    FormField,
    Input,
    Select,
    Alert,
    Button,
} from "@/components/ui";
import { createMedicineSchema, CreateMedicineInput } from "@/lib/validations";
import { ScanLine, PenLine, Loader2, Camera, Flashlight } from "lucide-react";
import { toast } from "sonner";

interface MedicineCreateModalProps {
    open: boolean;
    onClose: () => void;
}

type TabKey = "manual" | "scan";

export function MedicineCreateModal({ open, onClose }: MedicineCreateModalProps) {
    const qc = useQueryClient();
    const [createError, setCreateError] = useState("");
    const [activeTab, setActiveTab] = useState<TabKey>("manual");

    // --- Scanner state ---
    const scannerRef = useRef<ZxingBarcodeScanner | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [scannerStarting, setScannerStarting] = useState(false);
    const [scannerError, setScannerError] = useState("");
    const [checkingBarcode, setCheckingBarcode] = useState(false);
    const [existingMedicine, setExistingMedicine] = useState<{ _id: string; name: string; genericName: string; currentStock: number } | null>(null);
    const [scannedBarcode, setScannedBarcode] = useState("");
    const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [isTorchOn, setIsTorchOn] = useState(false);

    const { data: suppliersData } = useQuery({
        queryKey: ["suppliers-active"],
        queryFn: () => axios.get("/api/supplier", { params: { limit: 200, isActive: "true" } }).then(r => r.data),
        enabled: open,
    });

    const suppliers = suppliersData?.data || [];

    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CreateMedicineInput>({
        resolver: zodResolver(createMedicineSchema),
    });

    const createMutation = useMutation({
        mutationFn: (d: CreateMedicineInput) => axios.post("/api/pharmacy", d),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["medicines"] });
            handleClose();
            toast.success("Medicine created successfully!");
        },
        onError: (e: unknown) => {
            setCreateError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create medicine");
            toast.error("Failed to create medicine.");
        },
    });

    // --- Stop camera safely ---
    const stopScanner = useCallback(() => {
        if (scannerRef.current) {
            scannerRef.current.stop();
            scannerRef.current = null;
        }
        setHasTorch(false);
        setIsTorchOn(false);
    }, []);

    // --- Handle a successful decode ---
    const handleScanSuccess = useCallback(async (decodedText: string) => {
        if (checkingBarcode) return;
        stopScanner();

        const rawCode = decodedText.trim();
        const { parseBarcodeData } = await import("@/lib/utils/barcode-parser");
        const parsed = parseBarcodeData(rawCode);
        const lookupBarcode = parsed.barcode || rawCode;

        setScannedBarcode(lookupBarcode);
        setCheckingBarcode(true);
        setScannerError("");
        setExistingMedicine(null);

        try {
            const res = await axios.get("/api/pharmacy/barcode", { params: { barcode: lookupBarcode } });
            const result = res.data?.data;

            if (result?.status === "found" && result.medicine) {
                setExistingMedicine(result.medicine);
            } else {
                reset();
                setValue("barcode", lookupBarcode);
                if (parsed.name) setValue("name", parsed.name);
                if (parsed.genericName) setValue("genericName", parsed.genericName);
                if (parsed.category) setValue("category", parsed.category);
                if (parsed.batchNumber) setValue("batchNumber", parsed.batchNumber);
                if (parsed.expiryDate) setValue("expiryDate", parsed.expiryDate);
                if (parsed.unitCost !== undefined) setValue("unitCost", parsed.unitCost);
                if (parsed.sellingPrice !== undefined) setValue("sellingPrice", parsed.sellingPrice);
                if (parsed.unit) setValue("unit", parsed.unit);
                if (parsed.manufacturer) setValue("manufacturer", parsed.manufacturer);
                if (parsed.storageCondition) setValue("storageCondition", parsed.storageCondition);
                if (parsed.storageLocation) setValue("storageLocation", parsed.storageLocation);

                setExistingMedicine(null);
                setActiveTab("manual");
                toast.success("Barcode / QR code parsed! Please verify details.");
            }
        } catch {
            toast.error("Could not verify barcode. Please try again or enter manually.");
        } finally {
            setCheckingBarcode(false);
        }
    }, [checkingBarcode, reset, setValue, stopScanner]);

    // --- Start camera when scan tab is active and modal is open ---
    useEffect(() => {
        if (!open || activeTab !== "scan") {
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
    }, [open, activeTab, handleScanSuccess, stopScanner]);

    // --- Cleanup on unmount ---
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

    const handleClose = () => {
        stopScanner();
        onClose();
        reset();
        setCreateError("");
        setScannerError("");
        setExistingMedicine(null);
        setScannedBarcode("");
        setActiveTab("manual");
        setCameraPermissionDenied(false);
    };

    const handleScanAgain = () => {
        setExistingMedicine(null);
        setScannedBarcode("");
        setCameraPermissionDenied(false);
        setScannerError("");
        setActiveTab("scan");
    };

    return (
        <Modal open={open} onClose={handleClose} title="Add Medicine" size="lg">
            {/* Tab switcher */}
            <div className="flex gap-2 border-b border-gray-200 mb-4">
                <button
                    type="button"
                    onClick={() => setActiveTab("manual")}
                    className={`cursor-pointer flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2
                        ${activeTab === "manual"
                            ? "border-teal-600 text-teal-700"
                            : "border-transparent text-gray-500"
                        }`}
                >
                    <PenLine className="w-4 h-4" />
                    Manual Entry
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("scan")}
                    className={`cursor-pointer flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2
                        ${activeTab === "scan"
                            ? "border-teal-600 text-teal-700"
                            : "border-transparent text-gray-500"
                        }`}
                >
                    <ScanLine className="w-4 h-4" />
                    Scan Barcode
                </button>
            </div>

            {createError && <Alert type="error">{createError}</Alert>}

            {/* --- SCAN TAB --- */}
            {activeTab === "scan" && (
                <div className="space-y-3">
                    {existingMedicine ? (
                        <Alert type="warning">
                            <div className="space-y-2">
                                <p className="text-xs">
                                    A medicine with this barcode already exists:{" "}
                                    <strong>{existingMedicine.name}</strong> ({existingMedicine.genericName}) — current stock:{" "}
                                    {existingMedicine.currentStock}.
                                </p>
                                <div className="flex gap-2">
                                    <Button type="button" size="sm" variant="secondary" onClick={handleScanAgain}>
                                        Scan Again
                                    </Button>
                                    <Button type="button" size="sm" variant="secondary" onClick={handleClose}>
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </Alert>
                    ) : cameraPermissionDenied ? (
                        <div className="flex flex-col items-center justify-center py-8 px-4 bg-red-50 rounded-lg border border-red-200">
                            <Camera className="w-10 h-10 text-red-300 mb-3" />
                            <p className="text-xs font-semibold text-red-700 mb-1">Camera Access Required</p>
                            <p className="text-xs text-red-500 text-center mb-4 max-w-xs">
                                Please allow camera access in your browser settings to scan barcodes, or use manual entry instead.
                            </p>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setActiveTab("manual")}>
                                <PenLine className="w-3.5 h-3.5" /> Manual Entry
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
                                    {/* Overlay reticle for barcode alignment */}
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
                                            {checkingBarcode ? "Checking barcode..." : "Starting camera..."}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-gray-400 text-center">
                                Align the barcode within the frame. It will scan automatically.
                            </p>
                        </>
                    )}
                </div>
            )}

            {/* --- MANUAL TAB --- */}
            {activeTab === "manual" && (
                <form
                    onSubmit={handleSubmit(d => createMutation.mutate(d))}
                    className="space-y-4 mt-2"
                >
                    {scannedBarcode && (
                        <FormField label="Barcode">
                            <Input value={scannedBarcode} disabled readOnly />
                            <input type="hidden" {...register("barcode")} value={scannedBarcode} />
                        </FormField>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Brand Name" required error={errors.name?.message}>
                            <Input {...register("name")} error={!!errors.name} />
                        </FormField>
                        <FormField label="Generic Name" required error={errors.genericName?.message}>
                            <Input {...register("genericName")} error={!!errors.genericName} />
                        </FormField>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField label="Category" required error={errors.category?.message}>
                            <Select {...register("category")} error={!!errors.category}>
                                <option value="">Select</option>
                                {["Antibiotic", "Analgesic", "Antihypertensive", "Antidiabetic", "Antacid", "Vitamin", "Steroid", "Antihistamine", "Other"].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </Select>
                        </FormField>
                        <FormField label="Unit" required error={errors.unit?.message}>
                            <Select {...register("unit")} error={!!errors.unit}>
                                <option value="">Select</option>
                                {["tablet", "capsule", "ml", "mg", "syrup", "injection", "cream", "drops", "inhaler", "sachet"].map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </Select>
                        </FormField>
                        <FormField label="Manufacturer">
                            <Input {...register("manufacturer")} />
                        </FormField>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField label="Current Stock" required error={errors.currentStock?.message}>
                            <Input type="number" {...register("currentStock", { valueAsNumber: true })} error={!!errors.currentStock} />
                        </FormField>
                        <FormField label="Min Stock Level" required error={errors.minStockLevel?.message}>
                            <Input type="number" {...register("minStockLevel", { valueAsNumber: true })} error={!!errors.minStockLevel} />
                        </FormField>
                        <FormField label="Expiry Date">
                            <Input type="date" {...register("expiryDate")} />
                        </FormField>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Storage Condition">
                            <Select {...register("storageCondition")}>
                                <option value="">Select</option>
                                {["Room Temperature", "Refrigerated (2-8°C)", "Cool & Dry Place", "Freezer", "Protect from Light", "Other"].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </Select>
                        </FormField>
                        <FormField label="Storage Location">
                            <Input {...register("storageLocation")} placeholder="e.g., Shelf A-1, Cold Storage 2" />
                        </FormField>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Unit Cost (PKR)" required error={errors.unitCost?.message}>
                            <Input type="number" {...register("unitCost", { valueAsNumber: true })} error={!!errors.unitCost} />
                        </FormField>
                        <FormField label="Selling Price (PKR)" required error={errors.sellingPrice?.message}>
                            <Input type="number" {...register("sellingPrice", { valueAsNumber: true })} error={!!errors.sellingPrice} />
                        </FormField>
                    </div>

                    <FormField label="Supplier">
                        <Select {...register("supplier")}>
                            <option value="">Select supplier (optional)</option>
                            {suppliers.map((s: { _id: string; name: string; type: string }) => (
                                <option key={s._id} value={s._id}>
                                    {s.name} ({s.type})
                                </option>
                            ))}
                        </Select>
                    </FormField>

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
                        <Button type="button" variant="secondary" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={createMutation.isPending}>
                            Add Medicine
                        </Button>
                    </div>
                </form>
            )}
        </Modal>
    );
}