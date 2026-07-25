"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { patientLoginSchema, PatientLoginInput } from "@/lib/validations";
import { Eye, EyeOff, Loader2, Hospital, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { useClinicSettings } from "@/components/providers/clinic-provider";

export function PatientLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/portal";
  const { clinicName, logoUrl } = useClinicSettings();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "account_inactive") {
      toast.error("Your portal access is not active. Contact the clinic.");
    }
  }, [searchParams]);

  const { register, handleSubmit, formState: { errors } } = useForm<PatientLoginInput>({
    resolver: zodResolver(patientLoginSchema),
  });

  const onSubmit = async (data: PatientLoginInput) => {
    setIsLoading(true);
    try {
      const result = await signIn("patient-credentials", {
        login: data.login,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email, phone, or password.");
        setIsLoading(false);
        return;
      }

      toast.success("Welcome back! Redirecting...");
      setTimeout(() => {
        router.push(callbackUrl);
        router.refresh();
      }, 800);
    } catch {
      toast.error("Something went wrong. Try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-teal-50 flex items-center justify-center overflow-hidden p-1">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl}
                alt=""
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.endsWith("/logo.png")) {
                    target.src = "/logo.png";
                  }
                }}
              />
            ) : (
              <Hospital className="w-8 h-8 text-teal-600" />
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">Patient Portal</h1>
          <p className="text-xs text-gray-500 mt-1">{clinicName || "ClinicHMS"}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in</h2>
          <p className="text-xs text-gray-500 mb-5">Use your email or phone number and portal password</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email or phone</label>
              <input
                type="text"
                autoComplete="username"
                placeholder="patient@email.com or +92 300..."
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none",
                  errors.login ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-teal-500"
                )}
                {...register("login")}
              />
              {errors.login && <p className="text-red-500 text-xs mt-1">{errors.login.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={cn(
                    "w-full px-4 py-3 pr-12 rounded-xl border-2 text-sm text-gray-900 focus:outline-none",
                    errors.password ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-teal-500"
                  )}
                  {...register("password")}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</> : <>Sign in<ChevronRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-5">
            Clinic staff?{" "}
            <Link href="/login" className="text-teal-600 font-medium">Staff login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
