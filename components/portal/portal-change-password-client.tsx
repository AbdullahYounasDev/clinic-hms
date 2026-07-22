"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema } from "@/lib/validations";
import { Card, CardBody, Button, FormField, Input, Alert } from "@/components/ui";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function PortalChangePasswordClient() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(changePasswordSchema),
  });

  const mutation = useMutation({
    mutationFn: (d: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      axios.post("/api/portal/change-password", d),
    onSuccess: async () => {
      toast.success("Password changed successfully");
      reset();
      setError("");
      await updateSession();
      router.push("/portal");
      router.refresh();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to change password";
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Change Password</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {session?.user?.mustChangePassword
            ? "You must set a new password before continuing."
            : "Update your portal password"}
        </p>
      </div>

      {session?.user?.mustChangePassword && (
        <Alert type="warning">Your password was set by clinic staff. Please choose a new password now.</Alert>
      )}

      <Card>
        <CardBody>
          {error && <Alert type="error">{error}</Alert>}
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
            <FormField label="Current Password" required error={errors.currentPassword?.message}>
              <div className="relative">
                <Input type={showCurrent ? "text" : "password"} {...register("currentPassword")} error={!!errors.currentPassword} />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>
            <FormField label="New Password" required error={errors.newPassword?.message}>
              <div className="relative">
                <Input type={showNew ? "text" : "password"} {...register("newPassword")} error={!!errors.newPassword} />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>
            <FormField label="Confirm Password" required error={errors.confirmPassword?.message}>
              <Input type="password" {...register("confirmPassword")} error={!!errors.confirmPassword} />
            </FormField>
            <Button type="submit" loading={mutation.isPending} className="w-full">
              Save New Password
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
