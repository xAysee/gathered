import { useState, useRef, useEffect, useCallback } from "react";
import { serif, sans } from "../lib/theme.js";
import { supabase } from "../lib/supabase.js";
import { sbRequestCode, sbVerifyCode, sbEnsureUserRow, sbCheckUserExists } from "../lib/auth.js";
import { Dots } from "./Dots.jsx";

function AuthScreen({ T, onLogin }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [step, setStep] = useState("email"); // email | code
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  async function requestCode() {
    setErr(""); setInfo("");
    const key = email.trim().toLowerCase();
    if (!key.includes("@")) { setErr("Enter a valid email address."); return; }
    if (mode === "signup" && !name.trim()) { setErr("Please enter your name."); return; }
    setLoading(true);
    try {
      // All validation + email sending happens server-side
      await sbRequestCode(key, name.trim(), mode);
      setStep("code");
      setInfo("A 6-digit code was sent to " + key + ". Check your inbox (and spam folder).");
    } catch(e) {
      console.error("Send error:", e);
      setErr(e.message || "Couldn't send the email. Please try again.");
    }
    setLoading(false);
  }

  async function verifyCode() {
    setErr(""); setLoading(true);
    const key = email.trim().toLowerCase();
    try {
      // Verification happens server-side -- returns session tokens directly over HTTPS
      const user = await sbVerifyCode(key, codeInput);
      if (user) {
        // Session is set -- ensure user row exists and log in
        const userRow = await sbEnsureUserRow({ id: user.id, email: user.email, user_metadata: { name: user.name } });
        onLogin(userRow);
      }
    } catch(e) {
      console.error("Verify error:", e);
      setErr(e.message || "Incorrect or expired code. Please check and try again.");
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true); setErr("");
    const key = email.trim().toLowerCase();
    try {
      await sbRequestCode(key, name.trim(), mode);
      setInfo("A new code was sent to " + key + ".");
    } catch(e) {
      console.error(e);
      setErr(e.message || "Couldn't resend. Please try again.");
    }
    setResending(false);
  }

  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div className="card fi" style={{width:"100%",maxWidth:400}}>
        <div style={{padding:"28px 28px 10px",textAlign:"center"}}>
          <h1 style={{fontFamily:serif,fontSize:28,marginBottom:4}}>
            <span style={{color:T.muted}}>my</span><span style={{color:T.terra}}>recipe</span><span style={{color:T.sage}}>cards</span>
          </h1>
          <p style={{fontSize:13,color:T.muted}}>Your personal recipe collection</p>
        </div>
        <div style={{padding:"16px 28px 28px",display:"flex",flexDirection:"column",gap:11}}>
          {step==="email"&&<>
            <div style={{display:"flex",gap:0,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",marginBottom:2}}>
              {[["login","Log in"],["signup","Sign up"]].map(([m,l])=>(
                <button key={m} onClick={()=>{setMode(m);setErr("");}}
                  style={{flex:1,padding:"8px 0",fontSize:13,background:mode===m?T.terraBtn:"transparent",color:mode===m?"#fff":T.muted,border:"none",cursor:"pointer",fontFamily:sans,fontWeight:mode===m?500:400}}>
                  {l}
                </button>
              ))}
            </div>
            {mode==="signup"&&<input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={{width:"100%",background:T.surface,color:T.ink}}/>}
            <input placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} style={{width:"100%",background:T.surface,color:T.ink}} type="email"
              onKeyDown={e=>e.key==="Enter"&&requestCode()}/>
            {err&&<p style={{fontSize:12,color:"#C0392B"}}>{err}</p>}
            <button className="bp" onClick={requestCode} disabled={loading} style={{width:"100%",marginTop:2}}>
              {loading?<Dots/>:(mode==="login"?"Send login code":"Create account")}
            </button>
          </>}
          {step==="code"&&<>
            <div style={{padding:"10px 14px",background:T.paper,borderRadius:8,fontSize:13,color:T.muted,lineHeight:1.5}}>
              {info}
            </div>
            <input placeholder="Enter 6-digit code" value={codeInput} onChange={e=>setCodeInput(e.target.value.replace(/\D/g,"").slice(0,6))}
              style={{width:"100%",background:T.surface,color:T.ink,fontSize:22,textAlign:"center",letterSpacing:"0.3em",fontFamily:serif}}
              onKeyDown={e=>e.key==="Enter"&&verifyCode()}/>
            {err&&<p style={{fontSize:12,color:"#C0392B"}}>{err}</p>}
            <button className="bp" onClick={verifyCode} disabled={loading} style={{width:"100%"}}>{loading?<Dots/>:"Verify & continue"}</button>
            <button className="bg" onClick={resend} disabled={resending} style={{width:"100%",fontSize:13}}>
              {resending?<Dots/>:"Resend code"}
            </button>
            <button className="bg" style={{width:"100%",fontSize:12}} onClick={()=>{setStep("email");setCodeInput("");setErr("");}}>
              Use a different email
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECIPE CARD

export { AuthScreen };
