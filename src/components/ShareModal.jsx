import { useState, useRef, useEffect, useCallback } from "react";
import { serif, sans } from "../lib/theme.js";
import { sbCheckUserExists, sbShareRecipe } from "../lib/auth.js";
import { recipeToText, encodeShareLink } from "../lib/sharing.js";
import { Overlay } from "./Overlay.jsx";

function ShareModal({ recipe, currentUid, currentName, onClose, T }) {
  const [tab, setTab] = useState("user"); // user | link | text
  const [toEmail, setToEmail] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const shareLink = encodeShareLink(recipe);
  const shareText = recipeToText(recipe);

  async function sendToUser() {
    setStatus("");
    const key = toEmail.trim().toLowerCase();
    if (!key.includes("@")) { setStatus("Enter a valid email address."); return; }
    if (key === currentUid) { setStatus("That's your own email!"); return; }
    setStatus("Sending...");
    try {
      const exists = await sbCheckUserExists(key);
      if (!exists) { setStatus("No myrecipecards account found for that email. They need to sign up first."); return; }
      await sbShareRecipe(key, recipe, currentName, currentUid);
      setStatus("✓ Sent! They'll see it next time they open the app.");
      setToEmail("");
    } catch(e) {
      console.error(e);
      setStatus("Couldn't send. Please try again.");
    }
  }

  function copyLink() {
    if (!shareLink) { setStatus("Link too large — try sharing via user instead."); return; }
    navigator.clipboard.writeText(shareLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  }
  function copyText() {
    navigator.clipboard.writeText(shareText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  }

  const tabs = [{id:"user",l:"👤 Send to user"},{id:"link",l:"🔗 Share link"},{id:"text",l:"📋 Copy text"}];

  return (
    <Overlay onClose={onClose} zIndex={200}>
      <div className="card fi" style={{width:"100%",maxWidth:460,marginBottom:24,background:T.surface}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h3 style={{fontFamily:serif,fontSize:18,color:T.ink}}>Share recipe</h3>
            <p style={{fontSize:12,color:T.muted,marginTop:2}}>{recipe.title}</p>
          </div>
          <button className="bg" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`}}>
          {tabs.map(t=><button key={t.id} onClick={()=>{setTab(t.id);setStatus("");setCopied(false);}}
            className={"nav-btn"+(tab===t.id?" active":"")} style={{flex:1,fontSize:12,padding:"9px 4px",textAlign:"center"}}>{t.l}</button>)}
        </div>
        <div style={{padding:"16px 20px"}}>
          {tab==="user"&&<>
            <p style={{fontSize:13,color:T.muted,marginBottom:12,lineHeight:1.5}}>
              Send this recipe directly to another <em>myrecipecards</em> user. It will appear in their inbox the next time they open the app.
            </p>
            <div style={{display:"flex",gap:8}}>
              <input value={toEmail} onChange={e=>setToEmail(e.target.value)} placeholder="their@email.com"
                style={{flex:1,background:T.surface,color:T.ink}} type="email"
                onKeyDown={e=>e.key==="Enter"&&sendToUser()}/>
              <button className="bp" onClick={sendToUser} style={{padding:"8px 16px"}}>Send</button>
            </div>
            {status&&<p style={{fontSize:12,marginTop:8,color:status.startsWith("✓")?T.sage:"#C0392B"}}>{status}</p>}
          </>}

          {tab==="link"&&<>
            <p style={{fontSize:13,color:T.muted,marginBottom:12,lineHeight:1.5}}>
              Anyone with this link can open the app and import this recipe — even without an account.
              {recipe.image&&!recipe.image.startsWith("http")&&<span style={{color:T.terra}}> Note: locally-uploaded photos are not included in the link.</span>}
            </p>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input readOnly value={shareLink||"Recipe too large for a link"} style={{flex:1,background:T.paper,color:T.muted,fontSize:12}}/>
              <button className="bp" onClick={copyLink} style={{padding:"8px 14px",flexShrink:0}}>
                {copied?"✓ Copied!":"Copy link"}
              </button>
            </div>
            {shareLink&&(
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <a href={`mailto:?subject=${encodeURIComponent("Recipe: "+recipe.title)}&body=${encodeURIComponent("I wanted to share this recipe with you!\n\n"+shareLink)}`}
                  style={{textDecoration:"none"}}><button className="bg" style={{fontSize:12}}>📧 Email link</button></a>
                <a href={`sms:?body=${encodeURIComponent(recipe.title+" recipe: "+shareLink)}`}
                  style={{textDecoration:"none"}}><button className="bg" style={{fontSize:12}}>💬 Text link</button></a>
              </div>
            )}
          </>}

          {tab==="text"&&<>
            <p style={{fontSize:13,color:T.muted,marginBottom:10,lineHeight:1.5}}>
              Copy the recipe as formatted text to paste anywhere — email, notes, messages.
            </p>
            <pre style={{background:T.paper,borderRadius:7,padding:"10px 12px",fontSize:11,lineHeight:1.6,color:T.ink,whiteSpace:"pre-wrap",maxHeight:260,overflowY:"auto",border:`1px solid ${T.border}`}}>
              {shareText}
            </pre>
            <button className="bp" onClick={copyText} style={{width:"100%",marginTop:10}}>
              {copied?"✓ Copied to clipboard!":"Copy recipe text"}
            </button>
          </>}
        </div>
      </div>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS MODAL// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS MODAL

export { ShareModal };
