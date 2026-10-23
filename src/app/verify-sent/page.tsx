import Link from "next/link";
import { Mail } from "lucide-react";
import { PillButton } from "@/components/pill-button";

export default function VerifySentPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center max-w-md px-6">
        <Mail className="size-16 mx-auto mb-6 text-pan2" />
        <h1 className="text-3xl font-bold tracking-tight mb-4">CHECK YOUR INBOX</h1>
        <p className="text-zinc-400 mb-8 leading-relaxed">
          We sent a verification link to your email. Click it to activate your account.
        </p>
        <p className="text-zinc-500 text-sm mb-8">
          The link expires in 72 hours. If you don't see it, check your spam folder.
        </p>
        <Link href="/signin">
          <PillButton variant="soft" size="lg" className="w-full">
            Go to Sign In
          </PillButton>
        </Link>
      </div>
    </div>
  );
}