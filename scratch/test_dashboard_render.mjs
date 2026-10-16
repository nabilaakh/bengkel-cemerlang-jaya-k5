// Script to test server-side rendering of /dashboard for each test user
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function testUser(email, pass, peranExpected) {
  console.log(`\n=== Testing Login & Dashboard for ${email} (${peranExpected}) ===`);
  const cookiesMap = new Map();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return Array.from(cookiesMap.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => cookiesMap.set(name, value));
      },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (authError || !authData.session) {
    console.error(`Sign in error for ${email}:`, authError?.message);
    return;
  }

  console.log(`✓ Sign in successful for ${email}, user ID:`, authData.user.id);

  // Test dashboard_ringkasan RPC
  const { data: ringkasan, error: rpcError } = await supabase.rpc("dashboard_ringkasan", {
    p_dari: "2026-10-01",
    p_sampai: "2026-10-31",
  });

  if (rpcError) {
    console.error(`Error RPC dashboard_ringkasan:`, rpcError.message);
  } else {
    console.log(`✓ RPC dashboard_ringkasan returned:`, ringkasan);
  }

  // Test dashboard_wo_per_status RPC
  const { data: woStatus, error: woStatusError } = await supabase.rpc("dashboard_wo_per_status");
  if (woStatusError) {
    console.error(`Error RPC dashboard_wo_per_status:`, woStatusError.message);
  } else {
    console.log(`✓ RPC dashboard_wo_per_status returned:`, woStatus);
  }

  // Send request to localhost:3000/dashboard with cookies
  const cookieHeader = Array.from(cookiesMap.entries())
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("; ");

  try {
    const res = await fetch("http://localhost:3000/dashboard?periode=bulan_ini", {
      headers: {
        cookie: cookieHeader,
      },
      redirect: "manual",
    });

    console.log(`✓ HTTP GET /dashboard Status:`, res.status);
    const html = await res.text();
    if (res.status === 200) {
      if (peranExpected === "owner" && html.includes("Dashboard Owner")) {
        console.log("✓ Correctly rendered 'Dashboard Owner'!");
      } else if (peranExpected === "admin" && html.includes("Dashboard Meja Depan")) {
        console.log("✓ Correctly rendered 'Dashboard Meja Depan'!");
      } else if (peranExpected === "kepala_mekanik" && html.includes("Dashboard Tim Mekanik")) {
        console.log("✓ Correctly rendered 'Dashboard Tim Mekanik'!");
      } else {
        console.log("Response preview (first 300 chars):", html.slice(0, 300));
      }
    } else if (res.status === 307 || res.status === 302) {
      console.log(`Redirect location:`, res.headers.get("location"));
    }
  } catch (err) {
    console.error(`Fetch error:`, err);
  }
}

async function main() {
  await testUser("owner@cemerlangjaya.test", "Bengkel123!", "owner");
  await testUser("admin@cemerlangjaya.test", "Bengkel123!", "admin");
  await testUser("joko@cemerlangjaya.test", "Bengkel123!", "kepala_mekanik");
}

main().catch(console.error);
