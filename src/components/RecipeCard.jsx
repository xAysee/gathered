import { useState, useRef, useEffect, useCallback } from "react";
import { serif, sans } from "../lib/theme.js";

function RecipeCard({ recipe, onClick, T }) {
  return (
    <div className="card fi" onClick={()=>onClick(recipe)}
      draggable
      onDragStart={e=>{e.dataTransfer.setData("recipeId", recipe.id); e.dataTransfer.effectAllowed="copy";}}
      style={{cursor:"pointer",transition:"transform .15s,box-shadow .15s",display:"flex",flexDirection:"column",height:"100%",background:T.surface,border:`1px solid ${T.border}`}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,.12)"}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
      {recipe.image
        ? <div style={{height:160,flexShrink:0,overflow:"hidden",borderBottom:`1px solid ${T.border}`}}><img src={recipe.image} alt={recipe.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
        : <div style={{height:80,flexShrink:0,background:T.paper,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>🍽️</div>
      }
      <div style={{padding:"12px 14px",flex:1,display:"flex",flexDirection:"column",background:T.surface}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
          {recipe.tags.slice(0,3).map((t,i)=><span key={t} style={{display:"inline-block",fontSize:11,fontWeight:500,letterSpacing:".04em",textTransform:"uppercase",padding:"3px 9px",borderRadius:20,background:i%2?T.terraLight:T.sageTagBg,color:i%2?T.terra:T.sageTagText}}>{t}</span>)}
        </div>
        <h3 style={{fontFamily:serif,fontSize:16,fontWeight:600,marginBottom:4,color:T.ink}}>{recipe.title}</h3>
        <p style={{fontSize:12,color:T.muted,lineHeight:1.5,marginBottom:8}}>{recipe.description}</p>
        <div style={{display:"flex",gap:12,fontSize:11,color:T.muted,marginTop:"auto"}}>
          {recipe.prepTime&&<span>⏱ {recipe.prepTime}</span>}
          {recipe.cookTime&&<span>🍳 {recipe.cookTime}</span>}
          {recipe.servings&&<span>👤 {recipe.servings}</span>}
        </div>
      </div>
      <div style={{flexShrink:0,background:T.paper,padding:"7px 14px",borderTop:`1px solid ${T.border}`,fontSize:11,color:T.muted}}>
        <strong style={{color:T.ink}}>{recipe.ingredients.length}</strong> ingredients
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECIPE DETAIL / EDIT

export { RecipeCard };
