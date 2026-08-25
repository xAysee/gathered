import { useState, useRef, useEffect, useCallback } from "react";
import { serif, sans } from "../lib/theme.js";
import { Overlay } from "./Overlay.jsx";

function SettingsModal({ settings, onChange, onClose, trash, onRestore, T }) {
  const [tab, setTab] = useState("prefs");
  const Row = ({label,desc,k,opts})=>(
    <div className="srow">
      <div><div style={{fontSize:14,fontWeight:500,color:T.ink}}>{label}</div>{desc&&<div style={{fontSize:11,color:T.muted,marginTop:1}}>{desc}</div>}</div>
      <select value={settings[k]} onChange={e=>onChange({...settings,[k]:e.target.value})} style={{background:T.surface,color:T.ink}}>{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
    </div>
  );
  const now = Date.now();
  const validTrash = trash.filter(r=>{ const age=(now-new Date(r.deletedAt).getTime())/(1000*60*60*24); return age<=30; });

  return (
    <Overlay onClose={onClose} zIndex={200}>
      <div className="card fi" style={{width:"100%",maxWidth:460,marginBottom:24,background:T.surface}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{fontFamily:serif,fontSize:18,color:T.ink}}>Settings</h3>
          <button className="bg" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`}}>
          {["prefs","trash"].map(t=>(
            <button key={t} className={`nav-btn${tab===t?" active":""}`} onClick={()=>setTab(t)} style={{flex:1,textAlign:"center",fontSize:13}}>
              {t==="prefs"?"Preferences":`🗑 Recycle Bin (${validTrash.length})`}
            </button>
          ))}
        </div>
        {tab==="prefs"&&<div style={{padding:"4px 20px 10px"}}>
          <p style={{fontSize:11,color:T.muted,padding:"12px 0 6px",textTransform:"uppercase",letterSpacing:".06em"}}>Appearance</p>
          <div className="srow">
            <div><div style={{fontSize:14,fontWeight:500,color:T.ink}}>Theme</div></div>
            <div style={{display:"flex",gap:0,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
              {[{v:"light",l:"☀ Light"},{v:"system",l:"⚙ System"},{v:"dark",l:"🌙 Dark"}].map(opt=>(
                <button key={opt.v} onClick={()=>onChange({...settings,dark:opt.v})}
                  style={{padding:"6px 12px",fontSize:12,background:settings.dark===opt.v?T.terra:"transparent",color:settings.dark===opt.v?"#fff":T.muted,border:"none",cursor:"pointer",fontFamily:sans,fontWeight:settings.dark===opt.v?500:400,transition:"all .15s"}}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
          <Row label="Week starts on" k="weekStart" opts={[{v:"sun",l:"Sunday"},{v:"mon",l:"Monday"}]}/>
          <p style={{fontSize:11,color:T.muted,padding:"12px 0 4px",textTransform:"uppercase",letterSpacing:".06em"}}>Measurements</p>
          <p style={{fontSize:12,color:T.muted,marginBottom:7}}>Conversions apply when viewing. Originals preserved.</p>
          <Row label="Weight" desc="g, kg, oz, lb" k="weight" opts={[{v:"original",l:"Original"},{v:"metric",l:"Metric (g/kg)"},{v:"imperial",l:"Imperial (oz/lb)"}]}/>
          <Row label="Volume" desc="ml, L, cups, tsp" k="volume" opts={[{v:"original",l:"Original"},{v:"metric",l:"Metric (ml/L)"},{v:"imperial",l:"Imperial (cups)"}]}/>
          <Row label="Temperature" desc="°C / °F" k="temp" opts={[{v:"original",l:"Original"},{v:"c",l:"Celsius"},{v:"f",l:"Fahrenheit"}]}/>
          <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between"}}>
            <button className="bg" onClick={()=>onChange({...settings,weight:"original",volume:"original",temp:"original"})}>Reset measurements</button>
            <button className="bp" onClick={onClose}>Done</button>
          </div>
        </div>}
        {tab==="trash"&&<div style={{padding:"12px 20px"}}>
          {validTrash.length===0
            ? <p style={{color:T.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Recycle bin is empty. Deleted recipes appear here for 30 days.</p>
            : validTrash.map(r=>{
              const daysLeft = Math.ceil(30 - (now-new Date(r.deletedAt).getTime())/(1000*60*60*24));
              return (
                <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.border}`,gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{r.title}</div>
                    <div style={{fontSize:11,color:T.muted}}>Deleted · {daysLeft} day{daysLeft!==1?"s":""} left</div>
                  </div>
                  <button className="bg" style={{fontSize:12,padding:"4px 10px"}} onClick={()=>onRestore(r.id)}>Restore</button>
                </div>
              );
            })
          }
        </div>}
      </div>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEAL PLAN PAGE

export { SettingsModal };
