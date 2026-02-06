"use client"

import React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, Eye, EyeOff, Loader2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuthStore } from "@/lib/store/auth-store"
import { api } from "@/lib/api"

export default function AdminAccessPage() {
  const router = useRouter()
  const { user, setUser, setProfile, setToken, setError, setLoading, isLoading, error, clearAuth } = useAuthStore()
  
  // Code verification step
  const [step, setStep] = useState<"code" | "auth">("code")
  const [adminCode, setAdminCode] = useState("")
  const [codeError, setCodeError] = useState("")
  const [codeLoading, setCodeLoading] = useState(false)
  const [isCodeVerified, setIsCodeVerified] = useState(false)

  // Auth step (login/signup toggle)
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  // Load saved credentials on component mount
  useEffect(() => {
    const savedCredentials = localStorage.getItem("db-lpa-admin-remember-me")
    if (savedCredentials) {
      try {
        const { email: savedEmail, password: savedPassword } = JSON.parse(savedCredentials)
        setEmail(savedEmail)
        if (savedPassword) {
          setPassword(savedPassword)
        }
        setRememberMe(true)
      } catch (err) {
        console.error("Failed to load saved credentials:", err)
      }
    }
  }, [])

  // If user is already logged in as admin, redirect to admin dashboard
  useEffect(() => {
    if (user && user.role === 'admin') {
      router.push("/admin")
    }
  }, [user, router])

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeError("")
    setCodeLoading(true)

    const result = await api.admin.verifyCode(adminCode)
    
    if (result.error) {
      setCodeError(result.error)
      setCodeLoading(false)
      return
    }

    if (result.data) {
      setIsCodeVerified(true)
      setStep("auth")
      setCodeLoading(false)
      setAdminCode("")
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await api.auth.login(email, password)
    
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.data) {
      // Check if user is admin
      if (result.data.user.role !== 'admin') {
        setError("This account is not an admin account")
        setLoading(false)
        return
      }

      // Save credentials to localStorage if "Remember Me" is checked
      if (rememberMe) {
        localStorage.setItem(
          "db-lpa-admin-remember-me",
          JSON.stringify({ email, password })
        )
      } else {
        // Clear saved credentials if "Remember Me" is unchecked
        localStorage.removeItem("db-lpa-admin-remember-me")
      }
      
      setUser(result.data.user)
      setProfile(result.data.profile)
      setToken(result.data.token)
      setLoading(false)
      // Redirect to admin dashboard
      router.push("/admin")
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setError(null)
    setLoading(true)

    // Create the account with admin role
    const result = await api.auth.signupAdmin({ email, password })
    
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.data) {
      // Auto-login the new admin user
      setUser({ id: result.data.user_id, email: result.data.email, role: 'admin' })
      setToken(result.data.token)
      setLoading(false)
      router.push("/admin")
    }
  }

  const handleLogout = () => {
    clearAuth()
    setIsCodeVerified(false)
    setStep("code")
    setAdminCode("")
    setEmail("")
    setPassword("")
    setConfirmPassword("")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Heart className="h-10 w-10 text-primary fill-primary" />
          <span className="text-3xl font-bold text-foreground">D8-LPA</span>
        </div>

        {/* Code Verification Step */}
        {!isCodeVerified ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">Admin Access</h2>
              <p className="text-muted-foreground mt-2">
                Enter the admin code to continue
              </p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-6">
              {codeError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {codeError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="admin-code">Admin Code</Label>
                <Input
                  id="admin-code"
                  type="password"
                  placeholder="Enter admin code"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  required
                  className="h-12"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold"
                disabled={codeLoading || !adminCode.trim()}
              >
                {codeLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>
            </form>
          </>
        ) : (
          <>
            {/* Auth Step (Login/Signup) */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                {isSignup ? "Create Admin Account" : "Admin Sign In"}
              </h2>
              <p className="text-muted-foreground mt-2">
                {isSignup ? "Set up your admin account" : "Welcome back, admin"}
              </p>
            </div>

            <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-6">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
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
              </div>

              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
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
                </div>
              )}

              {!isSignup && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isSignup ? "Creating account..." : "Signing in..."}
                  </>
                ) : (
                  isSignup ? "Create Account" : "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup)
                  setError(null)
                  setPassword("")
                  setConfirmPassword("")
                }}
                className="w-full text-center text-muted-foreground"
              >
                {isSignup ? (
                  <>
                    Already have an account?{" "}
                    <span className="text-primary font-medium hover:underline">Sign in</span>
                  </>
                ) : (
                  <>
                    {"Don't have an account? "}
                    <span className="text-primary font-medium hover:underline">Create one</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Use different code</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
