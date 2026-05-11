import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, session, role } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!session) return <Navigate to="/login" />;
  if (role === "admin") return <Navigate to="/admin" />;
  return <Navigate to="/sales" />;
}
