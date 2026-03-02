"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import AuthModal from "./AuthModal";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut } from "lucide-react";

export default function AuthButton() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (!isLoaded) return null;

  if (user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => signOut(() => router.refresh())}
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={() => setShowAuthModal(true)}
        variant="default"
        size="sm"
        className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 gap-2 shadow-md"
      >
        <LogIn className="w-4 h-4" />
        Sign In
      </Button>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
