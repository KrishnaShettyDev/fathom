import { redirect } from "next/navigation";
import { getSupabaseConfig } from "../../lib/supabase/config";
import { BrandMark } from "../../components/icon";
export const dynamic = "force-dynamic";
export default function SetupPage() {
  if (getSupabaseConfig()) redirect("/login");
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="wordmark">
          <BrandMark />
          fathom
        </div>
        <span className="eyebrow">SETUP REQUIRED</span>
        <h1>
          A real foundation.
          <br />
          <em>Before the numbers.</em>
        </h1>
        <p>
          Fathom’s database and sign-in service haven’t been configured for this
          environment.
        </p>
        <div className="notice">
          Configure the Supabase project and apply the identity migration to
          enable sign-in. No sample workspace or fabricated metrics will be
          shown.
        </div>
        <p>
          Configuration instructions are in{" "}
          <code>docs/engineering/local-development.md</code>.
        </p>
      </div>
    </main>
  );
}
