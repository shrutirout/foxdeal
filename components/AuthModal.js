"use client";

import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const DEMO_EMAIL = "demo@foxdeal.app";
const DEMO_PASSWORD = "foxdeal123";

export default function AuthModal({ isOpen, onClose }) {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("signin");

  const handleGoogleLogin = async () => {
    if (!signInLoaded) return;
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err) {
      console.error("OAuth error:", err);
      toast.error("Google sign-in failed. Please use email/password.");
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!signUpLoaded) return;

        const result = await signUp.create({
          emailAddress: email,
          password,
        });

        if (result.status === "complete") {
          await setSignUpActive({ session: result.createdSessionId });
          toast.success("Account created! Welcome to FoxDeal.");
          onClose();
          router.refresh();
        } else {
          // email verification required
          await signUp.prepareEmailAddressVerification({ strategy: "email_link", redirectUrl: "/" });
          toast.success("Check your email and click the verification link to activate your account.");
          onClose();
        }
      } else {
        if (!signInLoaded) return;

        const result = await signIn.create({
          identifier: email,
          password,
        });

        if (result.status === "complete") {
          await setSignInActive({ session: result.createdSessionId });
          toast.success("Signed in successfully!");
          onClose();
          router.refresh();
        } else {
          toast.error("Sign-in incomplete. Please try again.");
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      const msg = error.errors?.[0]?.longMessage || error.errors?.[0]?.message || error.message;

      if (msg?.includes("password") || msg?.includes("credentials")) {
        toast.error("Invalid email or password. Please check your credentials and try again.");
      } else if (msg?.includes("verified") || msg?.includes("verification")) {
        toast.error("Please check your email and click the verification link to activate your account.");
      } else if (msg?.includes("already")) {
        toast.error("This email is already registered. Please sign in instead.");
        setMode("signin");
      } else {
        toast.error(msg || "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "signin" ? "Sign in" : "Create account"}</DialogTitle>
          <DialogDescription>
            Track product prices and get alerts on price drops
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">

          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
            <p className="font-semibold text-orange-800 mb-1.5">Demo account</p>
            <div className="flex items-center justify-between gap-3">
              <div className="text-gray-700 space-y-0.5">
                <p><span className="text-gray-500">Email:</span> {DEMO_EMAIL}</p>
                <p><span className="text-gray-500">Password:</span> {DEMO_PASSWORD}</p>
              </div>
              <button
                type="button"
                onClick={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); }}
                className="shrink-0 text-xs font-medium text-orange-700 border border-orange-300 rounded px-2.5 py-1 hover:bg-orange-100 transition-colors"
              >
                Use this
              </button>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-11"
            />
            <Input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
              className="h-11"
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
              size="lg"
            >
              {loading ? "Loading..." : mode === "signin" ? "Sign In" : "Sign Up"}
            </Button>
          </form>

          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full gap-2"
            size="lg"
            type="button"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </Button>

          <p className="text-xs text-gray-500 text-center mt-2">
            Note: Google sign-in requires configuration in the Clerk dashboard
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
