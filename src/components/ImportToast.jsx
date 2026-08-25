import { useState, useRef, useEffect, useCallback } from "react";
import { serif, sans } from "../lib/theme.js";

function ImportToast({ importJob, onExpand, T }) {
  const steps = ["Fetching","Extracting","Parsing","Done"];
  const idx = steps.indexOf(importJob.step);
  const pct = importJob.step === "Done" ? 100 : Math.max(10, Math.round(((idx+1)/(steps.length-1))*100));
  return (
    <div onClick={onExpand}
      style={{position:"fixed",bottom:20,right:20,zIndex:500,background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 16px",boxShadow:"0 4px 24px rgba(0,0,0,.2)",cursor:"pointer",minWidth:240,display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1}}>
        <div style={{fontSize:12,fontWeight:500,color:T.ink,marginBottom:6}}>
          {importJob.step==="Done" ? "Recipe ready — click to review" : importJob.label||"Importing recipe…"}
        </div>
        <div style={{height:4,borderRadius:2,background:T.border,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:2,background:importJob.step==="Done"?T.sage:T.terra,width:`${pct}%`,transition:"width .4s ease"}}/>
        </div>
        <div style={{fontSize:10,color:T.muted,marginTop:3}}>
          {importJob.step==="Done" ? "✓ Complete" : `${importJob.step}… ${pct}%`}
        </div>
      </div>
      <span style={{fontSize:11,color:T.muted}}>{importJob.step==="Done"?"→":"↑"}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD RECIPE MODAL — pure UI shell, import logic lives in App via importJob prop

export { ImportToast };
