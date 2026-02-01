"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, Eye, EyeOff, Loader2, Check, X, Mail, ArrowLeft, CheckCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuthStore } from "@/lib/store/auth-store"
import { api } from "@/lib/api"

const IS_PRODUCTION = process.env.NEXT_PUBLIC_ENV === 'production'
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'
const REQUIRE_VERIFICATION = IS_PRODUCTION  // Only require email verification in production

export default function SignupPage() {
  const router = useRouter()
  const { setUser, setToken, setError, setLoading, isLoading, error } = useAuthStore()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  
  // Email verification state
  const [step, setStep] = useState<"signup" | "verify">("signup")
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""])
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [signupData, setSignupData] = useState<{ email: string; token: string } | null>(null)

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setError(null)
    setLoading(true)

    // Create the account
    const result = await api.auth.signup({ email, password })
    
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.data) {
      // Skip email verification in development mode
      if (REQUIRE_VERIFICATION) {
        setSignupData({ email: result.data.email, token: result.data.token })
        setStep("verify")
        setLoading(false)
      } else {
        // In development, auto-verify and go straight to onboarding
        setUser({ id: result.data.user_id, email: result.data.email })
        setToken(result.data.token)
        setLoading(false)
        router.push("/onboarding")
      }
    }
  }

  const handleVerificationInput = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const chars = value.split("").slice(0, 6)
      const newCode = [...verificationCode]
      chars.forEach((char, i) => {
        if (index + i < 6) newCode[index + i] = char
      })
      setVerificationCode(newCode)
      const nextIndex = Math.min(index + chars.length, 5)
      inputRefs.current[nextIndex]?.focus()
    } else {
      const newCode = [...verificationCode]
      newCode[index] = value
      setVerificationCode(newCode)
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    }
  }

  const handleVerificationKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleResendCode = async () => {
    if (!signupData) return
    
    setIsResending(true)
    setVerificationError(null)
    
    const result = await api.auth.resendVerification({ email: signupData.email })
    
    if (result.error) {
      setVerificationError(result.error)
    }
    
    setIsResending(false)
    setResendCooldown(60)
    setVerificationCode(["", "", "", "", "", ""])
  }

  const handleVerifyCode = async () => {
    const code = verificationCode.join("")
    if (code.length !== 6 || !signupData) return

    setVerificationError(null)
    setLoading(true)

    const result = await api.auth.verifyEmail({ email: signupData.email, code })
    
    if (result.error) {
      setVerificationError(result.error)
      setLoading(false)
      return
    }

    // Email verified, proceed to onboarding
    if (signupData) {
      setUser({ id: "", email: signupData.email })
      setToken(signupData.token)
      setLoading(false)
      router.push("/onboarding")
    }
  }

  const isCodeComplete = verificationCode.every(c => c !== "")

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Heart className="h-10 w-10 text-primary fill-primary" />
          <span className="text-3xl font-bold text-foreground">D8-LPA</span>
        </div>

        {step === "signup" && (
            <div className="space-y-5">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
                <p className="text-muted-foreground mt-2">
                  Join D8-LPA and find your perfect match
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12"
                  />
                  {email && !isValidEmail && (
                    <p className="text-sm text-destructive">Please enter a valid email address</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 space-y-1">
                      {passwordRequirements.map((req) => (
                        <div key={req.label} className="flex items-center gap-2 text-sm">
                          {req.met ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={req.met ? "text-green-600" : "text-muted-foreground"}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-12"
                  />
                  {confirmPassword && (
                    <div className="flex items-center gap-2 text-sm mt-1">
                      {passwordsMatch ? (
                        <>
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-green-600">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 text-destructive" />
                          <span className="text-destructive">Passwords do not match</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                    className="mt-1"
                  />
                  <Label htmlFor="terms" className="text-sm font-normal cursor-pointer leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
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
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              <p className="text-center mt-8 text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-6">
              <button
                onClick={() => {
                  setStep("signup")
                  setVerificationCode(["", "", "", "", "", ""])
                  setVerificationError(null)
                }}
                className="flex items-center gap-2 text-primary hover:underline mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to signup
              </button>

              <div className="text-center mb-10">
                <div className="flex justify-center mb-4">
                  <Mail className="h-12 w-12 text-primary/80" />
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-2">Verify your email</h2>
                <p className="text-muted-foreground text-base">
                  We sent a 6-digit code to <strong className="text-foreground">{signupData?.email}</strong>
                </p>
              </div>

              {verificationError && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm font-medium">
                  {verificationError}
                </div>
              )}

              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-4">Enter the verification code:</p>
                <div className="flex gap-3 justify-center">
                  {verificationCode.map((code, index) => (
                    <Input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={code}
                      onChange={(e) => handleVerificationInput(index, e.target.value)}
                      onKeyDown={(e) => handleVerificationKeyDown(index, e)}
                      ref={(el) => (inputRefs.current[index] = el)}
                      className="w-14 h-16 text-center text-2xl font-bold border-2 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
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
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Resend Code
                </Button>
              )}

              {isResending && (
                <Button type="button" variant="outline" className="w-full h-12 text-base font-semibold" disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resending...
                </Button>
              )}

              {resendCooldown > 0 && (
                <p className="text-center text-muted-foreground text-sm font-medium">
                  Resend code in <strong>{resendCooldown}s</strong>
                </p>
              )}

              <div className="border-t pt-6 space-y-3">
                <p className="text-center text-sm text-muted-foreground">
                  Didn't receive the code? 
                </p>
                <ul className="text-sm text-muted-foreground space-y-2 ml-4">
                  <li>• Check your spam folder</li>
                  <li>• Make sure you entered the correct email</li>
                  <li>• {resendCooldown === 0 ? "Try requesting a new code below" : `Try requesting a new code in ${resendCooldown}s`}</li>
                </ul>
                <p className="text-xs text-muted-foreground text-center pt-2 italic">
                  (In development mode, check the terminal where your server is running for the verification code)
                </p>
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
