/**
 * RefBadge — etiqueta colorida do indexante Euribor (3m/6m/12m).
 * Registado em window._SIM (usado por comp-table-desktop e vistas).
 */
;(function(){
"use strict";
if(!window.React)return;
const React=window.React;

function RefBadge({refKey}){
  const {EUR_COLORS,Au}=window._SIM||{};
  const[c,bg]=EUR_COLORS[refKey]||[Au,"rgba(37,99,235,0.18)"];
  return (React.createElement("span", {style: {display:"inline-block",background:bg,border:"1px solid "+c,borderRadius:4,padding:"2px 6px",fontSize:11,fontFamily:"monospace",fontWeight:700,color:c}}, "Eur."+refKey));
}

window._SIM=Object.assign(window._SIM||{},{RefBadge});
})();
