import { useState, useRef, useEffect, useCallback } from "react";
import { useWindowWidth } from "../hooks/useWindowWidth.js";

function Overlay({ onClose, children, zIndex=100 }) {
  const isMob = useWindowWidth() < 640;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:isMob?"0":"20px 16px",overflowY:"auto"}}
      onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      {children}
    </div>
  );
}


export { Overlay };
