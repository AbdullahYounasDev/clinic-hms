"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Plus, Calendar, Clock, AlertCircle } from "lucide-react";
import { Card, Table, Th, Td, StatusBadge, EmptyState, Pagination, Badge, Button, Modal, FormField, Input, Select, Alert } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { PatientQueueBanner, PatientQueueBannerData } from "./patient-queue-banner";

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PortalAppointmentsClient() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookError, setBookError] = useState("");

  // Booking Form State
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedTime, setSelectedTime] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["portal-appointments", page],
    queryFn: () => axios.get("/api/portal/appointments", { params: { page, limit: 15 } }).then((r) => r.data),
  });

  const {
    data: queueData,
    isFetching: queueFetching,
    refetch: refetchQueue,
  } = useQuery<{ success: boolean; data: PatientQueueBannerData }>({
    queryKey: ["portal-queue-status"],
    queryFn: () => axios.get("/api/portal/queue-status").then((r) => r.data),
    refetchInterval: 20_000,
  });

  // Query doctors for portal booking
  const { data: doctorsData } = useQuery({
    queryKey: ["portal-doctors"],
    queryFn: () => axios.get("/api/portal/doctors").then((r) => r.data),
    enabled: bookModalOpen,
  });

  // Query available slots for chosen doctor and date (strictly uses doctor's default appointment duration)
  const { data: slotsData, isFetching: slotsFetching } = useQuery({
    queryKey: ["portal-available-slots", selectedDoctor, selectedDate],
    queryFn: () =>
      axios
        .get("/api/portal/available-slots", { params: { doctor: selectedDoctor, date: selectedDate } })
        .then((r) => r.data),
    enabled: bookModalOpen && !!selectedDoctor && !!selectedDate,
  });

  const bookMutation = useMutation({
    mutationFn: (payload: { doctor: string; scheduledDate: string; scheduledTime: string; chiefComplaint?: string }) =>
      axios.post("/api/portal/appointments", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-appointments"] });
      qc.invalidateQueries({ queryKey: ["portal-queue-status"] });
      setBookModalOpen(false);
      resetBookingForm();
      toast.success("Appointment booked successfully!");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to book appointment";
      setBookError(msg);
      toast.error(msg);
    },
  });

  const resetBookingForm = () => {
    setSelectedDoctor("");
    setSelectedDate(getTodayString());
    setSelectedTime("");
    setChiefComplaint("");
    setBookError("");
  };

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBookError("");
    if (!selectedDoctor) {
      setBookError("Please select a doctor.");
      return;
    }
    if (!selectedDate) {
      setBookError("Please select an appointment date.");
      return;
    }
    if (!selectedTime) {
      setBookError("Please select an available time slot.");
      return;
    }

    bookMutation.mutate({
      doctor: selectedDoctor,
      scheduledDate: selectedDate,
      scheduledTime: selectedTime,
      chiefComplaint,
    });
  };

  const appointments = data?.data || [];
  const pagination = data?.pagination;
  const doctorsList = doctorsData?.data || [];
  const availableSlots = slotsData?.data?.slots || [];
  const doctorDefaultDuration = slotsData?.data?.appointmentDuration || 30;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Appointments</h1>
          <p className="text-xs text-gray-500 mt-0.5">Your scheduled and past visits</p>
        </div>
        <Button size="sm" onClick={() => setBookModalOpen(true)}>
          <Plus className="w-4 h-4" /> Book Appointment
        </Button>
      </div>

      <PatientQueueBanner
        data={queueData?.data}
        onReload={() => refetchQueue()}
        isReloading={queueFetching}
      />

      {/* Desktop Table */}
      <Card className="hidden md:block overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Doctor</Th>
              <Th>Date</Th>
              <Th>Time</Th>
              <Th>Queue</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => <Td key={j}><div className="h-4 bg-gray-100 rounded" /></Td>)}</tr>
              ))
            ) : appointments.length === 0 ? (
              <tr><td colSpan={6}><EmptyState title="No appointments" description="You have no appointments on record." /></td></tr>
            ) : (
              appointments.map((a: any) => (
                <tr key={a._id}>
                  <Td className="font-medium text-gray-900">{a.appointmentId}</Td>
                  <Td>
                    <div className="font-medium text-gray-900">Dr. {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}</div>
                    <div className="text-xs text-gray-500">{a.doctor?.specialization}</div>
                  </Td>
                  <Td className="text-gray-500">{formatDate(a.scheduledDate)}</Td>
                  <Td className="text-gray-500">{a.scheduledTime}</Td>
                  <Td>
                    {a.queueNumber != null ? (
                      <Badge variant={a.queueNumber === 0 ? "warning" : "info"}>
                        #{a.queueNumber === 0 ? "P" : a.queueNumber}
                      </Badge>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={a.status} />
                    {a.status === "cancelled" && (
                      <div className="text-[11px] text-red-600 font-medium mt-1">
                        Reason: {a.cancellationReason || "Not provided"}
                      </div>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-300 flex justify-end">
            <Pagination page={page} totalPages={pagination.totalPages} onPage={setPage} />
          </div>
        )}
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-100 border border-gray-300 rounded-lg bg-white">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-100 rounded w-24" />
                <div className="h-6 bg-gray-100 rounded w-16" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-32" />
              <div className="flex items-center gap-2">
                <div className="h-3 bg-gray-100 rounded w-20" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            </div>
          ))
        ) : appointments.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No appointments" description="You have no appointments on record." />
          </div>
        ) : (
          appointments.map((a: any) => (
            <div key={a._id} className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-gray-900 block">
                    {a.appointmentId}
                  </span>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">
                    Dr. {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                <span>{formatDate(a.scheduledDate)}</span>
                <span className="text-gray-300">•</span>
                <span>{a.scheduledTime}</span>
                {a.queueNumber != null && (
                  <>
                    <span className="text-gray-300">•</span>
                    <Badge variant={a.queueNumber === 0 ? "warning" : "info"} className="text-[10px]">
                      #{a.queueNumber === 0 ? "P" : a.queueNumber}
                    </Badge>
                  </>
                )}
              </div>

              {a.status === "cancelled" && (
                <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-100 font-medium">
                  Cancellation Reason: {a.cancellationReason || "Not provided"}
                </div>
              )}
            </div>
          ))
        )}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 flex justify-center border-t border-gray-100">
            <Pagination page={page} totalPages={pagination.totalPages} onPage={setPage} />
          </div>
        )}
      </div>

      {/* Book Appointment Modal */}
      <Modal
        open={bookModalOpen}
        onClose={() => {
          setBookModalOpen(false);
          resetBookingForm();
        }}
        title="Book Appointment"
        size="lg"
      >
        {bookError && <Alert type="error">{bookError}</Alert>}

        <form onSubmit={handleBookSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Doctor" required>
              <Select
                value={selectedDoctor}
                onChange={(e) => {
                  setSelectedDoctor(e.target.value);
                  setSelectedTime("");
                }}
              >
                <option value="">Select doctor</option>
                {doctorsList.map((d: any) => (
                  <option key={d._id} value={d._id}>
                    Dr. {d.user?.firstName} {d.user?.lastName} ({d.specialization})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Appointment Date" required>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedTime("");
                }}
              />
            </FormField>
          </div>

          {selectedDoctor && selectedDate && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  Select Available Time Slot
                </label>
                <span className="text-[11px] text-gray-500 font-normal">
                  Slot Duration: <strong className="text-teal-700">{doctorDefaultDuration} mins</strong>
                </span>
              </div>

              {slotsFetching ? (
                <div className="p-4 text-center text-xs text-gray-500 animate-pulse">
                  Calculating available slots for doctor's schedule...
                </div>
              ) : slotsData?.data?.isHoliday ? (
                <Alert type="warning">
                  Clinic is closed on this date ({slotsData.data.holidayReason || "Holiday"}).
                </Alert>
              ) : slotsData?.data?.isOnLeave ? (
                <Alert type="warning">
                  Doctor is on leave on this date ({slotsData.data.leaveReason || "On Leave"}).
                </Alert>
              ) : !slotsData?.data?.isWorkingDay ? (
                <Alert type="warning">Doctor is not scheduled to work on this day.</Alert>
              ) : availableSlots.length === 0 ? (
                <Alert type="warning">No available time slots for this date.</Alert>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg bg-gray-50/50">
                  {availableSlots.map((slot: any) => {
                    const isSelected = selectedTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`px-2 py-1.5 rounded text-xs font-medium border transition-all ${
                          isSelected
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                            : slot.available
                            ? "bg-white text-gray-800 border-gray-300 hover:border-teal-500 hover:bg-teal-50"
                            : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through"
                        }`}
                      >
                        {slot.displayTime}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <FormField label="Chief Complaint / Reason for Visit (Optional)">
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              rows={2}
              placeholder="e.g. Regular checkup, Fever for 2 days, Follow up on test results"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs resize-none focus:outline-none focus:border-teal-600 text-gray-700 placeholder:text-gray-400"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setBookModalOpen(false);
                resetBookingForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={bookMutation.isPending}
              disabled={!selectedDoctor || !selectedDate || !selectedTime}
            >
              Confirm Appointment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
