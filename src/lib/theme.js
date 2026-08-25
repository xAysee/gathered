export function getTheme(dark) {
  return dark ? {
    bg:"#11171A", surface:"#1A2226", paper:"#202A2E", border:"#34434A",
    terra:"#5FC9C2", terraBtn:"#157570", terraLight:"#1C3635", ink:"#EDF5F4", muted:"#A8BEBD",
    sage:"#B8D08A", sageLight:"#222B1C", sageTagBg:"#B8D08A", sageTagText:"#222B1C", white:"#1A2226", cream:"#11171A",
  } : {
    bg:"#F6FAFA", surface:"#FFFFFF", paper:"#E9F2F1", border:"#CFE3E1",
    terra:"#0E6B68", terraBtn:"#0E6B68", terraLight:"#D6ECEA", ink:"#1B2625", muted:"#5B7271",
    sage:"#56652E", sageLight:"#E7EBD8", sageTagBg:"#E7EBD8", sageTagText:"#56652E", white:"#FFFFFF", cream:"#F7FAF9",
  };
}
export const serif = "'Source Serif 4', Georgia, serif";
export const sans = "'Inter', system-ui, sans-serif";

export function makeCSS(T) { return `
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=Inter:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg};color:${T.ink};font-family:${sans}}
input,textarea,select{font-family:${sans};font-size:14px;padding:8px 12px;border:1px solid ${T.border};border-radius:6px;background:${T.surface};color:${T.ink};outline:none;transition:border-color .15s}
input:focus,textarea:focus,select:focus{border-color:${T.terra}}
textarea{resize:vertical;min-height:60px}
button{font-family:${sans};cursor:pointer;border:none;border-radius:6px;transition:all .15s}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
.tag{display:inline-block;font-size:11px;font-weight:500;letter-spacing:.04em;text-transform:uppercase;padding:3px 9px;border-radius:20px;background:${T.sageTagBg};color:${T.sageTagText}}
.tag.t2{background:${T.terraLight};color:${T.terra}}
.bp{background:${T.terraBtn};color:#fff;padding:9px 18px;font-size:14px;font-weight:500}
.bp:hover{filter:brightness(1.1)}.bp:disabled{opacity:.5;cursor:not-allowed}
.bg{background:transparent;color:${T.ink};padding:8px 14px;font-size:13px;border:1px solid ${T.muted}}
.bg:hover{background:${T.paper}}
.card{background:${T.surface};border:1px solid ${T.border};border-radius:10px;overflow:hidden}
.ld{display:inline-block;width:5px;height:5px;border-radius:50%;background:${T.terra};animation:_pulse 1.2s ease-in-out infinite}
.ld:nth-child(2){animation-delay:.2s}.ld:nth-child(3){animation-delay:.4s}
@keyframes _pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
@keyframes _fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fi{animation:_fadeIn .25s ease forwards}
.srow{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid ${T.border}}
.srow:last-child{border-bottom:none}
.nav-btn{background:transparent;border:none;padding:8px 16px;font-size:14px;color:${T.muted};border-bottom:2px solid transparent;border-radius:0;font-weight:500}
.nav-btn.active{color:${T.terra};border-bottom-color:${T.terra}}
.nav-btn:hover{color:${T.terra};background:${T.terraLight}}
.icon-btn{background:none;border:none;padding:3px;color:${T.muted};font-size:15px;line-height:1}
.icon-btn:hover{color:${T.ink}}
`; }
