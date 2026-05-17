;(function(){
  'use strict';
  if(!window.React||!window._SIM)return;
  var React=window.React;
  var h=React.createElement;
  var Au=window._SIM.Au;
  var Sky=window._SIM.Sky;
  var FALLBACK_EUR=window._SIM.FALLBACK_EUR;
  var EUR_COLORS=window._SIM.EUR_COLORS;

  var navBase={flex:1,padding:"9px",border:"none",background:"rgba(255,255,255,1)",borderBottom:"2px solid transparent",color:"#4b5563",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600};
  var navActive={flex:1,padding:"9px",border:"none",background:"rgba(37,99,235,0.08)",borderBottom:"2px solid "+Au,color:Au,fontSize:13,fontFamily:"sans-serif",cursor:"default",fontWeight:600};

  /**
   * Barra de navegação partilhada por todas as páginas.
   * Props:
   *   activePage     "simulador" | "inversa" | "transferencia" | "historico"
   *   commentCount   number
   *   onOpenComments function
   */
  function NavTabs(props){
    var activePage=props.activePage||"";
    var commentCount=props.commentCount||0;
    var onOpenComments=props.onOpenComments||function(){};
    return h("div",{style:{display:"flex",borderRadius:9,overflow:"hidden",border:"1px solid rgba(0,0,0,0.07)"}},
      h("button",{
        onClick:activePage==="simulador"?undefined:function(){window.location.href="/";},
        style:activePage==="simulador"?navActive:navBase
      },"🏠 Simulador"),
      h("button",{
        onClick:activePage==="inversa"?undefined:function(){window.location.href="/quanto-posso-pedir.html";},
        style:activePage==="inversa"?navActive:navBase
      },"💰 Quanto Posso Pedir?"),
      h("button",{
        onClick:activePage==="transferencia"?undefined:function(){window.location.href="/transferencia.html";},
        style:activePage==="transferencia"?navActive:navBase
      },"🔄 Transferência de Crédito"),
      h("button",{
        onClick:activePage==="historico"?undefined:function(){window.location.href="/historico.html";},
        style:activePage==="historico"?navActive:navBase
      },"📈 Histórico de Euribor e Spreads"),
      h("button",{onClick:onOpenComments,style:{flex:1,padding:"9px",border:"none",background:"rgba(255,255,255,1)",borderBottom:"2px solid transparent",color:"#4b5563",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600}},
        "💬 Comentários"+(commentCount>0?" ("+commentCount+")":"")
      )
    );
  }

  /**
   * Cabeçalho completo (logo + Euribor + NavTabs).
   * Props:
   *   EUR           {3m:{valor,data}, 6m:..., 12m:...}
   *   activePage    string — passado ao NavTabs
   *   commentCount  number
   *   onOpenComments function
   *   subtitle      string shown below the nav bar
   */
  function PageHeader(props){
    var EUR=props.EUR||{};
    var activePage=props.activePage;
    var commentCount=props.commentCount||0;
    var onOpenComments=props.onOpenComments||function(){};
    var subtitle=props.subtitle||"";

    return h("div",{style:{background:"linear-gradient(135deg,#ffffff 0%,#eff6ff 55%,#ffffff 100%)",borderBottom:"1px solid rgba(37,99,235,0.4)",padding:"10px 16px 0"}},
      h("div",{style:{maxWidth:1440,margin:"0 auto"}},
        h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,paddingBottom:10}},
          h("div",null,
            h("a",{href:"/",style:{display:"flex",alignItems:"center",gap:8,textDecoration:"none",color:"inherit"}},
              h("img",{src:"/images/logo.png",alt:"Simulador Crédito Habitação",style:{height:40,width:"auto",flexShrink:0}}),
              h("h1",{style:{margin:0,fontSize:21,fontWeight:700,color:"#111827",letterSpacing:-0.3,fontFamily:"'Inter',system-ui,sans-serif"}},"Simulador Crédito Habitação")
            ),
            h("div",{style:{fontSize:11,color:"#4b5563",fontFamily:"sans-serif",marginTop:2}},"Portugal · 13 bancos · Euribor em tempo real"),
            h("div",{style:{display:"flex",gap:5,marginTop:7,flexWrap:"wrap"}},
              ["3m","6m","12m"].map(function(k){
                var v=EUR[k]||FALLBACK_EUR[k];
                var ec=EUR_COLORS[k][0],ebg=EUR_COLORS[k][1];
                return h("div",{key:k,style:{display:"flex",alignItems:"center",gap:5,padding:"3px 9px",background:ebg,borderRight:"1px solid rgba(0,0,0,0.04)",borderRadius:4}},
                  h("span",{style:{color:ec,fontWeight:700,fontSize:10,fontFamily:"monospace",letterSpacing:1}},"EUR "+k.toUpperCase()),
                  h("span",{style:{color:"#111827",fontSize:13,fontWeight:700,fontFamily:"monospace"}},v.valor.toFixed(3).replace(".",",")+"%"),
                  v.data&&h("span",{style:{color:"#4b5563",fontSize:10,fontFamily:"sans-serif",marginLeft:2}},v.data)
                );
              })
            )
          )
        ),
        h(NavTabs,{activePage:activePage,commentCount:commentCount,onOpenComments:onOpenComments}),
        h("div",{style:{paddingBottom:8}},subtitle&&h("span",{style:{fontSize:11,color:"#4b5563"}},subtitle))
      )
    );
  }

  window.NavTabs=NavTabs;
  window.PageHeader=PageHeader;
})();
