import { useState, useRef, useEffect, useCallback } from "react";
import { serif, sans } from "../lib/theme.js";
import { supabase } from "../lib/supabase.js";
import { scaleAmount, applyCvt, loadPdfJs, extractPdfText } from "../lib/units.js";
import { Dots } from "./Dots.jsx";
import { Overlay } from "./Overlay.jsx";
import { ShareModal } from "./ShareModal.jsx";

function RecipeDetail({ recipe, onClose, onDelete, onSave, settings, T, currentUid="", currentName="", folders=[], onMoveToFolder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({...recipe});
  const [newTag, setNewTag] = useState("");
  const [scale, setScale] = useState(1);
  const imageFileRef = useRef();
  const dragStepIdx = useRef(null);
  const isMobile = useWindowWidth() < 640;

  // Apply scale then conversion settings to view
  const scaledIngredients = draft.ingredients.map(i=>({...i, amount: scale!==1?scaleAmount(i.amount, scale):i.amount}));
  const { ing, steps } = applyCvt(scaledIngredients, draft.steps, settings);
  const converted = settings.weight!=="original"||settings.volume!=="original"||settings.temp!=="original";
  useEffect(()=>{ setDraft({...recipe}); setEditing(false); setScale(1); },[recipe.id]);

  function saveEdit() { onSave(draft); setEditing(false); }
  function addTag() { const t=newTag.trim().toLowerCase(); if(t&&!draft.tags.includes(t))setDraft({...draft,tags:[...draft.tags,t]}); setNewTag(""); }
  function removeTag(t) { setDraft({...draft,tags:draft.tags.filter(x=>x!==t)}); }
  function updateIng(i,field,val) { setDraft({...draft,ingredients:draft.ingredients.map((x,idx)=>idx===i?{...x,[field]:val}:x)}); }
  function addIng() { setDraft({...draft,ingredients:[...draft.ingredients,{amount:"",name:""}]}); }
  function removeIng(i) { setDraft({...draft,ingredients:draft.ingredients.filter((_,idx)=>idx!==i)}); }
  function updateStep(i,val) { setDraft({...draft,steps:draft.steps.map((s,idx)=>idx===i?val:s)}); }
  function addStep() { setDraft({...draft,steps:[...draft.steps,""]}); }
  function removeStep(i) { setDraft({...draft,steps:draft.steps.filter((_,idx)=>idx!==i)}); }
  const [showShare, setShowShare] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [dragOverStep, setDragOverStep] = useState(null);
  function onDragStartStep(i) { dragStepIdx.current = i; }
  function onDragOverStep(e,i) { e.preventDefault(); setDragOverStep(i); }
  function onDragEndStep() { setDragOverStep(null); dragStepIdx.current=null; }
  function onDropStep(i) {
    const from=dragStepIdx.current; if(from===null||from===i){setDragOverStep(null);return;}
    const s2=[...draft.steps]; const [m]=s2.splice(from,1); s2.splice(i,0,m);
    setDraft({...draft,steps:s2}); dragStepIdx.current=null; setDragOverStep(null);
  }
  const dragTagIdx = useRef(null);
  const [dragOverTag, setDragOverTag] = useState(null);
  function onDragStartTag(i) { dragTagIdx.current = i; }
  function onDragOverTag(e,i) { e.preventDefault(); setDragOverTag(i); }
  function onDragEndTag() { setDragOverTag(null); dragTagIdx.current=null; }
  function onDropTag(i) {
    const from=dragTagIdx.current; if(from===null||from===i){setDragOverTag(null);return;}
    const t2=[...draft.tags]; const [m]=t2.splice(from,1); t2.splice(i,0,m);
    setDraft({...draft,tags:t2}); dragTagIdx.current=null; setDragOverTag(null);
  }


  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft({...draft, image: reader.result});
    reader.readAsDataURL(file);
  }

  async function handleImagePaste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = () => setDraft({...draft, image: reader.result});
          reader.readAsDataURL(blob);
          return;
        }
      }
      alert("No image found in clipboard. Copy an image first then try again.");
    } catch(e) {
      alert("Could not access clipboard. Make sure you have granted clipboard permission.");
    }
  }

  const displayIng = editing ? draft.ingredients : ing;
  const displaySteps = editing ? draft.steps : steps;

  return (
    <Overlay onClose={onClose}>
      <div className="card fi" style={{width:"100%",maxWidth:isMobile?"100%":740,marginBottom:isMobile?0:24,background:T.surface,minHeight:isMobile?"100dvh":"auto",borderRadius:isMobile?0:undefined}}>
        {/* Image */}
        {draft.image
          ? <div style={{height:220,overflow:"hidden",position:"relative"}}>
              <img src={draft.image} alt={draft.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              {editing&&<button onClick={()=>setDraft({...draft,image:null})}
                style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,.5)",color:"#fff",border:"none",borderRadius:20,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>Remove photo</button>}
            </div>
          : editing
            ? <div style={{height:100,background:T.paper,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                <button className="bg" onClick={()=>imageFileRef.current.click()} style={{fontSize:13}}>📷 Add photo</button>
                <button className="bg" onClick={handleImagePaste} style={{fontSize:13}}>📋 Paste from clipboard</button>
                <input ref={imageFileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImageUpload}/>
              </div>
            : <div style={{height:80,background:T.paper,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30}}>🍽️</div>
        }
        {editing && draft.image && (
          <div style={{padding:"6px 20px",borderBottom:`1px solid ${T.border}`,background:T.paper}}>
            <button className="bg" onClick={()=>imageFileRef.current.click()} style={{fontSize:12,padding:"4px 10px"}}>📷 Change photo</button>
            <button className="bg" onClick={handleImagePaste} style={{fontSize:12,padding:"4px 10px"}}>📋 Paste image</button>
            <input ref={imageFileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImageUpload}/>
          </div>
        )}

        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
          <div style={{flex:1,minWidth:0}}>
            {editing
              ? <><div style={{display:"flex",gap:5,alignItems:"center",marginBottom:7}}><input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} style={{flex:1,fontSize:19,fontFamily:serif,fontWeight:600,background:T.surface,color:T.ink}}/><button className="bg" title="Capitalize each word" onClick={()=>setDraft({...draft,title:draft.title.replace(/\b\w/g,c=>c.toUpperCase())})} style={{flexShrink:0,fontSize:11,padding:"4px 7px",whiteSpace:"nowrap"}}>Aa</button></div>
                  <textarea value={draft.description||""} onChange={e=>setDraft({...draft,description:e.target.value})} style={{width:"100%",fontSize:13,minHeight:44,background:T.surface,color:T.ink}}/></>
              : <><div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>{draft.tags.map((t,i)=><span key={t} style={{display:"inline-block",fontSize:11,fontWeight:500,letterSpacing:".04em",textTransform:"uppercase",padding:"3px 9px",borderRadius:20,background:i%2?T.terraLight:T.sageTagBg,color:i%2?T.terra:T.sageTagText}}>{t}</span>)}</div>
                  <h2 style={{fontFamily:serif,fontSize:22,fontWeight:600,color:T.ink}}>{draft.title}</h2>
                  <p style={{marginTop:4,fontSize:13,color:T.muted}}>{draft.description}</p></>
            }
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            {editing
              ? <><button className="bg" onClick={()=>{setDraft({...recipe});setEditing(false);}}>Cancel</button>
                  <button className="bp" onClick={saveEdit}>Save</button></>
              : <><button className="bg" onClick={()=>setShowShare(true)} style={{fontSize:13}}>↗ Share</button>
                  <div style={{position:"relative",display:"inline-block"}}>
                    <button className="bg" onClick={()=>setShowFolderMenu(f=>!f)} style={{fontSize:13}}>
                      📁 {(recipe.folders&&recipe.folders.length>0)?recipe.folders.join(", "):"Folders"}
                    </button>
                    {showFolderMenu&&<div style={{position:"absolute",top:"110%",right:0,zIndex:50,background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,.15)",minWidth:200,padding:"4px 0"}}>
                      <p style={{padding:"6px 14px 4px",fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:".05em"}}>Toggle folders</p>
                      {folders.map(f=>{
                        const inFolder = (recipe.folders||[]).includes(f);
                        return (
                          <button key={f} onClick={()=>{onMoveToFolder&&onMoveToFolder(recipe.id,f);}}
                            style={{width:"100%",textAlign:"left",padding:"7px 14px",background:inFolder?T.terraLight:"none",border:"none",cursor:"pointer",fontFamily:sans,fontSize:13,color:inFolder?T.terra:T.ink,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span>📁 {f}</span>
                            {inFolder&&<span style={{color:T.terra}}>✓</span>}
                          </button>
                        );
                      })}
                      {folders.length===0&&<p style={{padding:"7px 14px",fontSize:12,color:T.muted}}>No folders yet — create one in the sidebar</p>}
                      <div style={{borderTop:`1px solid ${T.border}`,marginTop:4,padding:"4px 0"}}>
                        <button onClick={()=>setShowFolderMenu(false)} style={{width:"100%",textAlign:"center",padding:"6px 14px",background:"none",border:"none",cursor:"pointer",fontFamily:sans,fontSize:12,color:T.muted}}>Done</button>
                      </div>
                    </div>}
                  </div>
                  <button className="bg" onClick={()=>setEditing(true)} style={{fontSize:13}}>✎ Edit</button>
                  <button className="bg" onClick={onClose} style={{fontSize:13}}>✕</button></>
            }
          </div>
        </div>

        {/* Tag editor (edit mode) */}
        {editing&&(
          <div style={{padding:"10px 20px",borderBottom:`1px solid ${T.border}`,background:T.paper}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".07em",color:T.muted}}>Tags</div>
              <div style={{fontSize:10,color:T.muted}}>drag to reorder &nbsp;·&nbsp; first 3 show on card</div>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
              {draft.tags.map((t,i)=>{
                const isDragging = dragTagIdx.current===i;
                const isOver = dragOverTag===i && dragTagIdx.current!==i;
                return (
                  <span key={t} draggable
                    onDragStart={()=>onDragStartTag(i)}
                    onDragOver={e=>onDragOverTag(e,i)}
                    onDragEnd={onDragEndTag}
                    onDrop={()=>onDropTag(i)}
                    style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:20,
                      background:isOver?T.terra:i<3?T.terraLight:"transparent",
                      color:isOver?"#fff":i<3?T.terra:T.muted,
                      border:`1px solid ${i<3?T.terraLight:T.border}`,
                      fontSize:11,fontWeight:500,textTransform:"uppercase",
                      cursor:"grab",opacity:isDragging?0.4:1,
                      transition:"background .1s,color .1s,opacity .1s",
                      outline:isOver?`2px dashed ${T.terra}`:"none"}}>
                    <span style={{fontSize:9,opacity:0.6,marginRight:1}}>⠿</span>
                    {t}
                    <button className="icon-btn" style={{color:isOver?"#fff":i<3?T.terra:T.muted,fontSize:11,padding:"0 1px"}} onClick={()=>removeTag(t)}>×</button>
                  </span>
                );
              })}
              <form onSubmit={e=>{e.preventDefault();addTag();}} style={{display:"flex",gap:4}}>
                <input value={newTag} onChange={e=>setNewTag(e.target.value)} placeholder="+ add tag" style={{width:90,fontSize:12,padding:"3px 8px",borderRadius:20,background:T.surface,color:T.ink}}/>
              </form>
            </div>
          </div>
        )}

        {/* Meta row */}
        <div style={{padding:"10px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:14,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            {editing
              ? [["prepTime","Prep"],["cookTime","Cook"]].map(([k,l])=>(
                  <div key={k}><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>{l}</div>
                    <input value={draft[k]||""} onChange={e=>setDraft({...draft,[k]:e.target.value})} style={{width:80,fontSize:13,padding:"3px 7px",background:T.surface,color:T.ink}}/></div>
                )).concat(
                  <div key="servings"><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>Servings</div>
                    <input type="number" min="1" value={draft.servings||""} onChange={e=>setDraft({...draft,servings:parseInt(e.target.value)||1})} style={{width:60,fontSize:13,padding:"3px 7px",background:T.surface,color:T.ink}}/></div>
                )
              : [["⏱ Prep",draft.prepTime],["🍳 Cook",draft.cookTime]].map(([l,v])=>v?(
                  <div key={l}><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:500,marginTop:2,color:T.ink}}>{v}</div></div>
                ):null).concat(draft.servings?[(
                  <div key="serves">
                    <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:".06em"}}>👤 Serves</div>
                    <div style={{fontSize:14,fontWeight:500,marginTop:2,color:scale!==1?T.terra:T.ink}}>
                      {scale===1?draft.servings:Math.round(draft.servings*scale*10)/10}
                      {scale!==1&&<span style={{fontSize:10,color:T.muted,marginLeft:4}}>(orig {draft.servings})</span>}
                    </div>
                  </div>
)]:[])
            }
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            {converted&&!editing&&<span style={{fontSize:11,color:T.sage,background:T.sageLight,padding:"2px 8px",borderRadius:20}}>converted</span>}
            {!editing&&(
              <div style={{display:"flex",alignItems:"center",gap:2,background:T.paper,border:`1px solid ${T.border}`,borderRadius:20,padding:"3px 6px"}}>
                <span style={{fontSize:10,color:T.muted,paddingRight:4,letterSpacing:".04em",textTransform:"uppercase"}}>Scale</span>
                {[{v:draft.servings?1/draft.servings:1,l:"1 srv"},{v:0.5,l:"½×"},{v:1,l:"1×"},{v:1.5,l:"1½×"},{v:2,l:"2×"},{v:3,l:"3×"},{v:4,l:"4×"}].map(opt=>(
                  <button key={opt.v} onClick={()=>setScale(opt.v)}
                    style={{padding:"2px 7px",borderRadius:14,border:"none",background:scale===opt.v?T.terra:"transparent",color:scale===opt.v?"#fff":T.muted,cursor:"pointer",fontSize:11,fontFamily:sans,fontWeight:scale===opt.v?600:400,transition:"all .12s"}}>
                    {opt.l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ingredients + Steps — responsive stack */}
        <div style={{display:"flex",flexWrap:"wrap"}}>
          <div style={{flex:"0 0 200px",minWidth:0,padding:"16px 18px",borderRight:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,background:T.paper}}>
            <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:T.muted,marginBottom:9}}>Ingredients</div>
            {editing
              ? <>{draft.ingredients.map((ing2,i)=>(
                  <div key={i} style={{display:"flex",gap:3,marginBottom:5,alignItems:"center"}}>
                    <input value={ing2.amount} onChange={e=>updateIng(i,"amount",e.target.value)} placeholder="amt" style={{width:54,fontSize:12,padding:"3px 5px",background:T.surface,color:T.ink}}/>
                    <input value={ing2.name} onChange={e=>updateIng(i,"name",e.target.value)} placeholder="ingredient" style={{flex:1,fontSize:12,padding:"3px 5px",minWidth:0,background:T.surface,color:T.ink}}/>
                    <button className="icon-btn" onClick={()=>removeIng(i)} style={{color:"#C0392B",fontSize:13}}>×</button>
                  </div>
                ))}
                <button className="bg" onClick={addIng} style={{fontSize:12,padding:"3px 8px",marginTop:3}}>+ add</button></>
              : <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:6}}>
                  {ing.map((ing2,i)=>(
                    <li key={i} style={{fontSize:12,lineHeight:1.4}}>
                      <span style={{fontWeight:500,color:T.terra}}>{ing2.amount}</span><br/>
                      <span style={{color:T.ink}}>{ing2.name}</span>
                    </li>
                  ))}
                </ul>
            }
          </div>
          <div style={{flex:"1 1 280px",minWidth:0,padding:"16px 18px"}}>
            <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:T.muted,marginBottom:11}}>Instructions</div>
            {editing
              ? <>{draft.steps.map((step,i)=>{
                    const isDragging = dragStepIdx.current===i;
                    const isOver = dragOverStep===i && dragStepIdx.current!==i;
                    return (
                    <div key={i} draggable
                      onDragStart={()=>onDragStartStep(i)}
                      onDragOver={e=>onDragOverStep(e,i)}
                      onDragEnd={onDragEndStep}
                      onDrop={()=>onDropStep(i)}
                      style={{display:"flex",gap:5,marginBottom:7,alignItems:"flex-start",cursor:"grab",
                        opacity:isDragging?0.4:1,
                        borderRadius:6,
                        padding:"3px 3px 3px 0",
                        background:isOver?"rgba(196,98,45,0.08)":"transparent",
                        borderTop:isOver?`2px dashed ${T.terra}`:"2px solid transparent",
                        transition:"background .1s,border-color .1s"}}>
                      <span title="Drag to reorder" style={{flexShrink:0,fontSize:16,color:isOver?T.terra:T.muted,marginTop:7,lineHeight:1,userSelect:"none",cursor:"grab"}}>⠿</span>
                      <span style={{flexShrink:0,width:19,height:19,borderRadius:"50%",background:isOver?T.terra:T.terraLight,color:isOver?"#fff":T.terra,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,marginTop:5,transition:"background .1s"}}>{i+1}</span>
                      <textarea value={step} onChange={e=>updateStep(i,e.target.value)} style={{flex:1,fontSize:13,minHeight:48,background:T.surface,color:T.ink,cursor:"text",borderColor:isOver?T.terra:T.border}}/>
                      <button className="icon-btn" onClick={()=>removeStep(i)} style={{color:"#C0392B",marginTop:5}}>×</button>
                    </div>
                  );})}
                <button className="bg" onClick={addStep} style={{fontSize:12,padding:"3px 8px",marginTop:3}}>+ add step</button></>
              : <ol style={{listStyle:"none",display:"flex",flexDirection:"column",gap:11}}>
                  {steps.map((step,i)=>(
                    <li key={i} style={{display:"flex",gap:9,fontSize:13,lineHeight:1.6}}>
                      <span style={{flexShrink:0,width:19,height:19,borderRadius:"50%",background:T.terraLight,color:T.terra,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,marginTop:2}}>{i+1}</span>
                      <span style={{color:T.ink}}>{step}</span>
                    </li>
                  ))}
                </ol>
            }
          </div>
        </div>

        {/* Notes */}
        <div style={{padding:"12px 20px",borderTop:`1px solid ${T.border}`,background:T.paper}}>
          <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:T.muted,marginBottom:5}}>Notes</div>
          {editing
            ? <textarea value={draft.notes||""} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Add personal notes, tips, substitutions..." style={{width:"100%",minHeight:60,background:T.surface,color:T.ink}}/>
            : draft.notes
              ? <p style={{fontSize:13,color:T.ink,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{draft.notes}</p>
              : <p style={{fontSize:13,color:T.muted,fontStyle:"italic"}}>No notes yet. Click Edit to add some.</p>
          }
        </div>

        {/* Footer — delete only in edit mode */}
        {editing&&(
          <div style={{padding:"10px 20px",borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"flex-end",gap:8}}>
            <button className="bg" style={{color:"#C0392B",borderColor:"#F5C6BB"}} onClick={()=>{onDelete(recipe.id);onClose();}}>Delete recipe</button>
          </div>
        )}
      </div>
      {showShare&&<ShareModal recipe={recipe} currentUid={currentUid} currentName={currentName} onClose={()=>setShowShare(false)} T={T}/>}
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLDER PANEL

export { RecipeDetail };
