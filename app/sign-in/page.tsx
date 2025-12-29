"use client";
import Link from "next/link";
import { useState } from "react";
import { Sparkles, Mail, Lock, LogIn, Shield, CheckCircle2 } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      alert("This is a demo sign-in UI. Wire it to your auth provider.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 lg:p-10">
      <div className="w-full max-w-4xl">
        <div className="card-elevated overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Hero panel */}
            <div className="hidden md:flex flex-col gap-4 p-8 bg-gradient-to-br from-primary/10 to-transparent border-r border-border/50">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                <Sparkles className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-display">Welcome back</h2>
                <p className="text-sm text-muted-foreground">Sign in to continue creating stunning visuals.</p>
              </div>
              <div className="mt-2 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Unified workspace</p>
                    <p className="text-xs text-muted-foreground">Access projects, products and templates in one place.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Fast AI generation</p>
                    <p className="text-xs text-muted-foreground">Generate multiple images with a single prompt.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form panel */}
            <div className="p-6 lg:p-8">
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-display">Sign in</h3>
                  <p className="text-sm text-muted-foreground">Use your email and password or continue with Google.</p>
                </div>

                <div className="form-control w-full">
                  <label className="label"><span className="label-text text-foreground">Email</span></label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input input-bordered w-full pl-10"
                    />
                  </div>
                </div>

                <div className="form-control w-full">
                  <label className="label"><span className="label-text text-foreground">Password</span></label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input input-bordered w-full pl-10"
                    />
                  </div>
                  <div className="text-right mt-2">
                    <Link href="#" className="text-sm text-primary hover:underline">Forgot password?</Link>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" />
                  {loading ? "Signing in..." : "Sign In"}
                </button>

                <div className="divider text-xs">OR</div>

                <button type="button" className="btn btn-outline w-full">
                  <Shield className="w-4 h-4" />
                  Continue with Google
                </button>

                <div className="text-sm text-muted-foreground text-center">
                  Don't have an account? <Link href="#" className="text-primary hover:underline">Create one</Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
