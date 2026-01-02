"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, ChevronDown, Film, User, Package, Sparkles, Users, Zap } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  // If user is already logged in, redirect to app
  useEffect(() => {
    if (session && !isPending) {
      router.push("/app");
    }
  }, [session, isPending, router]);

  // Show loading state while checking session
  if (isPending) {
    return null;
  }

  // If user is logged in, don't render the landing page (redirect will happen)
  if (session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E0F7FA] to-white">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00CED1] text-white">
              <Film className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold text-[#00CED1]">Reelism</span>
          </div>
          
          <div className="hidden items-center gap-8 md:flex">
            <div className="flex items-center gap-1 text-[#202020] hover:text-[#00CED1] cursor-pointer">
              <span>Resources</span>
              <ChevronDown className="h-4 w-4" />
            </div>
            <Link href="#features" className="text-[#202020] hover:text-[#00CED1] transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-[#202020] hover:text-[#00CED1] transition-colors">
              Pricing
            </Link>
          </div>

          <Link
            href="/sign-in"
            className="flex items-center gap-2 rounded-lg bg-[#00CED1] px-6 py-2.5 text-white font-medium transition-all hover:bg-[#00B8BB] shadow-sm"
          >
            Log in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-20">
        <div className="flex flex-col items-center text-center gap-6 max-w-4xl mx-auto mb-20">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight text-[#202020]">
            AI-powered content that actually delivers.
          </h1>
          <p className="text-xl md:text-2xl text-[#202020]/70 max-w-2xl">
            A creative platform that helps brands grow with animated avatars and engaging video content.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
            <Link
              href="/sign-in"
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#00CED1] to-[#00B8BB] px-8 py-4 text-white font-medium transition-all hover:shadow-lg hover:scale-105"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-16">
          {/* Card 1: Generate Content */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#00CED1]/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00CED1]/5 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[#00CED1]/10">
                  <Sparkles className="h-6 w-6 text-[#00CED1]" />
                </div>
                <h3 className="text-xl font-semibold text-[#202020]">Generate Content</h3>
              </div>
              
              <div className="space-y-3 mt-6">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#00CED1]/5 border border-[#00CED1]/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[#00CED1]"></div>
                    <span className="text-sm font-medium text-[#202020]">Avatars</span>
                  </div>
                  <span className="ml-auto text-sm font-semibold text-[#00CED1]">AI-Powered</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#00CED1]/5 border border-[#00CED1]/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[#00CED1]"></div>
                    <span className="text-sm font-medium text-[#202020]">Animations</span>
                  </div>
                  <span className="ml-auto text-sm font-semibold text-[#00CED1]">Video Ready</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#00CED1]/5 border border-[#00CED1]/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[#00CED1]"></div>
                    <span className="text-sm font-medium text-[#202020]">Products</span>
                  </div>
                  <span className="ml-auto text-sm font-semibold text-[#00CED1]">Integrated</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Experience */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#00CED1]/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00CED1]/5 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[#00CED1]/10">
                  <Zap className="h-6 w-6 text-[#00CED1]" />
                </div>
                <h3 className="text-xl font-semibold text-[#202020]">Lightning Fast</h3>
              </div>
              <p className="text-[#202020]/60 mb-6">AI-powered generation in seconds.</p>
              <div className="flex items-center justify-end">
                <div className="text-6xl">⚡</div>
              </div>
            </div>
          </div>

          {/* Card 3: Scale */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#00CED1]/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00CED1]/5 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[#00CED1]/10">
                  <Users className="h-6 w-6 text-[#00CED1]" />
                </div>
                <h3 className="text-xl font-semibold text-[#202020]">Scale Your Brand</h3>
              </div>
              <p className="text-[#202020]/60 mb-6">Create unlimited content for your marketing campaigns.</p>
              <div className="flex items-center justify-end">
                <div className="text-6xl">📢</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Background decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-[#00CED1]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-[#00CED1]/5 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
}
