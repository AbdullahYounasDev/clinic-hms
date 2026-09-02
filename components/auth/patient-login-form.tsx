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
import { ThemeToggle, PoweredByNyron } from "@/components/ui";

const patientRotatingTexts = [
  "book appointments",
  "view lab results",
  "check prescriptions",
  "access medical records",
  "track billing history",
];

export function PatientLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/portal";
  const { clinicName, clinicTagline, logoUrl } = useClinicSettings();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const dark = localStorage.getItem("theme") === "dark" || document.documentElement.classList.contains("dark");
    setIsDark(dark);
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  // Rotating text animation
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTextVisible(false);
      setTimeout(() => {
        setCurrentTextIndex((prev) => (prev + 1) % patientRotatingTexts.length);
        setIsTextVisible(true);
      }, 300);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

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
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email or password.");
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
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden bg-white dark:bg-gray-950 transition-colors">
      {/* Left Section - Desktop Banner (Identical layout to Staff Login) */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-teal-800 via-teal-700 to-teal-900 min-h-screen">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <Image
            src="/clinic-bg.jpg"
            alt="Clinic Background"
            fill
            className="object-cover opacity-20"
            priority
            sizes="55vw"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white w-full">
          {/* Logo */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center overflow-hidden p-1 border border-white/20">
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.endsWith("/logo.png")) {
                        target.src = "/logo.png";
                      }
                    }}
                  />
                ) : (
                  <Hospital className="w-8 h-8 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{clinicName || "ClinicHMS"}</h2>
                <p className="text-xs text-teal-200">{clinicTagline || "Patient Portal"}</p>
              </div>
            </div>
          </div>

          {/* Animated Welcome Text */}
          <div className="space-y-4">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              Patient Portal
            </h1>
            <div className="h-12 overflow-hidden">
              <p className="text-xl text-teal-200">
                Easy access to{" "}
                <span
                  className={cn(
                    "inline-block text-white font-semibold transition-all duration-500",
                    isTextVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-4"
                  )}
                >
                  {patientRotatingTexts[currentTextIndex]}
                </span>
              </p>
            </div>
          </div>

          {/* Decorative Dots */}
          <div className="mt-12 flex gap-2">
            {patientRotatingTexts.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  index === currentTextIndex
                    ? "w-8 bg-teal-300"
                    : "w-2 bg-teal-600"
                )}
              />
            ))}
          </div>
        </div>

        {/* Diagonal Cut */}
        <div className="absolute right-0 top-0 bottom-0 w-24 lg:w-32 z-20">
          <div
            className="absolute inset-0 bg-gray-50 dark:bg-gray-950 lg:bg-white dark:lg:bg-gray-900 transition-colors"
            style={{
              clipPath: 'polygon(100% 0, 0 0, 100% 100%)'
            }}
          />
        </div>
      </div>

      {/* Right Section - Patient Form Container */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-4 sm:p-6 lg:p-8 min-h-screen relative bg-gray-50 dark:bg-gray-950 lg:bg-white dark:lg:bg-gray-900 transition-colors">
        {/* Top Theme Toggle */}
        <div className="absolute top-4 right-4 z-30">
          <ThemeToggle isDark={isDark} onToggle={toggleDark} />
        </div>

        <div className="relative w-full max-w-md">
          {/* Mobile/Tablet Hero Banner */}
          <div className="lg:hidden relative w-full h-56 sm:h-64 rounded-3xl overflow-hidden shadow-lg mb-6">
            <Image
              src="/clinic-bg.jpg"
              alt="Clinic Background"
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-teal-900/30 via-teal-900/50 to-teal-950/90" />

            <div className="relative z-10 h-full flex flex-col justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shrink-0 overflow-hidden p-0.5">
                  {logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="w-full h-full object-contain rounded-full"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.endsWith("/logo.png")) {
                          target.src = "/logo.png";
                        }
                      }}
                    />
                  ) : (
                    <Hospital className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white leading-tight">
                    {clinicName || 'ClinicHMS'}
                  </h1>
                  <p className="text-teal-200 text-xs">Patient Portal</p>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white leading-tight mb-1">
                  Patient Portal
                </h2>
                <div className="h-6 overflow-hidden">
                  <p className="text-sm text-teal-200">
                    Easy access to{" "}
                    <span
                      className={cn(
                        "inline-block text-white font-semibold transition-all duration-500",
                        isTextVisible
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-4"
                      )}
                    >
                      {patientRotatingTexts[currentTextIndex]}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="lg:bg-transparent bg-white dark:bg-gray-900 rounded-2xl p-6 sm:p-8 shadow-xl lg:shadow-none border lg:border-0 border-gray-200 dark:border-gray-800">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Patient Sign in
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                Enter your email address and portal password
              </p>
            </div>

            <div className="mb-5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 px-4 py-3 text-xs text-teal-800 dark:text-teal-300">
              <p className="font-semibold mb-0.5">Demo credentials</p>
              <p>Email: demo@patient.com</p>
              <p>Password: 123456789</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="patient@example.com"
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500",
                    "focus:outline-none transition-all duration-200 bg-white dark:bg-gray-800/80",
                    errors.email
                      ? "border-red-400 bg-red-50/50 dark:bg-red-950/20"
                      : "border-gray-200 dark:border-gray-700 focus:border-teal-500"
                  )}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-red-500 dark:text-red-400 text-xs mt-1.5 ml-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={cn(
                      "w-full px-4 py-3 pr-12 rounded-xl border-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500",
                      "focus:outline-none transition-all duration-200 bg-white dark:bg-gray-800/80",
                      errors.password
                        ? "border-red-400 bg-red-50/50 dark:bg-red-950/20"
                        : "border-gray-200 dark:border-gray-700 focus:border-teal-500"
                    )}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-teal-500" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 dark:text-red-400 text-xs mt-1.5 ml-1">{errors.password.message}</p>
                )}
              </div>

              <button
              data-storepulse-product-id="patient-signin"
                data-storepulse-product-name="Patient Sign in Button"
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl cursor-pointer group active:scale-[0.98]",
                  "bg-teal-600 hover:bg-teal-700 active:bg-teal-800",
                  "text-white font-semibold text-sm",
                  "transition-all duration-200 shadow-xs",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ChevronRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-5">
              Clinic staff member?{" "}
              <Link href="/login" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                Staff Portal Login
              </Link>
            </p>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <PoweredByNyron />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
