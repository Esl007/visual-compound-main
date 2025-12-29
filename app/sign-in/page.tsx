"use client";
import Link from "next/link";
import { useState } from "react";
import { Sparkles, Mail, Lock, LogIn, Shield } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Hook up your auth here
      await new Promise((r) => setTimeout(r, 800));
      alert("This is a demo sign-in UI. Wire it to your auth provider.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="card-elevated overflow-hidden">
          <div className="p-6 lg:p-8 flex items-center gap-3 border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-display">Sign in</h2>
              <p className="text-sm text-muted-foreground">Welcome back. Access your dashboard.</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="p-6 lg:p-8 space-y-5">
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

            <div className="flex flex-col sm:flex-row gap-3">
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                <LogIn className="w-4 h-4" />
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <button type="button" className="btn btn-outline w-full">
                <Shield className="w-4 h-4" />
                Continue with Google
              </button>
            </div>

            <div className="text-sm text-muted-foreground">
              Don't have an account? <Link href="#" className="text-primary hover:underline">Create one</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
