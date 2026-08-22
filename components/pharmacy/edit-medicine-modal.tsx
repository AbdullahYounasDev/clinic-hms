// components/pharmacy/edit-medicine-modal.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { ZxingBarcodeScanner } from "@/lib/utils/barcode";
import { Modal, FormField, Input, Select, Button, Alert } from "@/components/ui";
import { updateMedicineSchema, UpdateMedicineInput } from "@/lib/validations";
import { Camera, Loader2, Barcode as BarcodeIcon, PenLine, Flashlight } from "lucide-react";
import { toast } from "sonner";

interface MedicineDetail {
    _id: string;
    name: string;
    genericName: string;
    category: string;
    manufacturer?: string;
    unit: string;
    currentStock: number;
    minStockLevel: number;
    unitCost: number;
    sellingPrice: number;
    batchNumber?: string;
    expiryDate?: string;
    supplier?: string | { _id: string; name: string };
    storageCondition?: string;
    storageLocation?: string;
    isActive: boolean;
    barcode?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    medicine: MedicineDetail;
    onUpdate: (data: UpdateMedicineInput) => void;
    isPending: boolean;
    error: string;
}

export function EditMedicineModal({ open, onClose, medicine, onUpdate, isPending, error }: Props) {
    const { data: suppliersData } = useQuery({
        queryKey: ["suppliers-active"],
        queryFn: () => axios.get("/api/supplier", { params: { limit: 200, isActive: "true" } }).then(r => r.data),
        enabled: open,
    });

    const suppliers = suppliersData?.data || [];

    const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateMedicineInput>({
        resolver: zodResolver(updateMedicineSchema),
    });

    const [barcodeValue, setBarcodeValue] = useState(medicine?.barcode || "");
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scannerStarting, setScannerStarting] = useState(false);
    const [scannerError, setScannerError] = useState("");
    const [savingBarcode, setSavingBarcode] = useState(false);
    const savingBarcodeRef = useRef(false);
    const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [isTorchOn, setIsTorchOn] = useState(false);

    const scannerRef = useRef<ZxingBarcodeScanner | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        if (open && medicine) {
            const supplierId = typeof medicine.supplier === "object" && medicine.supplier?._id ? medicine.supplier._id : medicine.supplier || "";
            reset({
                name: medicine.name,
                genericName: medicine.genericName,
                category: medicine.category,
                manufacturer: medicine.manufacturer || "",
                unit: medicine.unit,
                currentStock: medicine.currentStock,
                minStockLevel: medicine.minStockLevel,
                unitCost: medicine.unitCost,
                sellingPrice: medicine.sellingPrice,
                batchNumber: medicine.batchNumber || "",
                expiryDate: medicine.expiryDate ? new Date(medicine.expiryDate).toISOString().split("T")[0] : "",
                supplier: supplierId as string,
                storageCondition: medicine.storageCondition || "",
                storageLocation: medicine.storageLocation || "",
                isActive: medicine.isActive,
            });
            setBarcodeValue(medicine.barcode || "");
        }
    }, [open, medicine, reset]);

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
        setScannerOpen(false);
        setScannerError("");
        setCameraPermissionDenied(false);
    }, [stopScanner]);

    const handleScanSuccess = useCallback(async (decodedText: string) => {
        if (savingBarcodeRef.current) return;
        stopScanner();

        const rawCode = decodedText.trim();
        const { parseBarcodeData } = await import("@/lib/utils/barcode-parser");
        const parsed = parseBarcodeData(rawCode);
        const code = parsed.barcode || rawCode;

        savingBarcodeRef.current = true;
        setSavingBarcode(true);
        setScannerError("");

        try {
            await axios.post("/api/pharmacy/barcode", { medicineId: medicine._id, barcode: code });
            setBarcodeValue(code);
            closeScanner();
            toast.success("Barcode saved successfully!");
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setScannerError(msg || "Failed to save barcode. Please try again.");
        } finally {
            savingBarcodeRef.current = false;
            setSavingBarcode(false);
        }
    }, [stopScanner, closeScanner, medicine?._id]);

    // --- Start camera when scanner modal opens ---
    useEffect(() => {
        if (!scannerOpen) {
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
    }, [scannerOpen, handleScanSuccess, stopScanner]);

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
    };

    return (
        <>
            <Modal open={open} onClose={handleClose} title="Edit Medicine" size="lg">
                {error && <Alert type="error">{error}</Alert>}
                <form onSubmit={handleSubmit(onUpdate)} className="space-y-4 mt-2">
                    <FormField label="Barcode">
                        <div className="flex items-center gap-2">
                            <Input
                                value={barcodeValue}
                                disabled
                                readOnly
                                placeholder="No barcode assigned"
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setScannerOpen(true)}
                            >
                                <Camera className="w-3.5 h-3.5" />
                                {barcodeValue ? "Edit" : "Add"}
                            </Button>
                        </div>
                    </FormField>

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
                                {["Antibiotic", "Analgesic", "Antihypertensive", "Antidiabetic", "Antacid", "Vitamin", "Steroid", "Antihistamine", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        </FormField>
                        <FormField label="Unit" required error={errors.unit?.message}>
                            <Select {...register("unit")} error={!!errors.unit}>
                                <option value="">Select</option>
                                {["tablet", "capsule", "ml", "mg", "syrup", "injection", "cream", "drops", "inhaler", "sachet"].map(u => <option key={u} value={u}>{u}</option>)}
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
                                {["Room Temperature", "Refrigerated (2-8°C)", "Cool & Dry Place", "Freezer", "Protect from Light", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        </FormField>
                        <FormField label="Storage Location">
                            <Input {...register("storageLocation")} placeholder="e.g., Shelf A-1, Cold Storage 2" />
                        </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField label="Unit Cost (PKR)" required error={errors.unitCost?.message}>
                            <Input type="number" {...register("unitCost", { valueAsNumber: true })} error={!!errors.unitCost} />
                        </FormField>
                        <FormField label="Selling Price (PKR)" required error={errors.sellingPrice?.message}>
                            <Input type="number" {...register("sellingPrice", { valueAsNumber: true })} error={!!errors.sellingPrice} />
                        </FormField>
                        <FormField label="Batch Number">
                            <Input {...register("batchNumber")} />
                        </FormField>
                    </div>
                    <FormField label="Supplier">
                        <Select {...register("supplier")}>
                            <option value="">Select supplier (optional)</option>
                            {suppliers.map((s: { _id: string; name: string; type: string }) => (
                                <option key={s._id} value={s._id}>{s.name} ({s.type})</option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField label="Status">
                        <Select {...register("isActive", { setValueAs: (v: any) => String(v) === "true" })}>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </Select>
                    </FormField>
                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
                        <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
                        <Button type="submit" loading={isPending}>Save Changes</Button>
                    </div>
                </form>
            </Modal>

            {/* Scanner sub-modal */}
            <Modal open={scannerOpen} onClose={closeScanner} title={barcodeValue ? "Edit Barcode" : "Add Barcode"} size="md">
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

                                {(scannerStarting || savingBarcode) && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
                                        <div className="flex items-center gap-2 text-gray-600 text-xs">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {savingBarcode ? "Saving barcode..." : "Starting camera..."}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                                <BarcodeIcon className="w-3.5 h-3.5" />
                                Align the barcode within the frame. It will scan automatically.
                            </p>

                            <div className="flex justify-end pt-2 border-t border-gray-300">
                                <Button type="button" variant="secondary" onClick={closeScanner}>Cancel</Button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </>
    );
}