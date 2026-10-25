import { redirect } from "next/navigation";
import { LoginForm } from "../../components/login-form";
import { BrandMark } from "../../components/icon";
import { createSupabaseClient } from "../../lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  const client = await createSupabaseClient();
  const { data } = await client.auth.getUser();
  if (data.user) redirect("/");
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="wordmark">
          <BrandMark />
          fathom
        </div>
        <span className="eyebrow">YOUR NEXT CHAPTER</span>
        <h1>
          A clearer picture.
          <br />
          <em>Starts with you.</em>
        </h1>
        <p>Sign in with your email to create or access your brand workspace.</p>
        <LoginForm />
        <small>No password to remember. A code is sent to your email.</small>
      </div>
    </main>
  );
}
