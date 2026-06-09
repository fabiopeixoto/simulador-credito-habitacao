;(function(){
  'use strict';
  if(!window.React||!window._SIM)return;
  var React=window.React;
  var h=React.createElement;
  var Au=window._SIM.Au;
  var Sky=window._SIM.Sky;
  var FALLBACK_EUR=window._SIM.FALLBACK_EUR;
  var EUR_COLORS=window._SIM.EUR_COLORS;

  var navBase={flex:1,padding:"9px",border:"none",background:"rgba(255,255,255,1)",borderBottom:"2px solid transparent",color:"#374151",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600};
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
    var _m=React.useState(typeof window!=='undefined'&&window.innerWidth<640);
    var isMobile=_m[0];var setIsMobile=_m[1];
    React.useEffect(function(){
      function onResize(){setIsMobile(window.innerWidth<640);}
      window.addEventListener('resize',onResize,{passive:true});
      return function(){window.removeEventListener('resize',onResize);};
    },[]);
    var flex=isMobile?"1 1 33%":1;
    var fs=isMobile?12:13;
    var nb=Object.assign({},navBase,{flex:flex,fontSize:fs,padding:isMobile?"7px 4px":"9px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});
    var na=Object.assign({},navActive,{flex:flex,fontSize:fs,padding:isMobile?"7px 4px":"9px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});
    var labels=isMobile
      ?["🏠 Simulador","💰 Posso Pedir?","🔄 Transferência","📈 Histórico","💬 Comentários"]
      :["🏠 Simulador","💰 Quanto Posso Pedir?","🔄 Transferência de Crédito","📈 Histórico de Euribor e Spreads","💬 Comentários"];
    return h("div",{style:{display:"flex",flexWrap:"wrap",borderRadius:9,overflow:"hidden",border:"1px solid rgba(0,0,0,0.07)",background:isMobile?"rgba(0,0,0,0.06)":"rgba(255,255,255,1)",rowGap:isMobile?1:0}},
      h("button",{
        onClick:activePage==="simulador"?undefined:function(){window.location.href="/";},
        style:activePage==="simulador"?na:nb
      },labels[0]),
      h("button",{
        onClick:activePage==="inversa"?undefined:function(){window.location.href="/quanto-posso-pedir.html";},
        style:activePage==="inversa"?na:nb
      },labels[1]),
      h("button",{
        onClick:activePage==="transferencia"?undefined:function(){window.location.href="/transferencia.html";},
        style:activePage==="transferencia"?na:nb
      },labels[2]),
      h("button",{
        onClick:activePage==="historico"?undefined:function(){window.location.href="/historico.html";},
        style:activePage==="historico"?na:nb
      },labels[3]),
      h("button",{onClick:onOpenComments,style:Object.assign({},nb,{cursor:"pointer"})},
        labels[4]+(commentCount>0?" ("+commentCount+")":"")
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
    var onOpenGlossario=props.onOpenGlossario||null;
    var subtitle=props.subtitle||"";
    var _pm=React.useState(typeof window!=='undefined'&&window.innerWidth<640);
    var isMobileH=_pm[0];var setIsMobileH=_pm[1];
    React.useEffect(function(){
      function onR(){setIsMobileH(window.innerWidth<640);}
      window.addEventListener('resize',onR,{passive:true});
      return function(){window.removeEventListener('resize',onR);};
    },[]);

    return h("div",{style:{background:"linear-gradient(135deg,#ffffff 0%,#eff6ff 55%,#ffffff 100%)",borderBottom:"1px solid rgba(37,99,235,0.4)",padding:"10px 16px 0"}},
      h("div",{style:{maxWidth:1440,margin:"0 auto"}},
        h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,paddingBottom:10}},
          h("div",null,
            h("a",{href:"/",style:{display:"flex",alignItems:"center",gap:8,textDecoration:"none",color:"inherit"}},
              h("img",{src:"/images/logo.png",alt:"Simulador Crédito Habitação",style:{height:isMobileH?32:40,width:"auto",flexShrink:0}}),
              h("h1",{style:{margin:0,fontSize:isMobileH?16:21,fontWeight:700,color:"#111827",letterSpacing:-0.3,fontFamily:"'Inter',system-ui,sans-serif"}},"Simulador Crédito Habitação")
            ),
            h("div",{style:{fontSize:11,color:"#374151",fontFamily:"sans-serif",marginTop:2}},"Portugal · 14 bancos · Euribor em tempo real"),
            h("div",{style:{display:"flex",gap:5,marginTop:7,flexWrap:"wrap"}},
              ["3m","6m","12m"].map(function(k){
                var v=EUR[k]||FALLBACK_EUR[k];
                var ec=EUR_COLORS[k][0],ebg=EUR_COLORS[k][1];
                return h("div",{key:k,style:{display:"flex",alignItems:"center",gap:5,padding:"3px 9px",background:ebg,borderRight:"1px solid rgba(0,0,0,0.04)",borderRadius:4}},
                  h("span",{style:{color:ec,fontWeight:700,fontSize:10,fontFamily:"monospace",letterSpacing:1}},"EUR "+k.toUpperCase()),
                  h("span",{style:{color:"#111827",fontSize:13,fontWeight:700,fontFamily:"monospace"}},v.valor.toFixed(3).replace(".",",")+"%"),
                  v.data&&h("span",{style:{color:"#374151",fontSize:10,fontFamily:"sans-serif",marginLeft:2}},v.data)
                );
              })
            )
          ),
          onOpenGlossario&&h("button",{onClick:onOpenGlossario,style:{padding:"6px 13px",border:"1px solid rgba(37,99,235,0.25)",borderRadius:7,background:"rgba(255,255,255,0.85)",color:Au,fontSize:12,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600,alignSelf:"flex-start",whiteSpace:"nowrap"}},"📖 Glossário")
        ),
        h(NavTabs,{activePage:activePage,commentCount:commentCount,onOpenComments:onOpenComments}),
        h("div",{style:{paddingBottom:8}},subtitle&&h("span",{style:{fontSize:11,color:"#374151"}},subtitle))
      )
    );
  }


  // Set to null to disable the notice banner sitewide
  var NOTICE = "Alguns spreads bancários estão a ser atualizados — os valores podem não estar completos.";

  function NoticeBanner(){
    var _s=React.useState(false),dismissed=_s[0],setDismissed=_s[1];
    if(!NOTICE||dismissed)return null;
    return h("div",{style:{background:"#fef3c7",borderBottom:"1px solid #f59e0b",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:13,color:"#92400e",fontFamily:"'Inter',system-ui,sans-serif"}},
      h("span",null,"⚠️ "+NOTICE),
      h("button",{onClick:function(){setDismissed(true);},"aria-label":"Fechar aviso",style:{background:"none",border:"none",cursor:"pointer",color:"#92400e",fontSize:18,lineHeight:1,padding:"0 4px",flexShrink:0}},"×")
    );
  }


  function CookieBanner(){
    var _s=React.useState(function(){try{return!!localStorage.getItem('cookie_consent');}catch(_){return true;}});
    var hidden=_s[0],setHidden=_s[1];
    if(hidden)return null;
    return h("div",{style:{position:"fixed",bottom:0,left:0,right:0,zIndex:9999,background:"#fff",borderTop:"1px solid #e5e7eb",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,flexWrap:"wrap",fontSize:13,color:"#374151",fontFamily:"'Inter',system-ui,sans-serif",boxShadow:"0 -2px 8px rgba(0,0,0,0.08)"}},
      h("span",null,"Este site utiliza armazenamento local para guardar as tuas preferências e carrega fontes do Google Fonts."),
      h("a",{href:"/privacidade.html",style:{color:"#2563eb",fontSize:13,textDecoration:"underline",whiteSpace:"nowrap"}},"Política de Privacidade"),
      h("button",{
        onClick:function(){try{localStorage.setItem('cookie_consent','1');}catch(_){}setHidden(true);},
        style:{background:"#2563eb",color:"#fff",border:"none",borderRadius:6,padding:"6px 16px",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}
      },"Aceitar")
    );
  }

  function PageFooter(){
    return h("footer",{style:{textAlign:"center",padding:"18px 16px 28px",fontSize:12,color:"#6b7280",fontFamily:"'Inter',system-ui,sans-serif"}},
      "© 2026 simhabitacao.pt · ",
      h("a",{href:"/privacidade.html",style:{color:"#4b5563",textDecoration:"underline"}},"Política de Privacidade"),
      " · ",
      h("a",{href:"/LICENSE",target:"_blank",style:{color:"#4b5563",textDecoration:"underline"}},"Licença")
    );
  }

  window.NavTabs=NavTabs;
  window.PageHeader=PageHeader;
  window.PageFooter=PageFooter;
  window.NoticeBanner=NoticeBanner;
  window.CookieBanner=CookieBanner;
})();
