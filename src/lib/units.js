// ─── Amount scaling helper ────────────────────────────────────────────────────
function scaleAmount(amountStr, scale) {
  if (!amountStr || scale === 1) return amountStr;
  const s = amountStr.trim();
  // Fraction map for display
  const FRACS = { 0.125:"⅛", 0.25:"¼", 0.333:"⅓", 0.5:"½", 0.667:"⅔", 0.75:"¾" };
  const UNICODE_FRACS = { "¼":0.25, "½":0.5, "¾":0.75, "⅓":0.333333, "⅔":0.666667, "⅛":0.125, "⅜":0.375, "⅝":0.625, "⅞":0.875 };
  const fracCharClass = "¼½¾⅓⅔⅛⅜⅝⅞";
  function fmt(n) {
    if (n <= 0) return amountStr;
    const whole = Math.floor(n);
    const frac = n - whole;
    const fracKey = Object.keys(FRACS).find(k => Math.abs(frac - parseFloat(k)) < 0.04);
    if (fracKey && whole === 0) return FRACS[fracKey];
    if (fracKey && whole > 0) return `${whole} ${FRACS[fracKey]}`;
    if (frac < 0.05) return `${whole}`;
    return parseFloat(n.toFixed(2)).toString();
  }
  // Try to find a leading number -- unicode fractions first, then ascii fractions/decimals
  const mixedUnicodeRe = new RegExp(`^(\\d+)\\s*([${fracCharClass}])`);
  const unicodeRe = new RegExp(`^([${fracCharClass}])`);
  const mixedRe = /^(\d+)\s+(\d+)\/(\d+)/;
  const fracRe = /^(\d+)\/(\d+)/;
  const decRe = /^(\d+\.?\d*)/;
  let num = null, rest = "";
  let m;
  if ((m = s.match(mixedUnicodeRe))) { num = parseInt(m[1]) + UNICODE_FRACS[m[2]]; rest = s.slice(m[0].length); }
  else if ((m = s.match(unicodeRe))) { num = UNICODE_FRACS[m[1]]; rest = s.slice(m[0].length); }
  else if ((m = s.match(mixedRe))) { num = parseInt(m[1]) + parseInt(m[2])/parseInt(m[3]); rest = s.slice(m[0].length); }
  else if ((m = s.match(fracRe))) { num = parseInt(m[1])/parseInt(m[2]); rest = s.slice(m[0].length); }
  else if ((m = s.match(decRe))) { num = parseFloat(m[1]); rest = s.slice(m[0].length); }
  if (num === null) return amountStr;
  return fmt(num * scale) + rest;
}

// ─── Measurement conversion ───────────────────────────────────────────────────
function cvt(amount, s) {
  if (!amount || typeof amount !== "string") return amount;
  let r = amount;
  if (s.weight==="imperial") { r=r.replace(/(\d+\.?\d*)\s*kg\b/gi,(_,n)=>{const lb=parseFloat(n)*2.20462;return lb>=1?`${+lb.toFixed(1)} lb`:`${+(parseFloat(n)*35.274).toFixed(1)} oz`;}); r=r.replace(/(\d+\.?\d*)\s*g\b/gi,(_,n)=>{const oz=parseFloat(n)*0.035274;return oz<0.5?`${Math.round(parseFloat(n))}g`:`${+oz.toFixed(1)} oz`;}); }
  else if (s.weight==="metric") { r=r.replace(/(\d+\.?\d*)\s*lb\b/gi,(_,n)=>`${Math.round(parseFloat(n)*453.592)}g`); r=r.replace(/(\d+\.?\d*)\s*oz\b/gi,(_,n)=>`${Math.round(parseFloat(n)*28.3495)}g`); }
  if (s.volume==="imperial") { r=r.replace(/(\d+\.?\d*)\s*ml\b/gi,(_,n)=>{const ml=parseFloat(n);if(ml<=6)return"1 tsp";if(ml<=16)return"1 tbsp";return`${+(ml*0.033814).toFixed(1)} fl oz`;}); r=r.replace(/(\d+\.?\d*)\s*l\b/gi,(_,n)=>`${+(parseFloat(n)*4.22675).toFixed(1)} cups`); }
  else if (s.volume==="metric") { r=r.replace(/(\d+\.?\d*)\s*cups?\b/gi,(_,n)=>`${Math.round(parseFloat(n)*236.588)}ml`); r=r.replace(/(\d+\.?\d*)\s*(?:tbsp|tablespoons?|Tbsp)\b/gi,(_,n)=>`${Math.round(parseFloat(n)*14.7868)}ml`); r=r.replace(/(\d+\.?\d*)\s*(?:tsp|teaspoons?|Tsp)\b/gi,(_,n)=>`${+(parseFloat(n)*4.92892).toFixed(1)}ml`); }
  if (s.temp==="f") r=r.replace(/(\d+)\s*[°]?C\b/g,(_,n)=>`${Math.round(parseInt(n)*9/5+32)}°F`);
  else if (s.temp==="c") r=r.replace(/(\d+)\s*[°]?F\b/g,(_,n)=>`${Math.round((parseInt(n)-32)*5/9)}°C`);
  return r;
}
function applyCvt(ing, steps, s) {
  if (s.weight==="original"&&s.volume==="original"&&s.temp==="original") return {ing,steps};
  return { ing:ing.map(i=>({...i,amount:cvt(i.amount,s)})), steps:steps.map(st=>cvt(st,s)) };
}

// ─── Equipment tag detection ──────────────────────────────────────────────────
// ─── PDF text extraction (client-side, via PDF.js from CDN) ──────────────────
let _pdfjsLoadPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsLoadPromise) return _pdfjsLoadPromise;
  _pdfjsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return _pdfjsLoadPromise;
}
async function extractPdfText(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  const maxPages = Math.min(pdf.numPages, 15); // cap to avoid huge prompts
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ") + "\n\n";
  }
  return text.trim();
}


export { scaleAmount, cvt, applyCvt, loadPdfJs, extractPdfText };
