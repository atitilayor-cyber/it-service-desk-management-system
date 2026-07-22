import { createServerFn } from "@tanstack/react-start";

// Idempotently seeds three demo users and sample tickets so the app can be
// demonstrated immediately. Safe to call repeatedly — it no-ops after the
// first successful run.
export const seedDemoData = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const demoUsers = [
    { email: "admin@servicedesk.demo", password: "Admin@123", full_name: "Rukayat", department: "IT Administration", role: "admin" as const },
    { email: "technician@servicedesk.demo", password: "Tech@123", full_name: "Priya Sharma", department: "IT Support", role: "technician" as const },
    { email: "user@servicedesk.demo", password: "User@123", full_name: "Jamie Rivera", department: "Computer Science", role: "end_user" as const },
    { email: "admin@demo.com", password: "Demo1234!", full_name: "Admin- Rukayat", department: "IT Administration", role: "admin" as const },
    { email: "rukayat@demo.com", password: "Rukayat1234!", full_name: "Rukayat", department: "IT Administration", role: "admin" as const },
    { email: "tech@demo.com", password: "Demo1234!", full_name: "Priya Sharma", department: "IT Support", role: "technician" as const },
    { email: "tech2@demo.com", password: "Demo1234!", full_name: "David Chen", department: "IT Support", role: "technician" as const },
    { email: "user@demo.com", password: "Demo1234!", full_name: "Jamie Rivera", department: "Computer Science", role: "end_user" as const },
    { email: "user2@demo.com", password: "Demo1234!", full_name: "Sarah Ahmed", department: "Business School", role: "end_user" as const },
  ];

  const ids: Record<string, string> = {};

  // Check if admin already exists → treat as already seeded
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existingByEmail = new Map(existing?.users.map((u) => [u.email ?? "", u.id]) ?? []);

  for (const u of demoUsers) {
    let userId = existingByEmail.get(u.email);
    if (!userId) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, department: u.department },
      });
      if (error) throw new Error(`Failed creating ${u.email}: ${error.message}`);
      userId = data.user!.id;
    }
    ids[u.email] = userId!;

    // Ensure profile
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId!, email: u.email, full_name: u.full_name, department: u.department });

    // Ensure role (delete default end_user role if we're setting something else)
    if (u.role !== "end_user") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId!).eq("role", "end_user");
    }
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId!, role: u.role }, { onConflict: "user_id,role" });
  }

  // Seed tickets only if none exist
  const { count } = await supabaseAdmin.from("tickets").select("*", { count: "exact", head: true });
  if ((count ?? 0) === 0) {
    const enduser = ids["user@demo.com"];
    const enduser2 = ids["user2@demo.com"];
    const tech = ids["tech@demo.com"];
    const tech2 = ids["tech2@demo.com"];

    const now = Date.now();
    const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();

    const sample = [
      { title: "Laptop won't power on after Windows update", description: "My university-issued Dell laptop shuts down mid-boot after last night's Windows update. LED blinks 3 times.", category: "Hardware", priority: "High", status: "In Progress", created_by: enduser, assigned_to: tech, created_at: daysAgo(2) },
      { title: "Cannot access student portal", description: "Getting a 403 error whenever I try to log into the student portal from campus WiFi.", category: "Account", priority: "Medium", status: "Assigned", created_by: enduser, assigned_to: tech2, created_at: daysAgo(1) },
      { title: "Office 365 license expired", description: "Word and Excel are asking me to reactivate my license.", category: "Software", priority: "Medium", status: "Resolved", created_by: enduser2, assigned_to: tech, resolution: "Refreshed license from admin portal. Signed out and back in.", created_at: daysAgo(5) },
      { title: "Slow WiFi in Library 3rd floor", description: "Speeds drop to under 1 Mbps every afternoon around the reading rooms.", category: "Network", priority: "Low", status: "Open", created_by: enduser2, created_at: daysAgo(0) },
      { title: "Printer offline in lab B204", description: "The Xerox printer in the CS lab is showing offline for all users.", category: "Hardware", priority: "High", status: "Assigned", created_by: enduser, assigned_to: tech, created_at: daysAgo(1) },
      { title: "Email attachments won't download", description: "Outlook web keeps failing to download PDF attachments larger than 5MB.", category: "Software", priority: "Medium", status: "In Progress", created_by: enduser2, assigned_to: tech2, created_at: daysAgo(3) },
      { title: "VPN disconnects every 10 minutes", description: "GlobalProtect drops my session every ~10 min. Reconnecting manually is disruptive.", category: "Network", priority: "High", status: "Resolved", created_by: enduser, assigned_to: tech2, resolution: "Updated GlobalProtect client to 6.2.4 and adjusted keepalive.", created_at: daysAgo(7) },
      { title: "Forgot my student email password", description: "Password reset link is not arriving in my recovery email.", category: "Account", priority: "Medium", status: "Resolved", created_by: enduser2, assigned_to: tech, resolution: "Verified identity, manually reset password.", created_at: daysAgo(9) },
      { title: "Screen flickering on lecture room projector", description: "Projector in Room 302 flickers whenever HDMI is connected to a MacBook.", category: "Hardware", priority: "Low", status: "Open", created_by: enduser, created_at: daysAgo(0) },
      { title: "MATLAB license server unreachable", description: "MATLAB won't start — 'License Manager Error -96'.", category: "Software", priority: "Critical", status: "In Progress", created_by: enduser2, assigned_to: tech, created_at: daysAgo(1) },
      { title: "Two-factor authentication code not received", description: "Never receive the SMS 2FA code. Been locked out for 2 hours.", category: "Account", priority: "Critical", status: "Assigned", created_by: enduser, assigned_to: tech2, created_at: daysAgo(0) },
      { title: "Docking station USB ports dead", description: "No USB ports on my HP dock respond after firmware update.", category: "Hardware", priority: "Medium", status: "Resolved", created_by: enduser2, assigned_to: tech, resolution: "Rolled back dock firmware to previous version.", created_at: daysAgo(12) },
      { title: "Zoom audio cutting out in meetings", description: "Zoom audio drops for 3-5 seconds every couple of minutes.", category: "Software", priority: "Medium", status: "Open", created_by: enduser, created_at: daysAgo(0) },
      { title: "Cannot connect to eduroam", description: "eduroam authentication keeps failing on my Android phone.", category: "Network", priority: "Low", status: "Resolved", created_by: enduser2, assigned_to: tech2, resolution: "Reinstalled eduroam profile via geteduroam.", created_at: daysAgo(15) },
      { title: "Request new software: Adobe Illustrator", description: "Need Illustrator installed on my lab workstation for a design course.", category: "Software", priority: "Low", status: "Assigned", created_by: enduser, assigned_to: tech, created_at: daysAgo(2) },
    ];

    for (const s of sample) {
      await supabaseAdmin.from("tickets").insert(s as never);
    }
  }

  return { ok: true, seeded: (count ?? 0) === 0 };
});
