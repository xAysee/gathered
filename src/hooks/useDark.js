import { useState, useEffect } from "react";

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


export { useDark };
