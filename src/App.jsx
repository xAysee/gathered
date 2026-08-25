import { useState, useRef, useEffect } from "react";
import { supabase } from "./lib/supabase.js";
import { getTheme, makeCSS, serif, sans } from "./lib/theme.js";
import { useDark } from "./hooks/useDark.js";
import { useWindowWidth } from "./hooks/useWindowWidth.js";
import {
  sbSignOut, sbEnsureUserRow,
  sbLoadRecipes, sbLoadTrash, sbInsertRecipe, sbUpdateRecipe,
  sbToggleRecipeFolder, sbSoftDeleteRecipe, sbRestoreRecipe,
  sbLoadMealPlan, sbAddMealEntry, sbUpdateMealEntry, sbDeleteMealEntry,
  sbLoadSettings, sbSaveSettings,
  sbLoadInbox, sbDismissInboxItem,
  sbVerifyCode,
} from "./lib/auth.js";
import { decodeShareLink } from "./lib/sharing.js";
import { splitIngredients } from "./lib/ingredients.js";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { RecipeCard } from "./components/RecipeCard.jsx";
import { RecipeDetail } from "./components/RecipeDetail.jsx";
import { FolderPanel } from "./components/FolderPanel.jsx";
import { ImportToast } from "./components/ImportToast.jsx";
import { AddModal } from "./components/AddModal.jsx";
import { SettingsModal } from "./components/SettingsModal.jsx";
import { MealPlanPage } from "./components/MealPlanPage.jsx";
import { Dots } from "./components/Dots.jsx";

const DEF_SETTINGS = { weight:"original", volume:"original", temp:"original", weekStart:"sun", dark:"system", folders:[] };

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

function useDark(setting) {
  const [sysDark, setSysDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  useEffect(()=>{
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const h = e => setSysDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  },[]);
  if (setting === "dark") return true;
  if (setting === "light") return false;
  return sysDark;
}

export default function App() {
  // ── Strip auth tokens from URL immediately on mount, before first paint ──────
  // Prevents access_token/refresh_token from lingering in address bar or
  // being captured by analytics, error loggers, or browser history
  if (typeof window !== "undefined" && window.location.hash) {
    const h = window.location.hash;
    if (h.includes("access_token") || h.includes("refresh_token") || h.includes("error_description")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  // user: { id, email, name } once loaded from Supabase, else null
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [trash, setTrash] = useState([]);
  const [mealPlan, setMealPlan] = useState({}); // { [dateKey]: [{recipeId, servings, _entryId}] }
  const [settings, setSettings] = useState(DEF_SETTINGS);


  const dark = useDark(settings.dark);
  const T = getTheme(dark);
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 640;

  const [page, setPage] = useState("recipes");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [importJob, setImportJob] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [folders, setFolders] = useState([]); // array of folder name strings
  const [activeFolder, setActiveFolder] = useState(null); // null = All Recipes
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const dragRecipeId = useRef(null); // for drag-to-folder
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [sharedRecipeToImport, setSharedRecipeToImport] = useState(null); // from URL #share=
  const [showSettings, setShowSettings] = useState(false);

  const searchRef = useRef();
  const importJobRef = useRef(null); // stable ref for callbacks inside async fns
  importJobRef.current = importJob;

  // ─── Bootstrap: detect an existing session on load, and pick up new sign-ins ──
  useEffect(() => {
    let handledInitial = false;
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null); setRecipes([]); setTrash([]); setMealPlan({}); setInbox([]);
        setSettings(DEF_SETTINGS); setPage("recipes");
        setAuthChecked(true);
        return;
      }
      // INITIAL_SESSION fires once on load (with or without a session).
      // SIGNED_IN fires right after sbVerifyCode() completes signUp/signInWithPassword.
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        if ((session && session.user)) {
          try {
            const userRow = await sbEnsureUserRow(session.user);
            await loadAllUserData(userRow);
          } catch(e) {
            console.error("Failed to load user after sign-in:", e);
            // Don't strand the user on a spinner -- show the login screen again
          }
        }
        handledInitial = true;
        setAuthChecked(true);
      }
    });
    // Safety net: if no auth event fires within 4s (e.g. offline), stop showing the loader
    const timeout = setTimeout(() => { if (!handledInitial) setAuthChecked(true); }, 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  async function loadAllUserData(userRow) {
    setUser(userRow);

    const [r, t, mp, s, ib] = await Promise.all([
      sbLoadRecipes(userRow.id),
      sbLoadTrash(userRow.id),
      sbLoadMealPlan(userRow.id),
      sbLoadSettings(userRow.id),
      sbLoadInbox(userRow.email),
    ]);
    setRecipes(r);
    setTrash(t);
    setMealPlan(mp);
    const merged = s ? {...DEF_SETTINGS, ...s} : DEF_SETTINGS;
    setSettings(merged);
    setFolders(merged.folders || []);
    setInbox(ib);

  }

  function login(userRow) {
    loadAllUserData(userRow);
  }
  async function logout() {
    await sbSignOut();
    setUser(null); setRecipes([]); setTrash([]); setMealPlan({}); setInbox([]);
    setSettings(DEF_SETTINGS); setFolders([]); setActiveFolder(null); setPage("recipes");
  }

  async function createFolder(name) {
    const trimmed = name.trim();
    if (!trimmed || folders.includes(trimmed)) return;
    const newFolders = [...folders, trimmed];
    setFolders(newFolders);
    const newSettings = {...settings, folders: newFolders};
    setSettings(newSettings);
    if (user) await sbSaveSettings(user.id, newSettings);
  }

  async function deleteFolder(name) {
    const newFolders = folders.filter(f => f !== name);
    setFolders(newFolders);
    if (activeFolder === name) setActiveFolder(null);
    const newSettings = {...settings, folders: newFolders};
    setSettings(newSettings);
    if (user) await sbSaveSettings(user.id, newSettings);
    // Remove this folder from all recipes that have it
    const affected = recipes.filter(r => (r.folders||[]).includes(name));
    for (const r of affected) {
      const next = (r.folders||[]).filter(f => f !== name);
      await sbToggleRecipeFolder(r.id, [...next, name], name); // remove it
      setRecipes(prev => prev.map(x => x.id === r.id ? {...x, folders: next} : x));
    }
  }

  async function toggleRecipeFolder(recipeId, folderName) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;
    const next = await sbToggleRecipeFolder(recipeId, recipe.folders||[], folderName);
    setRecipes(prev => prev.map(r => r.id === recipeId ? {...r, folders: next} : r));
  }

  // ─── Recipes ──────────────────────────────────────────────────────────────
  async function addRecipe(r) {
    if (!user) return false;
    try {
      const saved = await sbInsertRecipe(user.id, r);
      setRecipes(prev => [saved, ...prev]);
      return true;
    } catch(e) {
      console.error("addRecipe failed:", e);
      return false;
    }
  }
  async function saveRecipe(r) {
    await sbUpdateRecipe(r);
    setRecipes(prev => prev.map(x => x.id === r.id ? r : x));
    setSelected(r);
  }
  async function deleteRecipe(id) {
    const r = recipes.find(x => x.id === id);
    if (!r) return;
    await sbSoftDeleteRecipe(id);
    setRecipes(prev => prev.filter(x => x.id !== id));
    setTrash(prev => [{...r, deletedAt: new Date()}, ...prev]);
  }
  async function restoreRecipe(id) {
    const r = trash.find(x => x.id === id);
    if (!r) return;
    await sbRestoreRecipe(id);
    const { deletedAt, ...rest } = r;
    setTrash(prev => prev.filter(x => x.id !== id));
    setRecipes(prev => [rest, ...prev]);
  }

  // ─── Shared inbox ─────────────────────────────────────────────────────────
  async function acceptInboxRecipe(msgId) {
    const msg = inbox.find(m => m.id === msgId);
    if (!msg || !user) return;
    const saved = await sbInsertRecipe(user.id, {...msg.recipe, sharedBy: msg.fromName});
    if (saved) setRecipes(prev => [saved, ...prev]);
    await sbDismissInboxItem(msgId);
    setInbox(prev => prev.filter(m => m.id !== msgId));
  }
  async function dismissInboxItem(msgId) {
    await sbDismissInboxItem(msgId);
    setInbox(prev => prev.filter(m => m.id !== msgId));
  }

  // ─── Settings ─────────────────────────────────────────────────────────────
  async function updateSettings(s) {
    setSettings(s);
    if (user) await sbSaveSettings(user.id, s);
  }

  // ─── Meal plan sync (keeps the {dateKey: [...]} shape MealPlanPage expects) ─
  async function onMealPlanChange(newPlan) {
    if (!user) return;
    // Diff against current mealPlan to know what to insert/update/delete
    const prevPlan = mealPlan;
    const allDateKeys = new Set([...Object.keys(prevPlan), ...Object.keys(newPlan)]);
    const updatedPlan = {...newPlan};

    for (const dk of allDateKeys) {
      const prevEntries = prevPlan[dk] || [];
      const newEntries = newPlan[dk] || [];

      // Deleted entries: had an _entryId before, no longer present
      for (const pe of prevEntries) {
        const stillThere = newEntries.find(ne => ne._entryId === pe._entryId);
        if (!stillThere && pe._entryId) {
          await sbDeleteMealEntry(pe._entryId);
        }
      }
      // New or updated entries
      for (let i = 0; i < newEntries.length; i++) {
        const ne = newEntries[i];
        if (!ne._entryId) {
          // Brand new entry — insert and capture the id
          const entryId = await sbAddMealEntry(user.id, dk, ne.recipeId, ne.servings);
          updatedPlan[dk] = updatedPlan[dk].map((x,idx) => idx===i ? {...x, _entryId: entryId} : x);
        } else {
          const prevMatch = prevEntries.find(pe => pe._entryId === ne._entryId);
          if (prevMatch && prevMatch.servings !== ne.servings) {
            await sbUpdateMealEntry(ne._entryId, ne.servings);
          }
        }
      }
    }
    setMealPlan(updatedPlan);
  }

  // ─── Recipe import (Groq via myrecipecards-api serverless function) ────────
  async function runImport(action) {
    if (action.type === "reset") { setImportJob(null); return; }
    if (action.type === "save") {
      const job = importJobRef.current;
      if ((job && job.parsed)) {
        setImportJob(j => ({...j, loading:true, error:"", label:"Saving recipe\u2026"}));
        const ok = await addRecipe({...job.parsed, image: job.capturedImage || null});
        if (ok) {
          setImportJob(null); setShowAdd(false);
        } else {
          setImportJob(j => ({...j, loading:false, label:"", error:"Couldn\'t save the recipe. Please try again."}));
        }
      }
      return;
    }
    if (action.type === "error") { setImportJob(prev => ({...prev, loading:false, error:action.error})); return; }

    setShowAdd(true);
    let userContent = null;
    let capturedImage = null;
    let hasImage = false;

    try {
      if (action.type === "url") {
        const text = action.text.trim();
        const isUrl = /^https?:\/\//i.test(text);
        if (isUrl) {
          setImportJob({ loading:true, step:"Fetching", label:"Fetching page\u2026", parsed:null, error:"", capturedImage:null });
          try {
            const resp = await fetch(`https://r.jina.ai/${text}`, {
              headers:{ "Accept":"text/plain" },
              signal: AbortSignal.timeout(14000)
            });
            if (!resp.ok) throw new Error("status "+resp.status);
            const jinaImgHeader = resp.headers.get("x-image-url") || resp.headers.get("X-Image-Url");
            const pageText = (await resp.text()).slice(0, 12000);
            const imgMatch = pageText.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]{10,400})\)/i);
            const imgUrl = jinaImgHeader || (imgMatch ? imgMatch[1] : null);
            if (imgUrl) capturedImage = imgUrl;
            userContent = "Extract the recipe from this page content. Return ONLY the JSON, nothing else.\n\n" + pageText;
          } catch(_) {
            userContent = "Extract the recipe from this URL. You may know this site \u2014 return the recipe as JSON.\n\nURL: " + text;
          }
        } else {
          userContent = "Extract the recipe from this text:\n\n" + text;
        }
      } else if (action.type === "photo") {
        capturedImage = action.imgSrc;
        hasImage = true;
        userContent = [
          { type:"text", text:"Extract the recipe from this photo. Return ONLY the JSON." },
          { type:"image_url", image_url:{ url: action.imgSrc } },
        ];
      } else if (action.type === "parts") {
        capturedImage = action.imgSrc || null;
        const imgBlock = action.parts.find(p => p.type === "image");
        const textBlocks = action.parts.filter(p => p.type === "text" || p.type === "document").map(p => p.text || "(document attached — describe what you can infer)");
        if (imgBlock) {
          hasImage = true;
          userContent = [
            { type:"text", text: textBlocks.join("\n") || "Extract the recipe from this photo. Return ONLY the JSON." },
            { type:"image_url", image_url:{ url: `data:${imgBlock.source.media_type};base64,${imgBlock.source.data}` } },
          ];
        } else {
          userContent = textBlocks.join("\n") || "Extract the recipe.";
        }
      } else if (action.type === "manual") {
        const m = action.manual;
        userContent =
          "Standardize this recipe and return ONLY valid JSON:\n\n" +
          "Title:" + m.title + "\n" +
          "Desc:" + m.description + "\n" +
          "Prep:" + m.prepTime + "\n" +
          "Cook:" + m.cookTime + "\n" +
          "Serves:" + m.servings + "\n" +
          "Tags:" + m.tags + "\n" +
          "Notes:" + m.notes + "\n" +
          "Ingredients:\n" + m.ingredients + "\n" +
          "Steps:\n" + m.steps;
      } else return;

      setImportJob(j=>({...(j||{}), loading:true, step:"Extracting", label:"Sending to Groq\u2026", parsed:null, error:"", capturedImage}));
      // Get current session JWT to authenticate the request
      const { data: { session: extractSession } } = await supabase.auth.getSession();
      const extractToken = extractSession?.access_token;
      if (!extractToken) throw new Error("Not logged in. Please sign in and try again.");
      const res = await fetch("https://myrecipecards-api.vercel.app/api/extract-recipe", {
        method:"POST",
        headers:{"Content-Type":"application/json", "Authorization": `Bearer ${extractToken}`},
        body: JSON.stringify({ userContent, hasImage }),
      });

      setImportJob(j=>({...j, step:"Parsing", label:"Parsing result\u2026"}));
      const d = await res.json();
      if (!res.ok || d.error) {
        throw new Error(d.error || "Extraction failed.");
      }
      // Server returns { recipe: {...} } -- already parsed, no raw Groq response
      const parsed = d.recipe;
      if (!parsed) throw new Error("No recipe data returned.");
      if (!capturedImage && parsed.imageUrl && /^https?:\/\//.test(parsed.imageUrl)) {
        capturedImage = parsed.imageUrl;
      }
      delete parsed.imageUrl;
      parsed.ingredients = splitIngredients(parsed.ingredients||[]);
      const EQUIP2=[{tag:"air-fryer",w:["air fry","air-fry"]},{tag:"oven",w:["oven","bake","roast","broil","preheat"]},{tag:"frying-pan",w:["frying pan","skillet","saute","sauté","sear"]},{tag:"pot",w:["large pot","stockpot","boil"]},{tag:"blender",w:["blender","blend until"]},{tag:"instant-pot",w:["instant pot","pressure cook"]},{tag:"slow-cooker",w:["slow cooker","crockpot"]},{tag:"grill",w:["grill","barbecue"]},{tag:"microwave",w:["microwave"]}];
      const stepsText2=(parsed.steps||[]).join(" ").toLowerCase();
      const equipTags=EQUIP2.filter(e=>e.w.some(w=>stepsText2.includes(w))).map(e=>e.tag);
      parsed.tags=[...new Set([...(parsed.tags||[]),...equipTags])];
      setImportJob(j=>({...j, loading:false, step:"Done", label:"Recipe ready!", parsed, capturedImage: (j && j.capturedImage) || capturedImage}));

    } catch(e) {
      console.error("Import error:", e);
      const isRateLimit = e.message && (e.message.toLowerCase().includes("too quickly") || e.message.toLowerCase().includes("wait"));
      const isUrlFail = !isRateLimit && (action.type === "url");
      const errorMsg = isRateLimit
        ? e.message
        : `Import failed: ${e.message}${isUrlFail ? ". For URLs, try pasting the recipe text directly instead." : ""}`;
      setImportJob(j=>({...(j||{}), loading:false, step:"", label:"", error:errorMsg}));
    }
  }

  // ─── Shared-via-link detection ───────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#share=")) {
      const r = decodeShareLink(hash);
      if (r) setSharedRecipeToImport(r);
      window.history.replaceState(null,"",window.location.pathname);
    }
  }, []);

  const hasSettings = settings.weight!=="original"||settings.volume!=="original"||settings.temp!=="original"||settings.dark!=="system"||settings.weekStart!=="sun";

  function allTags() {
    const c={};
    recipes.forEach(r=>r.tags.forEach(t=>{c[t]=(c[t]||0)+1;}));
    return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([t])=>t);
  }
  function matchRecipe(r) {
    const q=search.toLowerCase();
    const ing=r.ingredients.map(i=>`${i.amount} ${i.name}`).join(" ").toLowerCase();
    const searchOk=!q||r.title.toLowerCase().includes(q)||r.description?.toLowerCase().includes(q)||ing.includes(q)||r.tags.join(" ").toLowerCase().includes(q);
    const filtersOk=filters.every(f=>{const fl=f.toLowerCase();return r.title.toLowerCase().includes(fl)||r.tags.some(t=>t.includes(fl))||ing.includes(fl);});
    return searchOk&&filtersOk;
  }
  const folderFiltered = activeFolder === null ? recipes : recipes.filter(r => (r.folders||[]).includes(activeFolder));
  const filtered = folderFiltered.filter(matchRecipe);
  function addFilter(f) { const c=f.trim().toLowerCase();if(c&&!filters.includes(c))setFilters([...filters,c]); }
  function onSearchKey(e) { if(e.key==="Enter"&&search.trim()){addFilter(search.trim());setSearch("");} }

  const css = makeCSS(T);

  if (!authChecked) {
    return (
      <>
        <style>{css}</style>
        <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Dots/>
        </div>
      </>
    );
  }

  if (!user) return (<><style>{css}</style><AuthScreen T={T} onLogin={login}/></>);

  const uid = user.email; // used as the identity key throughout the UI (sharing, ownership labels, etc.)
  const userName = user.name || user.email;

  return (
    <>
      <style>{css}</style>
      <div style={{minHeight:"100vh",background:T.bg}}>
        {/* Header */}
        <header style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:isMobile?"0 10px":"0 18px",position:"sticky",top:0,zIndex:30}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            {isMobile ? <>
              {/* Mobile top row: logo | + Add | ⚙ */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:48}}>
                <h1 style={{fontFamily:serif,fontSize:17,fontWeight:600}}>
                  <span style={{color:T.muted}}>my</span><span style={{color:T.terra}}>recipe</span><span style={{color:T.sage}}>cards</span>
                </h1>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button className="bp" onClick={()=>setShowAdd(true)} style={{padding:"6px 12px",fontSize:13}}>+ Add</button>
                  <button className="bg" onClick={()=>setShowSettings(true)} style={{position:"relative",padding:"6px 9px",fontSize:14}}>
                    ⚙
                    {hasSettings&&<span style={{width:5,height:5,borderRadius:"50%",background:T.terra,position:"absolute",top:2,right:2}}/>}
                  </button>
                </div>
              </div>
              {/* Mobile bottom row: Recipes | Meal Plan | 🔔? | Log out */}
              <nav style={{display:"flex",borderTop:`1px solid ${T.border}`}}>
                <button className={`nav-btn${page==="recipes"?" active":""}`} onClick={()=>setPage("recipes")} style={{flex:1,textAlign:"center",padding:"7px 0",fontSize:12}}>Recipes</button>
                <button className={`nav-btn${page==="mealplan"?" active":""}`} onClick={()=>setPage("mealplan")} style={{flex:1,textAlign:"center",padding:"7px 0",fontSize:12}}>Meal Plan</button>
                {inbox.length>0&&<button className="bg" onClick={()=>setInboxOpen(o=>!o)} style={{position:"relative",padding:"7px 10px",fontSize:12,border:"none",borderLeft:`1px solid ${T.border}`,borderRadius:0}}>
                  🔔 {inbox.length}
                  <span style={{width:6,height:6,borderRadius:"50%",background:T.terra,position:"absolute",top:2,right:2,border:`2px solid ${T.surface}`}}/>
                </button>}
                <button className="bg" onClick={logout} style={{fontSize:12,padding:"7px 10px",border:"none",borderLeft:`1px solid ${T.border}`,borderRadius:0}}>Out</button>
              </nav>
            </> : <>
              {/* Desktop row: logo + nav + buttons */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
                <div style={{display:"flex",alignItems:"center"}}>
                  <h1 style={{fontFamily:serif,fontSize:19,fontWeight:600,marginRight:18}}>
                    <span style={{color:T.muted}}>my</span><span style={{color:T.terra}}>recipe</span><span style={{color:T.sage}}>cards</span>
                  </h1>
                  <nav style={{display:"flex"}}>
                    <button className={`nav-btn${page==="recipes"?" active":""}`} onClick={()=>setPage("recipes")}>Recipes</button>
                    <button className={`nav-btn${page==="mealplan"?" active":""}`} onClick={()=>setPage("mealplan")}>Meal Plan</button>
                  </nav>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {inbox.length>0&&(
                    <button className="bg" onClick={()=>setInboxOpen(o=>!o)} style={{position:"relative",padding:"6px 11px",fontSize:12}}>
                      🔔 {inbox.length}
                      <span style={{width:7,height:7,borderRadius:"50%",background:T.terra,position:"absolute",top:2,right:2,border:`2px solid ${T.surface}`}}/>
                    </button>
                  )}
                  <button className="bg" onClick={()=>setShowSettings(true)} style={{position:"relative",padding:"6px 11px",fontSize:12}}>
                    ⚙ Settings
                    {hasSettings&&<span style={{width:5,height:5,borderRadius:"50%",background:T.terra,position:"absolute",top:3,right:3}}/>}
                  </button>
                  <button className="bp" onClick={()=>setShowAdd(true)} style={{padding:"6px 12px",fontSize:13}}>+ Add recipe</button>
                  <button className="bg" onClick={logout} style={{fontSize:12,padding:"6px 10px"}}>Log out</button>
                </div>
              </div>
            </>}
          </div>
        </header>

        {/* Shared-via-link import banner */}
        {sharedRecipeToImport&&(
          <div style={{background:T.terraBtn,color:"#fff",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:500}}>📨 Someone shared "<strong>{sharedRecipeToImport.title}</strong>" with you</span>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{addRecipe(sharedRecipeToImport);setSharedRecipeToImport(null);}}
                style={{background:"#fff",color:T.terraBtn,border:"none",borderRadius:6,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:sans}}>
                Add to my cookbook
              </button>
              <button onClick={()=>setSharedRecipeToImport(null)}
                style={{background:"rgba(255,255,255,0.2)",color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:12,cursor:"pointer",fontFamily:sans}}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Inbox dropdown */}
        {inboxOpen&&inbox.length>0&&(
          <div style={{position:"fixed",top:54,right:16,zIndex:80,width:340,maxHeight:420,overflowY:"auto",background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,boxShadow:"0 8px 28px rgba(0,0,0,.15)"}}>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:500,color:T.ink}}>Shared with you</span>
              <button className="bg" style={{fontSize:11,padding:"2px 8px"}} onClick={()=>setInboxOpen(false)}>✕</button>
            </div>
            {inbox.map(msg=>(
              <div key={msg.id} style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:T.ink,marginBottom:2}}>{msg.recipe.title}</div>
                  <div style={{fontSize:11,color:T.muted}}>From {msg.fromName} · {new Date(msg.sentAt).toLocaleDateString()}</div>
                </div>
                <div style={{display:"flex",gap:5,flexShrink:0}}>
                  <button className="bp" style={{padding:"4px 10px",fontSize:11}} onClick={()=>{acceptInboxRecipe(msg.id);setInboxOpen(false);}}>Add</button>
                  <button className="bg" style={{padding:"4px 8px",fontSize:11}} onClick={()=>dismissInboxItem(msg.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recipes Page */}
        {page==="recipes"&&(
          <div style={{maxWidth:1100,margin:"0 auto",padding:isMobile?"14px 10px":"20px 18px",display:"flex",gap:16,alignItems:"flex-start"}}>

            {/* ── Folder sidebar (desktop: always visible, mobile: slide-in drawer) ── */}
            {!isMobile&&(
              <aside style={{width:240,flexShrink:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 0",position:"sticky",top:68}}>
                <FolderPanel
                  folders={folders} activeFolder={activeFolder}
                  recipes={recipes} T={T} sans={sans} serif={serif}
                  onSelect={f=>{setActiveFolder(f);}}
                  onCreate={createFolder}
                  onDelete={deleteFolder}
                  dragOverFolder={dragOverFolder}
                  onDragOver={setDragOverFolder}
                  onDrop={(recipeId, folderName)=>{toggleRecipeFolder(recipeId, folderName); setDragOverFolder(null);}}
                />
              </aside>
            )}

            {/* Mobile folder drawer */}
            {isMobile&&sidebarOpen&&(
              <div style={{position:"fixed",inset:0,zIndex:80,display:"flex"}}>
                <div style={{width:260,background:T.surface,borderRight:`1px solid ${T.border}`,overflowY:"auto",padding:"12px 0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 14px 10px",borderBottom:`1px solid ${T.border}`,marginBottom:6}}>
                    <span style={{fontFamily:serif,fontSize:15,fontWeight:600,color:T.ink}}>Folders</span>
                    <button className="bg" style={{padding:"3px 8px",fontSize:12}} onClick={()=>setSidebarOpen(false)}>✕</button>
                  </div>
                  <FolderPanel
                    folders={folders} activeFolder={activeFolder}
                    recipes={recipes} T={T} sans={sans} serif={serif}
                    onSelect={f=>{setActiveFolder(f);setSidebarOpen(false);}}
                    onCreate={createFolder}
                    onDelete={deleteFolder}
                    dragOverFolder={dragOverFolder}
                    onDragOver={setDragOverFolder}
                    onDrop={(recipeId, folderName)=>{toggleRecipeFolder(recipeId, folderName); setDragOverFolder(null);}}
                  />
                </div>
                <div style={{flex:1,background:"rgba(0,0,0,.4)"}} onClick={()=>setSidebarOpen(false)}/>
              </div>
            )}

            {/* ── Main content ── */}
            <main style={{flex:1,minWidth:0}}>
              {/* Folder breadcrumb + mobile folder toggle */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {isMobile&&<button className="bg" onClick={()=>setSidebarOpen(true)} style={{padding:"5px 9px",fontSize:13}}>📁</button>}
                  {activeFolder
                    ? <span style={{fontFamily:serif,fontSize:15,color:T.ink}}>
                        <button onClick={()=>setActiveFolder(null)} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontFamily:sans,fontSize:12,padding:0}}>All Recipes</button>
                        {" › "}<strong>{activeFolder}</strong>
                        <span style={{fontSize:11,color:T.muted,marginLeft:6}}>({filtered.length})</span>
                      </span>
                    : <span style={{fontSize:12,color:T.muted}}>{recipes.length} recipe{recipes.length!==1?"s":""} total</span>
                  }
                </div>
              </div>

              <div style={{marginBottom:9,position:"relative"}}>
                <input ref={searchRef} placeholder="Search ingredients, dish name, cuisine..." value={search}
                  onChange={e=>setSearch(e.target.value)} onKeyDown={onSearchKey}
                  style={{width:"100%",fontSize:15,paddingRight:search?"34px":"12px",background:T.surface,color:T.ink}}/>
                {search&&<button onClick={()=>{setSearch("");searchRef.current&&searchRef.current.focus();}}
                  style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:15,color:T.muted,padding:0}}>✕</button>}
              </div>
              {filters.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:9}}>
                  {filters.map(f=>(
                    <button key={f} onClick={()=>setFilters(filters.filter(a=>a!==f))}
                      style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,border:`1px solid ${T.terra}`,background:T.terraLight,color:T.terra,fontSize:12,cursor:"pointer",fontFamily:sans}}>
                      {f}<span>×</span>
                    </button>
                  ))}
                  <button onClick={()=>setFilters([])} style={{fontSize:11,color:T.muted,background:"none",border:"none",cursor:"pointer"}}>clear all</button>
                </div>
              )}
              {!search&&!filters.length&&(
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16}}>
                  {allTags().map(t=><button key={t} onClick={()=>addFilter(t)} style={{cursor:"pointer",border:"none",fontFamily:sans,display:"inline-block",fontSize:11,fontWeight:500,letterSpacing:".04em",textTransform:"uppercase",padding:"3px 9px",borderRadius:20,background:T.sageTagBg,color:T.sageTagText}}>{t}</button>)}
                </div>
              )}
              {(search||filters.length>0)&&(
                <p style={{fontSize:12,color:T.muted,marginBottom:12}}>
                  {filtered.length} recipe{filtered.length!==1?"s":""} found
                  {search&&<> matching "<strong>{search}</strong>"</>}
                  {filters.length>0&&<> · {filters.map((f,i)=><span key={f}><strong>{f}</strong>{i<filters.length-1?" + ":""}</span>)}</>}
                </p>
              )}
              {filtered.length>0
                ? <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(auto-fill,minmax(160px,1fr))":"repeat(auto-fill,minmax(240px,1fr))",gap:isMobile?10:13}}>
                    {filtered.map(r=><RecipeCard key={r.id} recipe={r} onClick={setSelected} T={T}/>)}
                  </div>
                : <div style={{textAlign:"center",padding:"48px 20px",color:T.muted}}>
                    <div style={{fontSize:34,marginBottom:9}}>🍽️</div>
                    <p style={{fontFamily:serif,fontSize:16,marginBottom:5,color:T.ink}}>{activeFolder?"No recipes in this folder":"No recipes found"}</p>
                    <p style={{fontSize:13}}>{activeFolder?"Add recipes to this folder from the recipe detail view":"Try a different search or add a new recipe"}</p>
                    {!activeFolder&&<button className="bp" style={{marginTop:13}} onClick={()=>setShowAdd(true)}>Add your first recipe</button>}
                  </div>
              }
            </main>
          </div>
        )}

        {/* Meal Plan Page */}
        {page==="mealplan"&&(
          <MealPlanPage
            recipes={recipes}
            mealPlan={mealPlan}
            onMealPlanChange={onMealPlanChange}
            settings={settings}
            T={T}
            isMobile={isMobile}
          />
        )}
      </div>

      {selected&&<RecipeDetail recipe={selected} settings={settings} T={T} currentUid={uid} currentName={userName} folders={folders} onMoveToFolder={toggleRecipeFolder} onClose={()=>setSelected(null)} onDelete={id=>{deleteRecipe(id);setSelected(null);}} onSave={saveRecipe}/>}

      {/* AddModal — always mounts when showAdd, importJob persists in App even when modal is hidden */}
      {showAdd&&<AddModal
        onClose={()=>setShowAdd(false)}
        T={T}
        importJob={importJob}
        onStartImport={runImport}
      />}

      {/* Toast — shows when there is an active import job AND modal is not open */}
      {importJob&&!showAdd&&(
        <ImportToast
          importJob={importJob}
          T={T}
          onExpand={()=>setShowAdd(true)}
        />
      )}

      {showSettings&&<SettingsModal settings={settings} onChange={updateSettings} onClose={()=>setShowSettings(false)} trash={trash} onRestore={restoreRecipe} T={T}/>}

    </>
  );
}
