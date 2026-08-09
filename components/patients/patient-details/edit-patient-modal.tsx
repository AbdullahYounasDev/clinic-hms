// components/patients/patient-details/edit-patient-modal.tsx
"use client";

import { Modal, FormField, Input, Select, Button, Alert } from "@/components/ui";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updatePatientSchema, UpdatePatientInput } from "@/lib/validations";
import { useEffect, useState } from "react";
import { Eye, EyeOff, AlertTriangle, ShieldCheck, RotateCcw } from "lucide-react";
import { formatCNIC, normalizeCNIC } from "@/lib/utils/cnic-utils";
import axios from "axios";

function OptionalToggleHeader({
  label,
  checked,
  onChange,
  hint,
  icon: Icon,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  icon?: any;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-gray-200 mt-3 select-none">
      <div>
        <span className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
          {Icon && <Icon className="w-4 h-4 text-teal-600 shrink-0" />}
          {label}
        </span>
        {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 focus:ring-offset-0 accent-teal-600 cursor-pointer"
        />
      </label>
    </div>
  );
}

export function EditPatientModal({ open, onClose, patient, onUpdate, isPending, error }: any) {
  const [showPortalPassword, setShowPortalPassword] = useState(false);
  const [phoneWarning, setPhoneWarning] = useState<{ isDuplicate: boolean; matches: any[] }>({
    isDuplicate: false,
    matches: [],
  });

  // Optional Section Toggles
  const [showCnic, setShowCnic] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showGuardian, setShowGuardian] = useState(false);
  const [showMedical, setShowMedical] = useState(false);
  const [showInsurance, setShowInsurance] = useState(false);
  const [enablePortal, setEnablePortal] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<UpdatePatientInput>({
    resolver: zodResolver(updatePatientSchema),
  });

  const status = useWatch({ control, name: "status" });
  const isDeceased = status === "deceased";
  const watchedPhone = useWatch({ control, name: "phone" });
  const rawCnic = useWatch({ control, name: "cnic" });

  useEffect(() => {
    if (open && patient) {
      setShowPortalPassword(false);
      setPhoneWarning({ isDuplicate: false, matches: [] });

      // Auto-detect existing patient data to keep populated optional sections open
      setShowCnic(!!patient.cnic);
      setShowAddress(!!(patient.address?.street || patient.address?.city || patient.address?.state || patient.address?.country));
      setShowGuardian(!!(patient.emergencyContact?.name || patient.emergencyContact?.phone || patient.emergencyContact?.relationship || patient.emergencyContact?.email));
      setShowMedical(!!(patient.bloodGroup || patient.allergies?.length || patient.chronicDiseases?.length));
      setShowInsurance(!!(patient.insuranceDetails?.provider || patient.insuranceDetails?.policyNumber || patient.insuranceDetails?.coverageDetails || patient.insuranceDetails?.expiryDate));
      setEnablePortal(!!patient.portalEnabled);
      setShowNotes(!!patient.notes);

      reset({
        firstName: patient.firstName,
        lastName: patient.lastName,
        gender: patient.gender,
        dateOfBirth: patient.dateOfBirth?.split("T")[0],
        cnic: patient.cnic ? formatCNIC(patient.cnic) : "",
        phone: patient.phone,
        email: patient.email || "",
        bloodGroup: patient.bloodGroup || "",
        status: patient.status || "active",
        notes: patient.notes || "",
        address: patient.address || {},
        emergencyContact: patient.emergencyContact || {},
        allergies: patient.allergies || [],
        chronicDiseases: patient.chronicDiseases || [],
        insuranceDetails: {
          provider: patient.insuranceDetails?.provider || "",
          policyNumber: patient.insuranceDetails?.policyNumber || "",
          expiryDate: patient.insuranceDetails?.expiryDate
            ? new Date(patient.insuranceDetails.expiryDate).toISOString().split("T")[0]
            : "",
          coverageDetails: patient.insuranceDetails?.coverageDetails || "",
        },
        dateOfDeath: patient.dateOfDeath || "",
        causeOfDeath: patient.causeOfDeath || "",
      });
    }
  }, [open, patient, reset]);

  // Non-blocking duplicate phone warning
  useEffect(() => {
    if (!watchedPhone || watchedPhone.length < 5 || !patient?._id) {
      setPhoneWarning({ isDuplicate: false, matches: [] });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get("/api/patients/check-duplicate-phone", {
          params: { phone: watchedPhone, excludeId: patient._id },
        });
        if (res.data?.data) {
          setPhoneWarning(res.data.data);
        }
      } catch {
        // Silently catch duplicate phone check errors
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [watchedPhone, patient?._id]);

  const handleFormSubmit = (data: UpdatePatientInput) => {
    const formatted = { ...data };
    if (formatted.cnic) {
      formatted.cnic = normalizeCNIC(formatted.cnic);
    }
    if (!formatted.portalPassword || !formatted.portalPassword.trim()) {
      delete formatted.portalPassword;
    }
    onUpdate(formatted);
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Patient Record" size="lg">
      {error && <Alert type="error">{error}</Alert>}
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 mt-2">
        {/* Default Required Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="First Name" required error={errors.firstName?.message}>
            <Input {...register("firstName")} />
          </FormField>
          <FormField label="Last Name" required error={errors.lastName?.message}>
            <Input {...register("lastName")} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Gender" required error={errors.gender?.message}>
            <Select {...register("gender")}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </FormField>
          <FormField label="Date of Birth" required error={errors.dateOfBirth?.message}>
            <Input type="date" {...register("dateOfBirth")} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Phone Number" required error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="+92 300 1234567" />
          </FormField>
          <FormField label="Status" required error={errors.status?.message}>
            <Select {...register("status")}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="deceased">Deceased</option>
            </Select>
          </FormField>
        </div>

        {/* Non-blocking phone duplicate warning */}
        {phoneWarning.isDuplicate && phoneWarning.matches.length > 0 && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Notice:</span> Another patient shares this phone number (Shared family number):
              <ul className="mt-1 space-y-0.5 font-medium text-amber-900">
                {phoneWarning.matches.map((m: any) => (
                  <li key={m._id}>
                    • {m.name} ({m.patientId}) — Status: <span className="capitalize">{m.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {isDeceased && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-red-200 pt-4">
            <FormField label="Date of Death" required error={errors.dateOfDeath?.message}>
              <Input type="date" {...register("dateOfDeath")} />
            </FormField>
            <FormField label="Cause of Death" error={errors.causeOfDeath?.message}>
              <Input {...register("causeOfDeath")} placeholder="e.g., Cardiac Arrest" />
            </FormField>
          </div>
        )}

        {/* Optional Section: CNIC */}
        <OptionalToggleHeader label="Add CNIC" checked={showCnic} onChange={setShowCnic} />
        {showCnic && (
          <div className="pt-2">
            <FormField label="CNIC (Optional 13 Digits)" hint="Format: 34104-2611716-1" error={errors.cnic?.message}>
              <Input
                value={formatCNIC(rawCnic)}
                onChange={(e) => {
                  const normalized = normalizeCNIC(e.target.value);
                  setValue("cnic", normalized, { shouldValidate: true });
                }}
                placeholder="34104-2611716-1"
                maxLength={15}
                inputMode="numeric"
              />
            </FormField>
          </div>
        )}

        {/* Optional Section: Address Information */}
        <OptionalToggleHeader label="Add Address Information" checked={showAddress} onChange={setShowAddress} />
        {showAddress && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <FormField label="Street Address"><Input {...register("address.street")} placeholder="Street address" /></FormField>
            <FormField label="City"><Input {...register("address.city")} placeholder="City" /></FormField>
            <FormField label="State / Province"><Input {...register("address.state")} placeholder="State/Province" /></FormField>
            <FormField label="Country"><Input {...register("address.country")} placeholder="Country" /></FormField>
          </div>
        )}

        {/* Optional Section: Guardian / Next of Kin */}
        <OptionalToggleHeader label="Add Guardian / Next of Kin" checked={showGuardian} onChange={setShowGuardian} hint="Primary family or legal guardian contact" />
        {showGuardian && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <FormField label="Full Name"><Input {...register("emergencyContact.name")} placeholder="Guardian Full Name" /></FormField>
            <FormField label="Relationship"><Input {...register("emergencyContact.relationship")} placeholder="e.g. Parent, Spouse, Sibling" /></FormField>
            <FormField label="Phone Number"><Input {...register("emergencyContact.phone")} placeholder="+92 300 0000000" /></FormField>
            <FormField label="Email Address" error={errors.emergencyContact?.email?.message}>
              <Input type="email" {...register("emergencyContact.email")} placeholder="guardian@example.com" />
            </FormField>
          </div>
        )}

        {/* Optional Section: Medical Information */}
        <OptionalToggleHeader label="Add Medical Information" checked={showMedical} onChange={setShowMedical} />
        {showMedical && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Blood Group">
                <Select {...register("bloodGroup")}>
                  <option value="">Unknown</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Allergies (comma-separated)">
                <Input
                  defaultValue={watch("allergies")?.join(", ") || ""}
                  onBlur={(e) => setValue("allergies", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder="Penicillin, Nuts"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Chronic Diseases (comma-separated)">
                <Input
                  defaultValue={watch("chronicDiseases")?.join(", ") || ""}
                  onBlur={(e) => setValue("chronicDiseases", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder="Diabetes, Hypertension"
                />
              </FormField>
            </div>
          </div>
        )}

        {/* Optional Section: Insurance Details */}
        <OptionalToggleHeader label="Add Insurance Details" checked={showInsurance} onChange={setShowInsurance} />
        {showInsurance && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <FormField label="Insurance Provider"><Input {...register("insuranceDetails.provider")} placeholder="Insurance company" /></FormField>
            <FormField label="Policy Number"><Input {...register("insuranceDetails.policyNumber")} placeholder="Policy number" /></FormField>
            <FormField label="Expiry Date"><Input type="date" {...register("insuranceDetails.expiryDate")} /></FormField>
            <FormField label="Coverage Details"><Input {...register("insuranceDetails.coverageDetails")} placeholder="Coverage details" /></FormField>
          </div>
        )}

        {/* Optional Section: Patient Portal Access */}
        <OptionalToggleHeader label="Enable Patient Portal Access" icon={ShieldCheck} checked={enablePortal} onChange={setEnablePortal} hint="Allows patient to log in using Email + Password to view records online" />
        {enablePortal && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 p-3 bg-teal-50/50 rounded-xl border border-teal-100">
            <FormField label="Portal Email Address" required error={errors.email?.message}>
              <Input
                type="email"
                {...register("email")}
                placeholder="patient@example.com"
                error={!!errors.email}
              />
            </FormField>
            <FormField label="Reset Portal Password" hint="Optional" error={errors.portalPassword?.message}>
              <div className="relative">
                <Input
                  type={showPortalPassword ? "text" : "password"}
                  {...register("portalPassword")}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="pr-10"
                  error={!!errors.portalPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPortalPassword(!showPortalPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPortalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>
          </div>
        )}

        {/* Optional Section: Notes */}
        <OptionalToggleHeader label="Add Notes" checked={showNotes} onChange={setShowNotes} />
        {showNotes && (
          <div className="pt-2">
            <FormField label="Notes">
              <textarea
                {...register("notes")}
                rows={2}
                placeholder="Any relevant notes..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs resize-none focus:outline-none focus:border-teal-600 text-gray-700 placeholder:text-gray-400"
              />
            </FormField>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isPending}>Update Patient</Button>
        </div>
      </form>
    </Modal>
  );
}