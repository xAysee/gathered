import { useState, useRef, useEffect, useCallback } from "react";
import { serif, sans } from "../lib/theme.js";

function FolderPanel({ folders, activeFolder, recipes, T, sans, serif, onSelect, onCreate, onDelete, onDrop, onDragOver, dragOverFolder }) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  function submit() {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName(""); setAdding(false);
  }

  function countInFolder(name) {
    return recipes.filter(r => (r.folders||[]).includes(name)).length;
  }

  return (
    <div>
      {/* All Recipes row */}
      <button onClick={()=>onSelect(null)}
        style={{width:"100%",textAlign:"left",padding:"8px 16px",background:activeFolder===null?T.terraLight:"transparent",color:activeFolder===null?T.terra:T.ink,border:"none",cursor:"pointer",fontFamily:sans,fontSize:13,fontWeight:activeFolder===null?600:400,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>📚 All Recipes</span>
        <span style={{fontSize:11,color:activeFolder===null?T.terra:T.muted}}>{recipes.length}</span>
      </button>

      {/* Folder rows */}
      {folders.length>0&&<div style={{borderTop:`1px solid ${T.border}`,marginTop:4,paddingTop:4}}>
        {folders.map(f=>(
          <div key={f} style={{display:"flex",alignItems:"center",group:true}}>
            <button onClick={()=>onSelect(f)}
              onDragOver={e=>{e.preventDefault();onDragOver(f);}}
              onDragLeave={()=>onDragOver(null)}
              onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("recipeId");if(id)onDrop(id,f);onDragOver(null);}}
              style={{flex:1,textAlign:"left",padding:"7px 16px",background:dragOverFolder===f?T.terraLight:activeFolder===f?T.terraLight:"transparent",color:activeFolder===f||dragOverFolder===f?T.terra:T.ink,border:"none",cursor:"pointer",fontFamily:sans,fontSize:13,fontWeight:activeFolder===f?600:400,display:"flex",justifyContent:"space-between",alignItems:"center",minWidth:0,outline:dragOverFolder===f?`2px dashed ${T.terra}`:"none",borderRadius:6,transition:"all .1s"}}>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📁 {f}</span>
              <span style={{fontSize:11,color:activeFolder===f?T.terra:T.muted,flexShrink:0,marginLeft:4}}>{countInFolder(f)}</span>
            </button>
            {confirmDelete===f
              ? <div style={{display:"flex",gap:3,paddingRight:6,flexShrink:0}}>
                  <button onClick={()=>{onDelete(f);setConfirmDelete(null);}} style={{fontSize:10,color:"#C0392B",background:"none",border:`1px solid #C0392B`,borderRadius:4,padding:"1px 5px",cursor:"pointer",fontFamily:sans}}>del</button>
                  <button onClick={()=>setConfirmDelete(null)} style={{fontSize:10,color:T.muted,background:"none",border:`1px solid ${T.border}`,borderRadius:4,padding:"1px 5px",cursor:"pointer",fontFamily:sans}}>no</button>
                </div>
              : <button onClick={()=>setConfirmDelete(f)} style={{flexShrink:0,background:"none",border:"none",color:T.muted,cursor:"pointer",padding:"0 8px 0 0",fontSize:13,opacity:0.5}}>×</button>
            }
          </div>
        ))}
      </div>}

      {/* Add folder */}
      <div style={{borderTop:`1px solid ${T.border}`,marginTop:6,paddingTop:6,padding:"6px 12px 10px"}}>
        {adding
          ? <div style={{display:"flex",gap:5}}>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Folder name"
                autoFocus onKeyDown={e=>{if(e.key==="Enter")submit();if(e.key==="Escape"){setAdding(false);setNewName("");}}}
                style={{flex:1,fontSize:12,padding:"4px 8px",background:T.surface,color:T.ink}}/>
              <button className="bp" onClick={submit} style={{padding:"4px 8px",fontSize:12}}>+</button>
            </div>
          : <button onClick={()=>setAdding(true)}
              style={{fontSize:12,color:T.muted,background:"none",border:`1px dashed ${T.border}`,borderRadius:6,padding:"5px 10px",cursor:"pointer",width:"100%",fontFamily:sans,textAlign:"left"}}>
              + New folder
            </button>
        }
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT TOAST — lives outside modal, always visible when import is running

export { FolderPanel };
