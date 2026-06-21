/**
 * Modal «Histórico» — últimas simulações guardadas (restaurar/apagar).
 * Componente extraído de app.js — sem hooks próprios; estado vem por props.
 */
;(function(){
"use strict";
if(!window.React)return;
const React=window.React;
const IS_MOBILE=!!(window._SIM_SHARED&&window._SIM_SHARED.isMobileDevice);

function HistModal(props){
  const {R,Sky}=window._SIM||{};
  const {histSaved,onClose,onDelete}=props;
  return (React.createElement("div", {style:{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center"},onClick:onClose},
            React.createElement("div", {style:{background:"#fff",borderRadius:14,padding:20,maxWidth:520,width:"calc(100% - 32px)",maxHeight:"80vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"},onClick:e=>e.stopPropagation()},
              React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}},
                React.createElement("div", {style:{fontSize:12,letterSpacing:2,color:Sky,fontFamily:"monospace",fontWeight:700}}, "HISTÓRICO — ÚLTIMAS SIMULAÇÕES GUARDADAS"),
                React.createElement("button", {onClick:onClose,"aria-label":"Fechar histórico",style:{background:"none",border:"none",fontSize:28,fontWeight:800,cursor:"pointer",color:"#dc2626",padding:"4px 8px",borderRadius:6,lineHeight:1,flexShrink:0}}, "×")
              ),
              histSaved.map((h,i)=>React.createElement("div", {key:h.ts,style:{display:"flex",alignItems:"center",gap:8,padding:"10px 0",borderBottom:i<histSaved.length-1?"1px solid rgba(0,0,0,0.08)":"none"}},
                React.createElement("div", {style:{flex:1,fontSize:12,color:"#111827"}},
                  React.createElement("div", {style:{fontWeight:500,marginBottom:2}}, h.label),
                  React.createElement("div", {style:{fontSize:11,color:"#4b5563"}}, new Date(h.ts).toLocaleString("pt-PT"))
                ),
                React.createElement("a", {href:h.url,style:{padding:"5px 12px",background:"rgba(2,132,199,0.1)",border:"1px solid rgba(2,132,199,0.3)",borderRadius:6,color:Sky,fontSize:12,textDecoration:"none",cursor:"pointer",whiteSpace:"nowrap"}}, "Restaurar"),
                React.createElement("button", {onClick:()=>onDelete(i),style:{padding:"5px 8px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:6,color:R,fontSize:12,cursor:"pointer"},"aria-label":"Apagar simulação"}, "✕")
              ))
            )
          ));
}
window.HistModal=HistModal;
})();
