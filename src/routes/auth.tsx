import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { seedDemoData } from "@/lib/seed.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones, ShieldCheck, BarChart3, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — IT Service Desk Management System" },
      { name: "description", content: "Sign in to the IT Service Desk Management System." },
    ],
  }),
  component: AuthPage,
});

const DEMO_ACCOUNTS = [
  { label: "Rukayat (Admin)", email: "rukayat@demo.com", desc: "Your admin account · password: Rukayat1234!" },
  { label: "Administrator", email: "admin@demo.com", desc: "Full access — manage tickets, users & reports" },
  { label: "IT Technician", email: "tech@demo.com", desc: "See assigned tickets and update status" },
  { label: "End User", email: "user@demo.com", desc: "Submit and track your support tickets" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(true);

  // Seed demo data on first mount (idempotent)
  useEffect(() => {
    seedDemoData()
      .catch((e) => console.error("seed failed", e))
      .finally(() => setSeeding(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, department },
          },
        });
        if (error) throw error;
        toast.success("Account created — you're signed in");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(demoEmail === "rukayat@demo.com" ? "Rukayat1234!" : "Demo1234!");
    setMode("signin");
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-12 text-white">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,#818cf8_0,transparent_40%),radial-gradient(circle_at_80%_60%,#a78bfa_0,transparent_45%)]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">HelpDesk Pro</div>
            <div className="text-xs uppercase tracking-widest text-indigo-200/80">IT Service Desk</div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold leading-tight">
            Modern IT support,<br />built for your campus.
          </h2>
          <p className="text-indigo-100/80 max-w-md text-base">
            Submit issues, route work to the right technician, and track resolution — all in one dashboard.
          </p>
          <div className="grid gap-4 pt-4">
            <Feature icon={<ShieldCheck className="h-4 w-4" />} title="Role-based access" desc="End users, technicians, and administrators — each with the right view." />
            <Feature icon={<BarChart3 className="h-4 w-4" />} title="Live analytics" desc="Real-time charts on ticket volume, priority, and technician workload." />
            <Feature icon={<Zap className="h-4 w-4" />} title="Fast triage" desc="Unique ticket numbers, status timeline, and instant assignment." />
          </div>
        </div>

        <div className="relative z-10 text-xs text-indigo-200/60">
          © 2026 HelpDesk Pro · Final Year Academic Project
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:text-left space-y-2">
            <div className="lg:hidden flex justify-center">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                <Headphones className="h-5 w-5" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to submit or manage IT support tickets.
            </p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <FormFields email={email} setEmail={setEmail} password={password} setPassword={setPassword} />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dept">Department</Label>
                  <Input id="dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Computer Science" />
                </div>
                <FormFields email={email} setEmail={setEmail} password={password} setPassword={setPassword} />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <Card className="p-4 space-y-3 bg-muted/30 border-dashed">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Demo accounts
              </div>
              {seeding && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="grid gap-2">
              {DEMO_ACCOUNTS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => fillDemo(d.email)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <div className="font-medium">{d.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{d.email} · {d.desc}</div>
                </button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Password for all demo accounts: <span className="font-mono">Demo1234!</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FormFields({
  email,
  setEmail,
  password,
  setPassword,
}: {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      </div>
    </>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/10 ring-1 ring-white/20">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-indigo-100/70">{desc}</div>
      </div>
    </div>
  );
}
