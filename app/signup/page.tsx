"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, Loader2, Check, X, Mail, ArrowLeft, CheckCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuthStore } from "@/lib/store/auth-store"
import { api } from "@/lib/api"

const DISABLE_EMAIL_VERIFICATION = process.env.NEXT_PUBLIC_DISABLE_EMAIL_VERIFICATION === 'true'
const REQUIRE_VERIFICATION = !DISABLE_EMAIL_VERIFICATION
const EMPTY_CODE = ["", "", "", "", "", ""]

export default function SignupPage() {
  const router = useRouter()
  const { setUser, setToken } = useAuthStore()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)
  // Kept on this screen (not in the shared store) so a message or a spinner
  // left over from another screen can never show up here.
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)

  // Email verification state
  const [step, setStep] = useState<"signup" | "verify">("signup")
  const [verificationCode, setVerificationCode] = useState(EMPTY_CODE)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null)
  const [signupData, setSignupData] = useState<{ email: string; token: string; userId: string } | null>(null)
  const [cameBack, setCameBack] = useState(false)

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  // Put the cursor in the first code box when the code screen opens.
  useEffect(() => {
    if (step === "verify") inputRefs.current[0]?.focus()
  }, [step])

  const passwordRequirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(password) },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains a special character (!@#$%^&*)", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ]

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const allRequirementsMet = passwordRequirements.every((req) => req.met)
  const canSubmit = isValidEmail && allRequirementsMet && passwordsMatch && acceptTerms
  const alreadyRegistered = !!error && /already registered/i.test(error)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setError(null)
    setLoading(true)

    // Create the account. If this person already started signing up with the
    // same email and password but never entered their code, the server sends
    // a fresh code and answers as if the account had just been created - so
    // "Back" (or a reload) on the code screen is never a dead end.
    const result = await api.auth.signup({ email, password })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.data) {
      if (REQUIRE_VERIFICATION) {
        setSignupData({ email: result.data.email, token: result.data.token, userId: String(result.data.user_id || "") })
        setVerificationCode(EMPTY_CODE)
        setVerificationError(null)
        setVerificationNotice(
          (result.data as { resumed?: boolean }).resumed
            ? "Welcome back. We have emailed you a new code - the earlier one no longer works."
            : null
        )
        setStep("verify")
        setLoading(false)
      } else {
        // Verification switched off: go straight to onboarding
        setUser({ id: result.data.user_id, email: result.data.email })
        setToken(result.data.token)
        setLoading(false)
        router.push("/onboarding")
      }
    }
  }

  const fillCodeFrom = (index: number, digits: string) => {
    const chars = digits.replace(/\D/g, "").split("").slice(0, 6 - index)
    if (chars.length === 0) return
    const newCode = [...verificationCode]
    chars.forEach((char, i) => {
      newCode[index + i] = char
    })
    setVerificationCode(newCode)
    inputRefs.current[Math.min(index + chars.length, 5)]?.focus()
  }

  const handleVerificationInput = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "")
    if (digits.length > 1) {
      fillCodeFrom(index, digits)
      return
    }
    const newCode = [...verificationCode]
    newCode[index] = digits
    setVerificationCode(newCode)
    if (digits && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleVerificationKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === "Enter" && verificationCode.every((c) => c !== "")) {
      e.preventDefault()
      handleVerifyCode()
    }
  }

  const handleResendCode = async () => {
    if (!signupData) return

    setIsResending(true)
    setVerificationError(null)
    setVerificationNotice(null)

    const result = await api.auth.resendVerification({ email: signupData.email })

    if (result.error) {
      setVerificationError(result.error)
    } else {
      setVerificationNotice("A new code is on its way. Please use the newest email - earlier codes no longer work.")
    }

    setIsResending(false)
    setResendCooldown(60)
    setVerificationCode(EMPTY_CODE)
  }

  const handleVerifyCode = async () => {
    const code = verificationCode.join("")
    if (code.length !== 6 || !signupData) return

    setVerificationError(null)
    setVerificationNotice(null)
    setLoading(true)

    const result = await api.auth.verifyEmail({ email: signupData.email, code })

    if (result.error) {
      setVerificationError(result.error)
      setLoading(false)
      return
    }

    // Email verified, proceed to onboarding
    setUser({ id: signupData.userId, email: signupData.email })
    setToken(signupData.token)
    setLoading(false)
    router.push("/onboarding")
  }

  const isCodeComplete = verificationCode.every(c => c !== "")

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-background">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Heart className="h-10 w-10 text-primary fill-primary" aria-hidden="true" />
          <span className="text-3xl font-bold text-foreground">D8-LPA</span>
        </div>

        {step === "signup" && (
            <div className="space-y-5">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
                <p className="text-muted-foreground mt-2">
                  Join D8-LPA and find your perfect match
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {cameBack && !error && (
                  <p role="status" className="rounded-lg bg-muted p-3 text-base text-foreground">
                    Check your email address below and correct it if needed, then choose Create Account again. We will send a new code.
                  </p>
                )}
                {error && (
                  <div role="alert" id="signup-error" className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-base">
                    <p>{error}</p>
                    {alreadyRegistered && (
                      <p className="mt-2 text-foreground">
                        Is this your account?{" "}
                        <Link href="/login" className="font-semibold text-primary underline">Sign in</Link>
                        {" "}or{" "}
                        <Link href="/forgot-password" className="font-semibold text-primary underline">reset your password</Link>.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-invalid={!!email && !isValidEmail}
                    aria-describedby={email && !isValidEmail ? "email-error" : undefined}
                    className="h-12"
                  />
                  {email && !isValidEmail && (
                    <p id="email-error" className="text-sm text-destructive">Please enter a valid email address</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    aria-describedby="password-rules"
                    className="h-12"
                  />
                  <ul id="password-rules" aria-label="Password rules" className={password ? "mt-2 space-y-1" : "sr-only"}>
                    {passwordRequirements.map((req) => (
                      <li key={req.label} className="flex items-center gap-2 text-sm">
                        {req.met ? (
                          <Check className="h-4 w-4 text-success" aria-hidden="true" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className={req.met ? "text-success" : "text-muted-foreground"}>
                          {req.label}
                          <span className="sr-only">{req.met ? " - done" : " - not yet"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    aria-invalid={!!confirmPassword && !passwordsMatch}
                    aria-describedby={confirmPassword ? "confirm-status" : undefined}
                    className="h-12"
                  />
                  {confirmPassword && (
                    <div id="confirm-status" className="flex items-center gap-2 text-sm mt-1">
                      {passwordsMatch ? (
                        <>
                          <Check className="h-4 w-4 text-success" aria-hidden="true" />
                          <span className="text-success">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 text-destructive" aria-hidden="true" />
                          <span className="text-destructive">Passwords do not match</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                    className="mt-1 h-5 w-5"
                  />
                  <Label htmlFor="terms" className="text-base font-normal cursor-pointer leading-relaxed block">
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-primary underline">
                      Privacy Policy
                    </Link>
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold"
                  disabled={!canSubmit || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
                {!canSubmit && (email || password) && (
                  <p className="text-center text-sm text-muted-foreground">
                    Fill in every box above and tick the agreement to continue.
                  </p>
                )}
              </form>

              <p className="text-center mt-8 text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-medium underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => {
                  // The email (and the rest of the form) is kept, so a typing
                  // mistake in the address can be put right. Submitting again
                  // with the same details comes straight back here.
                  setStep("signup")
                  setCameBack(true)
                  setError(null)
                  setVerificationCode(EMPTY_CODE)
                  setVerificationError(null)
                  setVerificationNotice(null)
                }}
                className="flex min-h-11 items-center gap-2 rounded text-primary hover:underline mb-4"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to signup
              </button>

              <div className="text-center mb-10">
                <div className="flex justify-center mb-4">
                  <Mail className="h-12 w-12 text-primary/80" aria-hidden="true" />
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Verify your email</h1>
                <p className="text-muted-foreground text-base">
                  We sent a 6-digit code to <strong className="text-foreground break-all">{signupData?.email}</strong>
                </p>
              </div>

              {verificationError && (
                <div role="alert" className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-base font-medium">
                  {verificationError}
                </div>
              )}
              <p role="status" aria-live="polite" className={verificationNotice ? "rounded-lg bg-muted p-3 text-base text-foreground" : "sr-only"}>
                {verificationNotice}
              </p>

              <div className="bg-muted/30 rounded-lg p-4 text-center" role="group" aria-labelledby="code-label">
                <p id="code-label" className="text-sm text-muted-foreground mb-4">Enter the verification code:</p>
                <div className="flex gap-2 sm:gap-3 justify-center">
                  {verificationCode.map((code, index) => (
                    <Input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Digit ${index + 1} of 6`}
                      maxLength={1}
                      value={code}
                      onChange={(e) => handleVerificationInput(index, e.target.value)}
                      onKeyDown={(e) => handleVerificationKeyDown(index, e)}
                      onPaste={(e) => {
                        // Pasting the whole code into any box fills them all.
                        const pasted = e.clipboardData.getData("text")
                        if (/\d/.test(pasted)) {
                          e.preventDefault()
                          fillCodeFrom(index, pasted)
                        }
                      }}
                      ref={(el) => {
                        // Must not return a value: React 19 treats a returned
                        // non-function ref callback result as a cleanup.
                        inputRefs.current[index] = el
                      }}
                      className="w-11 sm:w-14 h-14 sm:h-16 px-0 text-center text-2xl font-bold border-2 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  ))}
                </div>
              </div>

              <Button
                type="button"
                className="w-full h-12 text-base font-semibold"
                onClick={handleVerifyCode}
                disabled={isLoading || !isCodeComplete}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" aria-hidden="true" />
                    Verify Code
                  </>
                )}
              </Button>

              {!isResending && resendCooldown === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 text-base font-semibold"
                  onClick={handleResendCode}
                >
                  <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Resend Code
                </Button>
              )}

              {isResending && (
                <Button type="button" variant="outline" className="w-full h-12 text-base font-semibold" disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Resending...
                </Button>
              )}

              {resendCooldown > 0 && (
                <p className="text-center text-muted-foreground text-sm font-medium">
                  Resend code in <strong>{resendCooldown}s</strong>
                </p>
              )}

              <div className="border-t pt-6 space-y-3">
                <h2 className="text-center text-sm text-muted-foreground">
                  Didn&apos;t receive the code?
                </h2>
                <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc pl-4">
                  <li>Check your spam folder</li>
                  <li>Make sure you entered the correct email - choose &quot;Back to signup&quot; to change it</li>
                  <li>{resendCooldown === 0 ? "Try requesting a new code above" : `Try requesting a new code in ${resendCooldown}s`}</li>
                </ul>
              </div>
            </div>
          )}
      </div>
    </main>
  )
}
