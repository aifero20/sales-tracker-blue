import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cigarette, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: role === "admin" ? "/admin" : "/sales" });
    }
  }, [loading, session, role, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Retry otomatis hingga 3x saat sinyal lemah
    let lastError: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) {
        toast.info(`Sinyal lemah, mencoba ulang... (${attempt}/3)`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
      const { error } = await signIn(email.trim(), password);
      if (!error) {
        setSubmitting(false);
        toast.success("Berhasil masuk");
        return;
      }
      lastError = error;
      // Jika bukan masalah jaringan, langsung berhenti retry
      if (!error.toLowerCase().includes("fetch") &&
          !error.toLowerCase().includes("network") &&
          !error.toLowerCase().includes("failed")) {
        break;
      }
    }

    setSubmitting(false);
    toast.error("Login gagal", { description: lastError ?? "Periksa koneksi internet Anda" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-card border-border/60">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Cigarette className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">Binowo Perkasa</CardTitle>
            <CardDescription>Masuk untuk mulai input penjualan</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk"}
            </Button>
          </form>
          <p className="mt-6 text-xs text-center text-muted-foreground">
            Belum punya akun? Hubungi admin Anda.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
