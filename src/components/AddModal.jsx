import { useState, useRef, useEffect, useCallback } from "react";
import { serif, sans } from "../lib/theme.js";
import { splitIngredients } from "../lib/ingredients.js";
import { loadPdfJs, extractPdfText } from "../lib/units.js";
import { Dots } from "./Dots.jsx";
import { Overlay } from "./Overlay.jsx";
import { ImportToast } from "./ImportToast.jsx";

function AddModal({ onClose, T, importJob, onStartImport }) {
  const [mode, setMode] = useState("url");
  const [urlInput, setUrlInput] = useState("");
  const [files, setFiles] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);
  const fileRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [manual, setManual] = useState({title:"",description:"",prepTime:"",cookTime:"",servings:"",tags:"",notes:"",ingredients:"",steps:""});

  const loading = importJob?.loading || false;
  const error = importJob?.error || "";
  const parsed = importJob?.parsed || null;

  async function openCamera() {
    try { const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}); setCameraStream(s); setCameraOpen(true); setTimeout(()=>{if(videoRef.current){videoRef.current.srcObject=s;videoRef.current.play();}},80); }
    catch { onStartImport({type:"error",error:"Camera unavailable. Upload a file instead."}); }
  }
  function closeCamera() { if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop()); setCameraStream(null); setCameraOpen(false); }
  function snap() {
    const v=videoRef.current,cv=canvasRef.current; if(!v||!cv)return;
    cv.width=v.videoWidth;cv.height=v.videoHeight;cv.getContext("2d").drawImage(v,0,0);
    const img=cv.toDataURL("image/jpeg",.85);
    setCapturedImage(img); closeCamera();
    // Kick off photo import immediately
    onStartImport({type:"photo", imgSrc:img});
  }

  async function readFiles() {
    const imgFile=files.find(f=>f.type.startsWith("image/")), docFile=files.find(f=>!f.type.startsWith("image/"));
    const parts=[]; let imgSrc=null;
    if(imgFile){imgSrc=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(imgFile)});parts.push({type:"image",source:{type:"base64",media_type:imgFile.type,data:imgSrc.split(",")[1]}});}
    if(docFile){
      if(docFile.type==="application/pdf"){
        try {
          const pdfText = await extractPdfText(docFile);
          parts.push({type:"text",text:`Document (PDF):\n${pdfText}`.slice(0,14000)});
        } catch(e) {
          onStartImport({type:"error", error:"Couldn\'t read the PDF. Try a different file or paste the recipe text directly."});
          return;
        }
      } else {
        const txt=await docFile.text();
        parts.push({type:"text",text:`Document:\n${txt}`.slice(0,14000)});
      }
    }
    parts.push({type:"text",text:"Extract the recipe."});
    onStartImport({type:"parts", parts, imgSrc});
  }

  async function pasteImageFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const imgSrc = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
          onStartImport({type:"photo", imgSrc});
          return;
        }
      }
      alert("No image found in clipboard. Copy an image first then try again.");
    } catch(e) {
      alert("Could not access clipboard. Make sure you have granted clipboard permission.");
    }
  }

  // Auto-minimize on outside click when loading
  function handleOverlayClose() {
    if (loading) { /* just close the overlay — import continues via importJob in App */ onClose(); }
    else onClose();
  }

  const modes=[{id:"url",l:"URL / Paste"},{id:"manual",l:"Manual"},{id:"image",l:"Upload file"},{id:"camera",l:"📷 Camera"}];
  const progressSteps=["Fetching","Extracting","Parsing"];
  const stepIdx=progressSteps.indexOf(importJob?.step||"");
  const pct=loading?Math.max(10,Math.round(((stepIdx+1)/progressSteps.length)*100)):0;

  return (
    <Overlay onClose={handleOverlayClose}>
      <div className="card fi" style={{width:"100%",maxWidth:540,marginBottom:24,background:T.surface}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{fontFamily:serif,fontSize:18,color:T.ink}}>Add a recipe</h3>
          <div style={{display:"flex",gap:6}}>
            {loading&&<button className="bg" style={{fontSize:12,padding:"5px 10px"}} onClick={onClose}>Minimize ↓</button>}
            <button className="bg" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Progress bar */}
        {loading&&(
          <div style={{padding:"8px 18px",borderBottom:`1px solid ${T.border}`,background:T.paper}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:11,color:T.muted}}>{importJob?.label||"Working…"}</span>
              <span style={{fontSize:11,color:T.terra,fontWeight:500}}>{pct}%</span>
            </div>
            <div style={{height:5,borderRadius:3,background:T.border,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:3,background:T.terra,width:`${pct}%`,transition:"width .5s ease"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              {progressSteps.map((s,i)=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:3}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:i<=stepIdx?T.terra:T.border,transition:"background .3s"}}/>
                  <span style={{fontSize:9,color:i<=stepIdx?T.terra:T.muted,textTransform:"uppercase",letterSpacing:".05em"}}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{padding:"14px 18px"}}>
          {!parsed&&!loading&&<div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
            {modes.map(m=><button key={m.id} onClick={()=>{setMode(m.id);}}
              style={{padding:"5px 11px",fontSize:12,borderRadius:20,border:`1px solid ${mode===m.id?T.terra:T.border}`,background:mode===m.id?T.terraLight:"transparent",color:mode===m.id?T.terra:T.muted,cursor:"pointer",fontFamily:sans}}>{m.l}</button>)}
          </div>}

          {!parsed&&!loading&&<>
            {mode==="url"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
              <textarea value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="Paste a recipe URL or full recipe text..." style={{minHeight:100,width:"100%",background:T.surface,color:T.ink}}/>
              <button className="bp" onClick={()=>onStartImport({type:"url",text:urlInput})} disabled={!urlInput.trim()} style={{alignSelf:"flex-end"}}>Extract →</button>
            </div>}
            {mode==="image"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
              <div onClick={()=>fileRef.current.click()} style={{border:`2px dashed ${T.border}`,borderRadius:8,padding:"22px 14px",textAlign:"center",cursor:"pointer",background:T.paper}}>
                <div style={{fontSize:24,marginBottom:5}}>📎</div>
                {files.length?<p style={{fontSize:13,color:T.ink}}>{files.map(f=>f.name).join(", ")}</p>:<><p style={{fontSize:13,color:T.muted}}>Upload image, PDF, or Word doc</p><p style={{fontSize:11,color:T.muted,marginTop:2}}>JPG, PNG, PDF, DOCX</p></>}
              </div>
              <input ref={fileRef} type="file" accept="image/*,.pdf,.docx,.doc,.txt" multiple style={{display:"none"}} onChange={e=>{setFiles(Array.from(e.target.files));}}/>
              <div style={{display:"flex",gap:7,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
                <button className="bg" onClick={pasteImageFromClipboard} style={{fontSize:12}}>📋 Paste image from clipboard</button>
                {files.length>0&&<button className="bp" onClick={readFiles} style={{alignSelf:"flex-end"}}>Read & extract →</button>}
              </div>
            </div>}
            {mode==="camera"&&<div style={{display:"flex",flexDirection:"column",gap:9,alignItems:"center"}}>
              {!cameraOpen&&!capturedImage&&<button className="bp" onClick={openCamera} style={{padding:"11px 22px",fontSize:15}}>📷 Open Camera</button>}
              {cameraOpen&&<div style={{width:"100%"}}><video ref={videoRef} autoPlay playsInline style={{width:"100%",borderRadius:8,background:"#000"}}/><canvas ref={canvasRef} style={{display:"none"}}/>
                <div style={{display:"flex",gap:7,justifyContent:"center",marginTop:7}}>
                  <button className="bp" onClick={snap}>📸 Snap</button>
                  <button className="bg" onClick={closeCamera}>Cancel</button>
                </div></div>}
            </div>}
            {mode==="manual"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
              <input placeholder="Recipe title" value={manual.title} onChange={e=>setManual({...manual,title:e.target.value})} style={{width:"100%",background:T.surface,color:T.ink}}/>
              <textarea placeholder="Short description" value={manual.description} onChange={e=>setManual({...manual,description:e.target.value})} style={{minHeight:44,width:"100%",background:T.surface,color:T.ink}}/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3, minmax(0, 1fr))",gap:6}}>
                {[["prepTime","Prep"],["cookTime","Cook"],["servings","Serves"]].map(([k,p])=><input key={k} placeholder={p} value={manual[k]} onChange={e=>setManual({...manual,[k]:e.target.value})} style={{background:T.surface,color:T.ink,width:"100%",minWidth:0,padding:"8px 8px"}}/>)}
              </div>
              <input placeholder="Tags: italian, pasta, vegetarian" value={manual.tags} onChange={e=>setManual({...manual,tags:e.target.value})} style={{width:"100%",background:T.surface,color:T.ink}}/>
              <textarea placeholder={"Ingredients:\n2 cups flour\n1 tsp salt"} value={manual.ingredients} onChange={e=>setManual({...manual,ingredients:e.target.value})} style={{minHeight:80,width:"100%",background:T.surface,color:T.ink}}/>
              <textarea placeholder={"Steps:\n1. Preheat oven...\n2. Mix..."} value={manual.steps} onChange={e=>setManual({...manual,steps:e.target.value})} style={{minHeight:80,width:"100%",background:T.surface,color:T.ink}}/>
              <textarea placeholder="Notes or tips (optional)" value={manual.notes} onChange={e=>setManual({...manual,notes:e.target.value})} style={{minHeight:44,width:"100%",background:T.surface,color:T.ink}}/>
              <button className="bp" onClick={()=>onStartImport({type:"manual",manual})} disabled={!manual.title.trim()} style={{alignSelf:"flex-end"}}>Preview →</button>
            </div>}
          </>}

          {loading&&!parsed&&<div style={{textAlign:"center",padding:"24px 0",color:T.muted,fontSize:13}}>
            <Dots/> &nbsp; {importJob?.label||"Importing…"}
          </div>}

          {error&&<div style={{marginTop:8,padding:"8px 12px",background:"#FEF2F2",borderRadius:6,border:"1px solid #FECACA",color:"#991B1B",fontSize:13}}>{error}</div>}

          {parsed&&<div className="fi">
            {importJob?.capturedImage&&<div style={{marginBottom:9,borderRadius:7,overflow:"hidden",maxHeight:150}}><img src={importJob.capturedImage} style={{width:"100%",objectFit:"cover",maxHeight:150}}/></div>}
            <div style={{padding:"11px 13px",background:T.paper,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:11}}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>{(parsed.tags||[]).map((t,i)=><span key={t} style={{display:"inline-block",fontSize:11,fontWeight:500,letterSpacing:".04em",textTransform:"uppercase",padding:"3px 9px",borderRadius:20,background:i%2?T.terraLight:T.sageTagBg,color:i%2?T.terra:T.sageTagText}}>{t}</span>)}</div>
              <h4 style={{fontFamily:serif,fontSize:16,fontWeight:600,marginBottom:3,color:T.ink}}>{parsed.title}</h4>
              <p style={{fontSize:12,color:T.muted}}>{parsed.description}</p>
              <div style={{marginTop:7,display:"flex",gap:11,fontSize:11,color:T.muted}}>
                {parsed.prepTime&&<span>⏱ {parsed.prepTime}</span>}{parsed.cookTime&&<span>🍳 {parsed.cookTime}</span>}{parsed.servings&&<span>👤 {parsed.servings}</span>}
              </div>
              <div style={{marginTop:5,fontSize:11,color:T.muted}}>
                <strong>{parsed.ingredients?.length||0}</strong> ingredients · <strong>{parsed.steps?.length||0}</strong> steps{parsed.notes?" · notes included":""}
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <button className="bg" onClick={()=>onStartImport({type:"reset"})}>← Retry</button>
              <button className="bp" onClick={()=>{ onStartImport({type:"save"}); }}>Save to cookbook →</button>
            </div>
          </div>}
        </div>
      </div>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARE MODAL

export { AddModal };
