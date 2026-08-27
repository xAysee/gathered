import { supabase } from "./supabase.js";
import { SAMPLE_RECIPES } from "./sampleRecipes.js";

const API_BASE = "https://myrecipecards-api.vercel.app";

// ─── Request OTP -- all generation/hashing/sending happens server-side ─────────
async function sbRequestCode(email, name, mode) {
  const resp = await fetch(API_BASE + "/api/send-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, mode }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Failed to send code.");
}

// ─── Verify OTP -- comparison happens server-side against stored hash ──────────
async function sbVerifyCode(email, code) {
  const resp = await fetch(API_BASE + "/api/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Verification failed.");
  // Server returns session tokens directly over HTTPS -- no URL fragment, no redirect
  // Set the session in the Supabase client directly so onAuthStateChange fires SIGNED_IN
  const { error: sessionErr } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionErr) throw new Error("Session setup failed. Please try again.");
  return data.user;
}

async function sbSignOut() {
  await supabase.auth.signOut();
}
// Ensure a row exists in our `users` table (id matches auth.uid())
async function sbEnsureUserRow(authUser) {
  const name = (authUser.user_metadata && authUser.user_metadata.name) || authUser.email.split("@")[0];
  const { data: existing, error: selectErr } = await supabase.from("users").select("*").eq("id", authUser.id).maybeSingle();
  if (selectErr) { console.error("sbEnsureUserRow select error:", selectErr); throw selectErr; }
  if (!existing) {
    const { error: insertErr } = await supabase.from("users").insert({ id: authUser.id, email: authUser.email, name });
    if (insertErr) { console.error("sbEnsureUserRow insert error:", insertErr); throw insertErr; }
    // Seed sample recipes for new users -- surface any failures instead of swallowing them
    for (const r of SAMPLE_RECIPES) {
      const { error: seedErr } = await supabase.from("recipes").insert({
        user_id: authUser.id, title: r.title, description: r.description,
        prep_time: r.prepTime, cook_time: r.cookTime, servings: r.servings,
        tags: r.tags, notes: r.notes||"", image: r.image||null,
        ingredients: r.ingredients, steps: r.steps,
      });
      if (seedErr) console.error("Seed recipe failed:", r.title, seedErr);
    }
    return { id: authUser.id, email: authUser.email, name };
  }
  return existing;
}

// ─── Recipes ──────────────────────────────────────────────────────────────────
function dbRowToRecipe(row) {
  return {
    id: row.id, title: row.title, description: row.description||"",
    prepTime: row.prep_time||"", cookTime: row.cook_time||"", servings: row.servings||4,
    tags: row.tags||[], notes: row.notes||"", image: row.image||null,
    ingredients: row.ingredients||[], steps: row.steps||[],
    folders: row.folders||[],
    createdAt: new Date(row.created_at),
  };
}
async function sbLoadRecipes(userId) {
  const { data, error } = await supabase.from("recipes").select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500); // reasonable upper bound; revisit if users hit this
  if (error) { console.error(error); return []; }
  return (data || []).map(dbRowToRecipe);
}
async function sbLoadTrash(userId) {
  const { data, error } = await supabase.from("recipes").select("*")
    .eq("user_id", userId).not("deleted_at", "is", null).order("deleted_at", { ascending:false });
  if (error) { console.error(error); return []; }
  return (data||[]).map(r => ({...dbRowToRecipe(r), deletedAt: new Date(r.deleted_at)}));
}
async function sbInsertRecipe(userId, r) {
  const { data, error } = await supabase.from("recipes").insert({
    user_id: userId, title: r.title, description: r.description||"",
    prep_time: r.prepTime||"", cook_time: r.cookTime||"", servings: r.servings||4,
    tags: r.tags||[], notes: r.notes||"", image: r.image||null,
    ingredients: r.ingredients||[], steps: r.steps||[], folders: r.folders||[],
  }).select().single();
  if (error) { console.error("sbInsertRecipe error:", error); throw error; }
  return dbRowToRecipe(data);
}
async function sbUpdateRecipe(r) {
  const { error } = await supabase.from("recipes").update({
    title: r.title, description: r.description||"", prep_time: r.prepTime||"",
    cook_time: r.cookTime||"", servings: r.servings||4, tags: r.tags||[],
    notes: r.notes||"", image: r.image||null, ingredients: r.ingredients||[], steps: r.steps||[],
    folders: r.folders||[],
  }).eq("id", r.id);
  if (error) console.error(error);
}
async function sbToggleRecipeFolder(recipeId, currentFolders, folderName) {
  const next = currentFolders.includes(folderName)
    ? currentFolders.filter(f => f !== folderName)
    : [...currentFolders, folderName];
  const { error } = await supabase.from("recipes").update({ folders: next }).eq("id", recipeId);
  if (error) console.error("sbToggleRecipeFolder error:", error);
  return next;
}

async function sbSoftDeleteRecipe(id) {
  const { error } = await supabase.from("recipes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) console.error(error);
}
async function sbRestoreRecipe(id) {
  const { error } = await supabase.from("recipes").update({ deleted_at: null }).eq("id", id);
  if (error) console.error(error);
}

// ─── Meal plan ────────────────────────────────────────────────────────────────
// Reconstructs the in-memory shape { [dateKey]: [{recipeId, servings, _entryId}] } from rows
async function sbLoadMealPlan(userId) {
  const { data, error } = await supabase.from("meal_plan_entries").select("*").eq("user_id", userId);
  if (error) { console.error(error); return {}; }
  const plan = {};
  (data||[]).forEach(row => {
    if (!plan[row.date_key]) plan[row.date_key] = [];
    plan[row.date_key].push({ recipeId: row.recipe_id, servings: row.servings, _entryId: row.id });
  });
  return plan;
}
async function sbAddMealEntry(userId, dateKey, recipeId, servings) {
  const { data, error } = await supabase.from("meal_plan_entries").insert({
    user_id: userId, date_key: dateKey, recipe_id: recipeId, servings,
  }).select().single();
  if (error) { console.error(error); return null; }
  return data.id;
}
async function sbUpdateMealEntry(entryId, servings) {
  const { error } = await supabase.from("meal_plan_entries").update({ servings }).eq("id", entryId);
  if (error) console.error(error);
}
async function sbDeleteMealEntry(entryId) {
  const { error } = await supabase.from("meal_plan_entries").delete().eq("id", entryId);
  if (error) console.error(error);
}

// ─── Settings ─────────────────────────────────────────────────────────────────
async function sbLoadSettings(userId) {
  const { data, error } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return { weight:data.weight, volume:data.volume, temp:data.temp, weekStart:data.week_start, dark:data.dark, folders:data.folders||[] };
}
async function sbSaveSettings(userId, s) {
  const { error } = await supabase.from("user_settings").upsert({
    user_id: userId, weight:s.weight, volume:s.volume, temp:s.temp, week_start:s.weekStart, dark:s.dark,
    folders: s.folders||[],
  });
  if (error) console.error(error);
}

// ─── Shared recipe inbox ──────────────────────────────────────────────────────
async function sbLoadInbox(email) {
  const { data, error } = await supabase.from("shared_recipes").select("*")
    .eq("recipient_email", email).order("sent_at", { ascending:false });
  if (error) { console.error(error); return []; }
  return (data||[]).map(row => ({
    id: row.id, recipe: row.recipe, fromName: row.from_name, fromEmail: row.from_email, sentAt: row.sent_at,
  }));
}
async function sbShareRecipe(recipientEmail, recipe, fromName, fromEmail) {
  const { error } = await supabase.from("shared_recipes").insert({
    recipient_email: recipientEmail, recipe, from_name: fromName, from_email: fromEmail,
  });
  if (error) throw error;
}
async function sbDismissInboxItem(id) {
  const { error } = await supabase.from("shared_recipes").delete().eq("id", id);
  if (error) console.error(error);
}
async function sbCheckUserExists(email) {
  // Users table is locked to authenticated reads only via RLS
  // Route through the API which uses the service role key
  try {
    const resp = await fetch(API_BASE + "/api/check-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await resp.json();
    return !!data.exists;
  } catch(e) {
    console.error("sbCheckUserExists error:", e);
    return false;
  }
}


export {
  API_BASE,
  sbRequestCode, sbVerifyCode, sbSignOut,
  sbEnsureUserRow, dbRowToRecipe,
  sbLoadRecipes, sbLoadTrash, sbInsertRecipe, sbUpdateRecipe,
  sbToggleRecipeFolder, sbSoftDeleteRecipe, sbRestoreRecipe,
  sbLoadMealPlan, sbAddMealEntry, sbUpdateMealEntry, sbDeleteMealEntry,
  sbLoadSettings, sbSaveSettings,
  sbLoadInbox, sbShareRecipe, sbDismissInboxItem, sbCheckUserExists,
};
