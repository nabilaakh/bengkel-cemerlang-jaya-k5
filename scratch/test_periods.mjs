// Test all 4 periods for Owner
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function testPeriods() {
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

  await supabase.auth.signInWithPassword({
    email: "owner@cemerlangjaya.test",
    password: "Bengkel123!",
  });

  const cookieHeader = Array.from(cookiesMap.entries())
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("; ");

  const periods = ["hari_ini", "7_hari", "30_hari", "bulan_ini"];
  for (const p of periods) {
    const res = await fetch(`http://localhost:3000/dashboard?periode=${p}`, {
      headers: { cookie: cookieHeader },
    });
    console.log(`Period '${p}' response status:`, res.status);
    if (res.status !== 200) {
      console.error(`Failed on period ${p}`);
      process.exit(1);
    }
  }
  console.log("✓ All 4 periods successfully returned HTTP 200 for Owner!");
}

testPeriods().catch(console.error);
