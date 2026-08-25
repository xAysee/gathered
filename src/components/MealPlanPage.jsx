import { useState, useRef, useEffect, useCallback } from "react";
import { serif, sans } from "../lib/theme.js";
import { buildGroceryList } from "../lib/grocery.js";
import { dateKey, MONTH_NAMES, DAY_LABELS_SUN, DAY_LABELS_MON, getMonthDays } from "../lib/dates.js";
import { cvt } from "../lib/units.js";
import { Overlay } from "./Overlay.jsx";
import { Dots } from "./Dots.jsx";

function MealPlanPage({ recipes, mealPlan, onMealPlanChange, settings, T, isMobile=false }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [pickerDay, setPickerDay] = useState(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [showGrocery, setShowGrocery] = useState(false);

  const [smsStatus, setSmsStatus] = useState("");
  const [copiedGrocery, setCopiedGrocery] = useState(false);
  const [selectedGroceryDays, setSelectedGroceryDays] = useState(null); // null = default to visible calendar scope
  // Drag-to-copy state
  const dragMeal = useRef(null); // { fromDk, mealIdx, meal }
  const [dragOverDk, setDragOverDk] = useState(null); // dateKey being hovered
  const startMonday = settings.weekStart === "mon";
  const todayKey = dateKey(now);

  const cells = getMonthDays(year, month, startMonday);

  // All dates shown on the current calendar view — current month + overflow days
  // from prev/next month that fill the first/last partial weeks.
  const visibleDateKeys = new Set(cells.map(({date}) => dateKey(date)));

  // Automatic grocery scope: visible calendar dates that HAVE meals planned.
  // This updates live as meals are added/removed — no manual selection needed.
  const autoGroceryDays = new Set(
    [...visibleDateKeys].filter(dk => (mealPlan[dk]||[]).length > 0)
  );

  // selectedGroceryDays === null means "use automatic scope".
  // Once the user manually toggles a day it becomes a Set they control.
  const activeGroceryDays = selectedGroceryDays === null ? autoGroceryDays : selectedGroceryDays;
  const dayLabels = startMonday ? DAY_LABELS_MON : DAY_LABELS_SUN;

  function addMeal(dk, recipeId) {
    const recipe = recipes.find(r=>r.id===recipeId);
    const prev = mealPlan[dk]||[];
    onMealPlanChange({...mealPlan,[dk]:[...prev,{recipeId,servings:recipe?.servings||4}]});
    setPickerDay(null); setPickerSearch("");
  }
  function removeMeal(dk, idx) {
    const next=(mealPlan[dk]||[]).filter((_,i)=>i!==idx);
    onMealPlanChange({...mealPlan,[dk]:next.length?next:undefined});
  }
  function updateServings(dk, idx, val) {
    const next=(mealPlan[dk]||[]).map((m,i)=>i===idx?{...m,servings:Math.max(1,parseInt(val)||1)}:m);
    onMealPlanChange({...mealPlan,[dk]:next});
  }
  function prevMonth() { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  function nextMonth() { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }

  function toggleGroceryDay(dk) {
    setSelectedGroceryDays(prev => {
      // First customization: start from the current auto scope (meals on visible days)
      const base = prev === null ? new Set(autoGroceryDays) : new Set(prev);
      if (base.has(dk)) base.delete(dk); else base.add(dk);
      return base;
    });
  }
  function resetGroceryFilter() { setSelectedGroceryDays(null); }

  function onMealDragStart(e, fromDk, mealIdx, meal) {
    dragMeal.current = { fromDk, mealIdx, meal };
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData("text/plain", meal.recipeId); // required for Firefox
  }
  function onCellDragOver(e, dk) {
    if (!dragMeal.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.altKey ? "move" : "copy";
    setDragOverDk(dk);
  }
  function onCellDragLeave() { setDragOverDk(null); }
  function onCellDrop(e, dk) {
    e.preventDefault();
    const drag = dragMeal.current;
    if (!drag) return;
    const isMove = e.altKey;
    const newMealPlan = {...mealPlan};
    // Add to target day
    const targetMeals = [...(newMealPlan[dk]||[]), {...drag.meal}];
    newMealPlan[dk] = targetMeals;
    // If moving (alt key), remove from source day
    if (isMove && drag.fromDk !== dk) {
      const src = [...(newMealPlan[drag.fromDk]||[])];
      src.splice(drag.mealIdx, 1);
      if (src.length > 0) newMealPlan[drag.fromDk] = src;
      else delete newMealPlan[drag.fromDk];
    }
    onMealPlanChange(newMealPlan);
    dragMeal.current = null;
    setDragOverDk(null);
  }
  function onDragEnd() { dragMeal.current = null; setDragOverDk(null); }

  // Build filtered meal plan — always filtered to the active day scope
  const groceryMealPlan = Object.fromEntries(
    Object.entries(mealPlan).filter(([dk]) => activeGroceryDays.has(dk))
  );

  // Apply measurement conversions to grocery amounts
  const groceryItemsRaw = buildGroceryList(groceryMealPlan, recipes);
  const groceryItems = groceryItemsRaw.map(item => ({
    ...item,
    displayAmount: cvt(item.displayAmount, settings),
    subLines: item.subLines.map(l => {
      // Apply conversion only to the amount part before the dash
      const dashIdx = l.indexOf(" — ");
      if (dashIdx === -1) return cvt(l, settings);
      return cvt(l.slice(0, dashIdx), settings) + l.slice(dashIdx);
    }),
  }));

  const [checkedItems, setCheckedItems] = useState({});
  function toggleCheck(name) { setCheckedItems(prev=>({...prev,[name]:!prev[name]})); }

  // hasDayFilter: true when user has manually selected a subset (not using default visible scope)
  const isCustomFilter = selectedGroceryDays !== null;
  const hasDayFilter = isCustomFilter;

  function groceryText() {
    const label = isCustomFilter ? `🛒 Grocery List (${(selectedGroceryDays||new Set()).size} days)` : `🛒 Grocery List — ${MONTH_NAMES[month]} ${year} (auto)`;
    if(!groceryItems.length) return "No groceries planned.";
    const lines=[label,""];
    groceryItems.forEach(item=>{
      lines.push(`• ${item.name}: ${item.displayAmount}`);
      // Always show sub-lines for non-numeric items (they carry the \u00d7N count + recipe name),
      // and for numeric items only when more than one recipe contributed.
      if (item.isNonNumeric || item.subLines.length>1) {
        item.subLines.forEach(l=>lines.push(`    \u21b3 ${l}`));
      }
    });
    return lines.join("\n");
  }

  const filteredPicker = recipes.filter(r=>r.title.toLowerCase().includes(pickerSearch.toLowerCase())||r.tags.some(t=>t.includes(pickerSearch.toLowerCase())));
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div style={{maxWidth:1100,margin:"0 auto",padding:isMobile?"10px 8px":"20px 16px"}}>
      {/* Month nav */}
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",alignItems:isMobile?"stretch":"center",justifyContent:"space-between",marginBottom:isMobile?10:18,gap:isMobile?8:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,justifyContent:"center"}}>
          <button className="bg" onClick={prevMonth} style={{padding:"6px 12px"}}>‹</button>
          <h2 style={{fontFamily:serif,fontSize:isMobile?16:20,color:T.ink,minWidth:isMobile?120:180,textAlign:"center"}}>{MONTH_NAMES[month]} {year}</h2>
          <button className="bg" onClick={nextMonth} style={{padding:"6px 12px"}}>›</button>
          {(year!==now.getFullYear()||month!==now.getMonth())&&<button className="bg" onClick={()=>{setYear(now.getFullYear());setMonth(now.getMonth());}} style={{fontSize:12}}>Today</button>}
        </div>
        <button className="bp" onClick={()=>setShowGrocery(true)} style={{textAlign:"center"}}>🛒 Grocery List</button>
      </div>

      {/* Day headers */}
      <div style={{overflowX:isMobile?"auto":"visible"}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(7,minmax(46px,1fr))":"repeat(7,1fr)",gap:isMobile?3:4,marginBottom:isMobile?3:4,minWidth:isMobile?322:0}}>
        {dayLabels.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:500,color:T.muted,textTransform:"uppercase",letterSpacing:".05em",padding:"4px 0"}}>{d}</div>)}
      </div>

      {/* Calendar grid */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(7,minmax(46px,1fr))":"repeat(7,1fr)",gap:isMobile?3:4,minWidth:isMobile?322:0}}>
        {cells.map(({date,thisMonth},ci)=>{
          const dk=dateKey(date);
          const meals=mealPlan[dk]||[];
          const isPast = dk < todayKey;
          const isToday = dk === todayKey;
          const isGrocerySelected = activeGroceryDays.has(dk) && meals.length > 0;
          const hasMeals = meals.length > 0;
          return (
            <div key={dk+ci}
              onDragOver={e=>onCellDragOver(e,dk)}
              onDragLeave={onCellDragLeave}
              onDrop={e=>onCellDrop(e,dk)}
              onClick={isMobile&&thisMonth?()=>{setPickerDay(dk);setPickerSearch("");}:undefined}
              style={{minHeight:isMobile?72:110,borderRadius:isMobile?5:7,cursor:isMobile&&thisMonth?"pointer":"default",
                border:`2px solid ${dragOverDk===dk?"#2E7D4F":isToday?T.terra:T.border}`,
                background:dragOverDk===dk?"rgba(46,125,79,0.08)":isToday?T.terraLight:T.surface,
                padding:"6px 6px 0px",display:"flex",flexDirection:"column",gap:3,
                opacity:thisMonth?(isPast?0.55:1):0.3,overflow:"hidden",position:"relative",
                transition:"border-color .1s,background .1s"}}>
              {/* Grocery selected indicator — green left stripe, always visible regardless of today */}
              {isGrocerySelected&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:"#2E7D4F",borderRadius:"5px 0 0 5px"}}/>}
              <div style={{padding:"0 0 5px",paddingLeft:isGrocerySelected?7:0,display:"flex",flexDirection:"column",gap:3,flex:1}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:1}}>
                <div style={{fontFamily:serif,fontSize:isMobile?10:13,fontWeight:isToday?600:400,color:isToday?T.terra:T.ink}}>{date.getDate()}</div>
                {thisMonth&&hasMeals&&!isMobile&&(
                  <button title={isGrocerySelected?"Remove from grocery list":"Add to grocery list"}
                    onClick={e=>{e.stopPropagation();toggleGroceryDay(dk);}}
                    style={{fontSize:10,background:isGrocerySelected?"#2E7D4F":"none",color:isGrocerySelected?"#fff":T.muted,border:`1px solid ${isGrocerySelected?"#2E7D4F":T.border}`,borderRadius:10,cursor:"pointer",padding:"1px 5px",lineHeight:1.4,fontFamily:sans,transition:"all .15s"}}>
                    {isGrocerySelected?"✓ list":"+ list"}
                  </button>
                )}
              </div>
              {meals.map((meal,mi)=>{
                const recipe=recipes.find(r=>r.id===meal.recipeId);
                return recipe?(
                  <div key={mi}
                    draggable
                    onDragStart={e=>onMealDragStart(e,dk,mi,meal)}
                    onDragEnd={onDragEnd}
                    style={{background:T.paper,borderRadius:4,border:`1px solid ${T.border}`,padding:isMobile?"2px 3px":"4px 5px",fontSize:isMobile?8:10,cursor:"grab",userSelect:"none"}}>
                    {/* Title row with × on the right */}
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:2,marginBottom:3}}>
                      <div style={{fontWeight:500,color:T.ink,lineHeight:1.25,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0,fontSize:isMobile?9:undefined}}>
                        <span style={{fontSize:8,color:T.muted,marginRight:3}}>⠿</span>{recipe.title}
                      </div>
                      <button onClick={()=>removeMeal(dk,mi)}
                        style={{flexShrink:0,background:"none",border:"none",cursor:"pointer",color:"#C0392B",fontSize:14,lineHeight:1,padding:"0 1px",fontFamily:sans,fontWeight:600}}>×</button>
                    </div>
                    {/* Servings row — no spinner arrows overlap */}
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:9,color:T.muted}}>👤</span>
                      <button onClick={()=>updateServings(dk,mi,meal.servings-1)}
                        style={{width:16,height:16,borderRadius:3,border:`1px solid ${T.border}`,background:T.surface,color:T.ink,fontSize:11,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:sans}}>−</button>
                      <span style={{fontSize:11,fontWeight:500,color:T.ink,minWidth:14,textAlign:"center"}}>{meal.servings}</span>
                      <button onClick={()=>updateServings(dk,mi,meal.servings+1)}
                        style={{width:16,height:16,borderRadius:3,border:`1px solid ${T.border}`,background:T.surface,color:T.ink,fontSize:11,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:sans}}>+</button>
                    </div>
                  </div>
                ):null;
              })}
              {thisMonth&&(
                <button onClick={()=>{setPickerDay(dk);setPickerSearch("");}}
                  style={{marginTop:"auto",background:"none",border:`1px dashed ${T.border}`,borderRadius:4,padding:"2px 0",fontSize:isMobile?8:10,color:T.muted,cursor:"pointer",fontFamily:sans,display:isMobile?"none":"block"}}>+ add</button>
              )}
              </div>
            </div>
          );
        })}
      </div>

      </div>{/* end scroll wrapper */}
      {/* Drag hint */}
      {!isMobile&&<p style={{fontSize:11,color:T.muted,textAlign:"center",marginTop:6}}>
        Drag a meal to copy it to another day &nbsp;·&nbsp; Hold <kbd style={{background:T.paper,border:`1px solid ${T.border}`,borderRadius:3,padding:"0 4px",fontSize:10}}>Alt</kbd> while dropping to move instead
      </p>}

      {/* Recipe picker overlay */}
      {pickerDay&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:150,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onMouseDown={e=>{if(e.target===e.currentTarget){setPickerDay(null);setPickerSearch("");}}}>
          <div className="card fi" style={{width:"100%",maxWidth:500,background:T.surface}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <h3 style={{fontFamily:serif,fontSize:17,color:T.ink}}>Add meal</h3>
                <p style={{fontSize:12,color:T.muted,marginTop:2}}>{new Date(pickerDay+"T12:00:00").toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</p>
              </div>
              <button className="bg" onClick={()=>{setPickerDay(null);setPickerSearch("");}}>✕</button>
            </div>
            <div style={{padding:"12px 18px"}}>
              <input autoFocus value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)} placeholder="Search recipes..." style={{width:"100%",marginBottom:10,background:T.surface,color:T.ink}}/>
              <div style={{maxHeight:340,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
                {filteredPicker.map(r=>(
                  <button key={r.id} onClick={()=>addMeal(pickerDay,r.id)}
                    style={{background:"none",border:`1px solid ${T.border}`,borderRadius:7,textAlign:"left",padding:"9px 12px",cursor:"pointer",fontFamily:sans,transition:"background .1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.paper}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <div style={{fontSize:14,fontWeight:500,color:T.ink,marginBottom:2}}>{r.title}</div>
                    <div style={{fontSize:11,color:T.muted}}>{r.tags.slice(0,3).join(" · ")} · 👤 {r.servings}</div>
                  </button>
                ))}
                {filteredPicker.length===0&&<p style={{fontSize:13,color:T.muted,textAlign:"center",padding:"16px 0"}}>No recipes found</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grocery list overlay */}
      {showGrocery&&(
        <Overlay onClose={()=>{setShowGrocery(false);setSmsStatus("");}}>
          <div className="card fi" style={{width:"100%",maxWidth:500,marginBottom:24,background:T.surface}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <h3 style={{fontFamily:serif,fontSize:18,color:T.ink}}>🛒 Grocery List</h3>
                <p style={{fontSize:11,color:T.muted,marginTop:2}}>
                  {isCustomFilter ? `${(selectedGroceryDays||new Set()).size} day${(selectedGroceryDays||new Set()).size!==1?"s":""} selected — ` : `Auto (${autoGroceryDays.size} day${autoGroceryDays.size!==1?"s":""}) — `}
                  {checkedCount>0?`${checkedCount}/${groceryItems.length} checked`:`${groceryItems.length} item${groceryItems.length!==1?"s":""}`}
                </p>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                {checkedCount>0&&<button className="bg" style={{fontSize:12,padding:"4px 9px"}} onClick={()=>setCheckedItems({})}>Uncheck all</button>}
                <button className="bg" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>{navigator.clipboard.writeText(groceryText());setCopiedGrocery(true);setTimeout(()=>setCopiedGrocery(false),2000);}}>
                  {copiedGrocery?"✓ Copied!":"Copy all"}
                </button>
                <button className="bg" onClick={()=>{setShowGrocery(false);setSmsStatus("");}}>✕</button>
              </div>
            </div>
            <div style={{padding:"12px 18px"}}>
              {/* Day filter status */}
              <div style={{marginBottom:10,padding:"7px 10px",background:T.paper,borderRadius:7,fontSize:12,color:T.muted,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                <span>
                  {isCustomFilter
                    ? `${(selectedGroceryDays||new Set()).size} day${(selectedGroceryDays||new Set()).size!==1?"s":""} selected`
                    : `Auto: ${autoGroceryDays.size} day${autoGroceryDays.size!==1?"s":""} with meals`}
                </span>
                <div style={{display:"flex",gap:6}}>
                  {isCustomFilter && <button className="bg" style={{fontSize:11,padding:"2px 8px"}} onClick={resetGroceryFilter}>Reset to auto</button>}
                  {!isCustomFilter && <span style={{fontSize:11,color:T.muted}}>tap 🛒 on days to filter</span>}
                </div>
              </div>
              {groceryItems.length===0
                ? <p style={{color:T.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>No meals planned. Add recipes to your calendar first.</p>
                : <div style={{marginBottom:14}}>
                    {groceryItems.map((item,i)=>{
                      const checked = !!checkedItems[item.name];
                      return (
                        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.border}`,cursor:"pointer",opacity:checked?0.45:1,transition:"opacity .15s"}}
                          onClick={()=>toggleCheck(item.name)}>
                          {/* Checkbox */}
                          <div style={{flexShrink:0,marginTop:3,width:16,height:16,borderRadius:4,border:`1.5px solid ${checked?T.terra:T.border}`,background:checked?T.terra:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                            {checked&&<span style={{color:"#fff",fontSize:10,fontWeight:700,lineHeight:1}}>✓</span>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                              <span style={{fontSize:13,fontWeight:500,color:T.ink,textDecoration:checked?"line-through":"none"}}>{item.name}</span>
                              <span style={{fontSize:13,color:T.terra,fontWeight:500}}>{item.displayAmount}</span>
                            </div>
                            {/* Sub-breakdown — only show when more than 1 recipe contributed */}
                            {item.subLines.length>1&&(
                              <div style={{marginTop:3,display:"flex",flexDirection:"column",gap:1}}>
                                {item.subLines.map((l,li)=>(
                                  <span key={li} style={{fontSize:11,color:T.muted}}>↳ {l}</span>
                                ))}
                              </div>
                            )}
                            {/* Single recipe — show recipe name small */}
                            {item.subLines.length===1&&(
                              <span style={{fontSize:11,color:T.muted}}>{item.subLines[0].split("—").slice(1).join("—").trim()}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }

              {groceryItems.length>0&&<div style={{background:T.paper,borderRadius:8,padding:"11px 13px"}}>
                <div style={{fontSize:12,fontWeight:500,color:T.ink,marginBottom:4}}>Send this list as a text</div>
                <p style={{fontSize:11,color:T.muted,marginBottom:9,lineHeight:1.4}}>
                  Opens your phone's own Messages app with the list pre-filled — just pick a contact and tap send.
                </p>
                <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                  <a href={`sms:?body=${encodeURIComponent(groceryText())}`} style={{textDecoration:"none"}}>
                    <button className="bp" style={{fontSize:13,padding:"7px 14px"}}>💬 Open in Messages</button>
                  </a>
                  <button className="bg" style={{fontSize:13,padding:"7px 14px"}} onClick={()=>{navigator.clipboard.writeText(groceryText());setSmsStatus("copied");}}>
                    Copy text instead
                  </button>
                </div>
                {smsStatus==="copied"&&<p style={{fontSize:12,color:T.sage,marginTop:6}}>✓ Copied to clipboard!</p>}
              </div>}
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
) {
  return (
    <Overlay onClose={onClose} zIndex={300}>
      <div className="card fi" style={{width:"100%",maxWidth:560,marginBottom:24,background:T.surface}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{fontFamily:serif,fontSize:18,color:T.ink}}>How to add Twilio SMS</h3>
          <button className="bg" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:"16px 20px",fontSize:13,color:T.ink,lineHeight:1.7}}>
          <p style={{marginBottom:12}}>Because browsers can't make authenticated server calls directly, Twilio SMS requires a small backend. Here's the quickest path:</p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[
              ["1. Create a free Twilio account","Go to twilio.com, sign up, and grab a free phone number. Copy your Account SID and Auth Token from the Console Dashboard."],
              ["2. Deploy a tiny serverless function","Use Vercel, Netlify, or Cloudflare Workers. Create a POST endpoint that accepts { to, body } and calls the Twilio Messages API.\n\nExample: const client = twilio(SID, TOKEN); await client.messages.create({ body, from: YOUR_NUMBER, to });"],
              ["3. Replace the Send button logic","In the grocery list, replace the smsStatus preview line with a fetch call to your serverless endpoint, passing { to: phone, body: groceryText() }."],
              ["4. Add CORS headers","Make sure your function allows requests from your app's domain."],
            ].map(([title, body])=>(
              <div key={title} style={{background:T.paper,borderRadius:7,padding:"10px 13px"}}>
                <div style={{fontWeight:500,marginBottom:4,color:T.terra}}>{title}</div>
                <pre style={{fontSize:11,whiteSpace:"pre-wrap",fontFamily:sans,color:T.ink,lineHeight:1.6}}>{body}</pre>
              </div>
            ))}
          </div>
          <p style={{marginTop:14,fontSize:12,color:T.muted}}>The "Open in Messages" button in the grocery list already works without any setup — it opens your phone's native SMS app pre-filled with the list.</p>
        </div>
      </div>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT

export { MealPlanPage };
