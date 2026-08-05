// components/billing/lab-invoice-section.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWatch } from "react-hook-form";
import axios from "axios";
import { Card, CardBody, FormField, Select, Badge } from "@/components/ui";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { UseFormSetValue, Control } from "react-hook-form";

interface LineItem {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
  catalogId?: string;
  labOrderId?: string;
}

interface Props {
  watchedItems: LineItem[];
  setValue: UseFormSetValue<any>;
  register: any;
  control?: Control<any>;
}

export function LabInvoiceSection({ watchedItems, setValue, register, control }: Props) {
  const selectedPatient = useWatch({ control, name: "patient" });

  const { data: patientsData } = useQuery({
    queryKey: ["patients-select"],
    queryFn: () => axios.get("/api/publicPatients", { params: { limit: 200 } }).then((r) => r.data),
  });

  const { data: labTestsData, isLoading } = useQuery({
    queryKey: ["patient-unpaid-lab-tests", selectedPatient],
    queryFn: () =>
      axios
        .get("/api/lab", { params: { patient: selectedPatient, isPaid: "false", limit: 50 } })
        .then((r) => r.data),
    enabled: !!selectedPatient,
  });

  const patients = patientsData?.data || [];
  const labOrders = labTestsData?.data || [];

  const addLabOrderItems = (labOrder: any) => {
    const orderTests = labOrder.tests || [];
    const newItems: LineItem[] = [];

    for (const t of orderTests) {
      const alreadyAdded = watchedItems.some(
        (item) => item.labOrderId === labOrder._id && item.catalogId === String(t.catalogId)
      );
      if (!alreadyAdded) {
        newItems.push({
          description: `${t.testName} (${t.testCode || labOrder.labTestId})`,
          category: "lab_test",
          quantity: 1,
          unitPrice: t.cost || 0,
          total: t.cost || 0,
          catalogId: String(t.catalogId),
          labOrderId: labOrder._id,
        });
      }
    }

    if (newItems.length > 0) {
      setValue("items", [...watchedItems, ...newItems]);
    }
  };

  return (
    <Card>
      <CardBody>
        <h3 className="text-xs font-semibold text-gray-900 mb-3">Lab Test Details</h3>
        <div className="space-y-4">
          <FormField label="Patient" required>
            <Select {...register("patient", { required: "Patient is required for Lab Tests" })}>
              <option value="">Select patient</option>
              {patients.map((p: any) => (
                <option key={p._id} value={p._id}>
                  {p.firstName} {p.lastName} ({p.patientId})
                </option>
              ))}
            </Select>
          </FormField>

          {selectedPatient && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Unpaid Lab Tests</p>
              {isLoading ? (
                <p className="text-xs text-gray-400 text-center py-4 animate-pulse">Loading lab tests...</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {labOrders.map((labOrder: any) => {
                    const orderTests = labOrder.tests || [];
                    const allAdded =
                      orderTests.length > 0 &&
                      orderTests.every((t: any) =>
                        watchedItems.some(
                          (item) => item.labOrderId === labOrder._id && item.catalogId === String(t.catalogId)
                        )
                      );

                    const testNames = orderTests.map((t: any) => t.testName).join(", ") || "Lab Test";

                    return (
                      <div
                        key={labOrder._id}
                        className={cn(
                          "flex items-center justify-between p-3 border rounded-lg transition-all",
                          allAdded
                            ? "bg-teal-50/50 border-teal-200 cursor-default"
                            : "border-gray-200 hover:border-teal-500 cursor-pointer"
                        )}
                        onClick={() => !allAdded && addLabOrderItems(labOrder)}
                      >
                        <div>
                          <p className="text-xs font-medium text-gray-900">
                            {testNames}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {labOrder.labTestId} • {formatDate(labOrder.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={allAdded ? "success" : "outline"}>
                            {allAdded ? "Added" : formatCurrency(labOrder.totalCost)}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}

                  {labOrders.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No unpaid lab tests found for this patient</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}