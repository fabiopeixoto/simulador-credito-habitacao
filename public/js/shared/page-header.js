;(function(){
  'use strict';
  if(!window.React||!window._SIM)return;
  var React=window.React;
  var h=React.createElement;
  var Au=window._SIM.Au;
  var Sky=window._SIM.Sky;
  var FALLBACK_EUR=window._SIM.FALLBACK_EUR;
  var EUR_COLORS=window._SIM.EUR_COLORS;

  // Lista única de páginas — adicionar uma página futura é só uma linha aqui.
  var PAGES=[
    {key:"simulador",     href:"/",                        icon:"🏠", label:"Simulador"},
    {key:"inversa",       href:"/quanto-posso-pedir.html", icon:"💰", label:"Quanto Posso Pedir?"},
    {key:"transferencia", href:"/transferencia.html",      icon:"🔄", label:"Transferência de Crédito"},
    {key:"custos",        href:"/custos-compra.html",              icon:"🧾", label:"Custos de Compra de Casa"},
    {key:"prontidao",     href:"/prontidao.html",                icon:"✅", label:"Estou Pronto para Pedir Crédito?"},
    {key:"amortizacao",   href:"/amortizacao-antecipada.html",   icon:"📉", label:"Amortizações Antecipadas"},
    {key:"comparacao",    href:"/comparacao.html",               icon:"🆚", label:"Comprar vs Arrendar"},
    {key:"rentabilidade", href:"/rentabilidade.html",       icon:"📊", label:"Rentabilidade de Imóvel"},
    {key:"imi",           href:"/imi.html",                icon:"🏛️", label:"Simulador IMI"},
    {key:"stress",        href:"/stress-euribor.html",     icon:"⚡", label:"Stress Test Euribor"},
    {key:"historico",     href:"/historico.html",          icon:"📈", label:"Histórico de Euribor e Spreads"}
  ];

  /**
   * Navegação partilhada por todas as páginas — menu dropdown (☰), igual em mobile e desktop.
   * Mostra só a página atual numa linha; clicar abre a lista completa.
   * Props:
   *   activePage     "simulador" | "inversa" | "transferencia" | "comparacao" | "imi" | "historico"
   *   commentCount   number
   *   onOpenComments function
   */
  function NavTabs(props){
    var activePage=props.activePage||"";
    var _o=React.useState(false);var open=_o[0];var setOpen=_o[1];
    var _m=React.useState(typeof window!=='undefined'&&window.innerWidth<640);
    var isMobile=_m[0];var setIsMobile=_m[1];
    var wrapRef=React.useRef(null);
    React.useEffect(function(){
      function onResize(){setIsMobile(window.innerWidth<640);}
      window.addEventListener('resize',onResize,{passive:true});
      return function(){window.removeEventListener('resize',onResize);};
    },[]);
    React.useEffect(function(){
      if(!open)return;
      function onDocDown(e){if(wrapRef.current&&!wrapRef.current.contains(e.target))setOpen(false);}
      function onKey(e){if(e.key==="Escape")setOpen(false);}
      document.addEventListener('mousedown',onDocDown);
      document.addEventListener('keydown',onKey);
      return function(){document.removeEventListener('mousedown',onDocDown);document.removeEventListener('keydown',onKey);};
    },[open]);

    var current=null;
    for(var i=0;i<PAGES.length;i++){if(PAGES[i].key===activePage){current=PAGES[i];break;}}
    if(!current)current=PAGES[0];

    var triggerStyle={display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,width:"100%",padding:isMobile?"9px 12px":"13px 18px",border:"none",borderRadius:9,background:Au,color:"#ffffff",fontSize:isMobile?13:16,fontFamily:"sans-serif",fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px rgba(37,99,235,0.35)"};

    var items=PAGES.map(function(p){
      var isActive=p.key===current.key;
      return h("button",{
        key:p.key,
        role:"menuitem",
        onClick:isActive?function(){setOpen(false);}:function(){window.location.href=p.href;},
        onMouseEnter:function(e){if(!isActive)e.currentTarget.style.background="rgba(0,0,0,0.04)";},
        onMouseLeave:function(e){if(!isActive)e.currentTarget.style.background="transparent";},
        style:{display:"flex",alignItems:"center",gap:8,width:"100%",minHeight:44,padding:"8px 12px",border:"none",borderRadius:6,textAlign:"left",fontSize:13,fontFamily:"sans-serif",fontWeight:600,cursor:isActive?"default":"pointer",background:isActive?"rgba(37,99,235,0.08)":"transparent",color:isActive?Au:"#374151"}
      },
        h("span",{style:{flexShrink:0}},p.icon),
        h("span",null,p.label)
      );
    });

    // O wrapper interno (position:relative) ancora o painel absoluto ao botão.
    var dropdownWrap=h("div",{ref:wrapRef,style:{position:"relative",width:isMobile?"100%":undefined,maxWidth:360,flexShrink:0}},
      h("button",{
        onClick:function(){setOpen(!open);},
        "aria-haspopup":"menu",
        "aria-expanded":open,
        "aria-label":"Menu de navegação — página atual: "+current.label,
        style:triggerStyle
      },
        h("span",{style:{display:"flex",alignItems:"center",gap:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
          h("span",{style:{flexShrink:0}},current.icon),
          h("span",{style:{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},current.label)
        ),
        h("span",{style:{flexShrink:0,color:"rgba(255,255,255,0.85)",fontSize:14,letterSpacing:1}},open?"☰ ▲":"☰ ▼")
      ),
      open&&h("div",{
        role:"menu",
        style:{position:"absolute",top:"calc(100% + 4px)",left:0,width:"100%",zIndex:50,background:"#fff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:9,boxShadow:"0 6px 20px rgba(0,0,0,0.12)",padding:4}
      },items)
    );

    if(isMobile){
      return h("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:4}},
        h("span",{style:{fontSize:13,fontWeight:700,color:"#dc2626",fontFamily:"'Inter',system-ui,sans-serif",userSelect:"none",textAlign:"center"}},
          "↓ Explora as outras ferramentas ↓"
        ),
        dropdownWrap
      );
    }

    return h("div",{style:{display:"flex",alignItems:"center",gap:14}},
      dropdownWrap,
      h("span",{style:{fontSize:15,fontWeight:700,color:"#dc2626",fontFamily:"'Inter',system-ui,sans-serif",whiteSpace:"nowrap",userSelect:"none"}},
        "← Explora as outras ferramentas"
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
    var onOpenProcesso=props.onOpenProcesso||null;
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
            h("div",{style:{fontSize:11,color:"#374151",fontFamily:"sans-serif",marginTop:2}},"Portugal · 13 bancos · Euribor em tempo real"),
            h("div",{style:{display:"flex",gap:isMobileH?4:5,marginTop:7,flexWrap:"wrap"}},
              ["3m","6m","12m"].map(function(k){
                var v=EUR[k]||FALLBACK_EUR[k];
                var ec=EUR_COLORS[k][0],ebg=EUR_COLORS[k][1];
                return h("div",{key:k,style:{display:"flex",alignItems:"center",gap:isMobileH?4:5,padding:isMobileH?"3px 6px":"3px 9px",background:ebg,borderRight:"1px solid rgba(0,0,0,0.04)",borderRadius:4,flex:isMobileH?1:undefined,justifyContent:isMobileH?"center":undefined}},
                  h("span",{style:{color:ec,fontWeight:700,fontSize:10,fontFamily:"monospace",letterSpacing:1}},isMobileH?k.toUpperCase():"EUR "+k.toUpperCase()),
                  h("span",{style:{color:"#111827",fontSize:13,fontWeight:700,fontFamily:"monospace"}},v.valor.toFixed(3).replace(".",",")+"%"),
                  !isMobileH&&v.data&&h("span",{style:{color:"#374151",fontSize:10,fontFamily:"sans-serif",marginLeft:2}},v.data)
                );
              })
            )
          ),
          h("div",{style:{display:"flex",gap:isMobileH?3:6,alignSelf:"flex-start",flexShrink:0,flexWrap:"nowrap"}},
            onOpenProcesso&&h("button",{onClick:onOpenProcesso,style:{padding:isMobileH?"5px 4px":"6px 13px",border:"1px solid rgba(37,99,235,0.25)",borderRadius:7,background:"rgba(255,255,255,0.85)",color:Au,fontSize:isMobileH?10:12,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}},"📋 Guia Processo"),
            onOpenGlossario&&h("button",{onClick:onOpenGlossario,style:{padding:isMobileH?"5px 4px":"6px 13px",border:"1px solid rgba(37,99,235,0.25)",borderRadius:7,background:"rgba(255,255,255,0.85)",color:Au,fontSize:isMobileH?10:12,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}},"📖 Glossário"),
            h("button",{onClick:onOpenComments,style:{padding:isMobileH?"5px 4px":"6px 13px",border:"1px solid rgba(37,99,235,0.25)",borderRadius:7,background:"rgba(255,255,255,0.85)",color:Au,fontSize:isMobileH?10:12,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}},"💬 Comentários"+(commentCount>0?" ("+commentCount+")":""))
          )
        ),
        h(NavTabs,{activePage:activePage,commentCount:commentCount,onOpenComments:onOpenComments}),
        h("div",{style:{paddingBottom:8}},subtitle&&h("span",{style:{fontSize:11,color:"#374151"}},subtitle))
      )
    );
  }


  // Set to null to disable the notice banner sitewide
  var NOTICE = "Dados em manutenção contínua.";

  function NoticeBanner(){
    var _s=React.useState(false),dismissed=_s[0],setDismissed=_s[1];
    var _nm=React.useState(typeof window!=='undefined'&&window.innerWidth<640);
    var isMobileN=_nm[0];var setIsMobileN=_nm[1];
    React.useEffect(function(){
      function onR(){setIsMobileN(window.innerWidth<640);}
      window.addEventListener('resize',onR,{passive:true});
      return function(){window.removeEventListener('resize',onR);};
    },[]);
    if(!NOTICE||dismissed)return null;
    return h("div",{style:{background:"#fef3c7",borderBottom:"1px solid #f59e0b",padding:isMobileN?"4px 10px":"8px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:isMobileN?11:13,color:"#92400e",fontFamily:"'Inter',system-ui,sans-serif"}},
      h("span",null,"⚠️ "+NOTICE),
      h("button",{onClick:function(){setDismissed(true);},"aria-label":"Fechar aviso",className:"btn-mini",style:{background:"none",border:"none",cursor:"pointer",color:"#92400e",fontSize:isMobileN?14:18,lineHeight:1,padding:"0 4px",flexShrink:0,minHeight:"unset"}},"×")
    );
  }


  function CookieBanner(){
    // Consentimento independente por página — cada página tem a sua própria chave
    var consentKey='STORAGE_CONSENT:'+(typeof window!=='undefined'&&window.location?window.location.pathname:'/');
    var _s=React.useState(function(){
      try{return localStorage.getItem(consentKey)==='accepted';}catch(_){return false;}
    });
    var hidden=_s[0],setHidden=_s[1];
    var _m=React.useState(typeof window!=='undefined'&&window.innerWidth<640);
    var isMobileC=_m[0];var setIsMobileC=_m[1];
    React.useEffect(function(){
      function onR(){setIsMobileC(window.innerWidth<640);}
      window.addEventListener('resize',onR,{passive:true});
      return function(){window.removeEventListener('resize',onR);};
    },[]);
    if(hidden)return null;
    function recusar(){
      try{
        localStorage.removeItem(consentKey);
        localStorage.removeItem('SIMULATION_HISTORY_v2');
        localStorage.removeItem('processo_checked');
      }catch(_){}
      setHidden(true);
      try{window.dispatchEvent(new Event('sim:consent'));}catch(_){}
    }
    function aceitar(){
      try{localStorage.setItem(consentKey,'accepted');}catch(_){}
      setHidden(true);
      try{window.dispatchEvent(new Event('sim:consent'));}catch(_){}
    }
    var fs=isMobileC?11:13;
    var bpad=isMobileC?"4px 10px":"6px 16px";
    var gap=isMobileC?4:10;
    return h("div",{style:{position:"fixed",bottom:0,left:0,right:0,zIndex:9999,background:"#fff",borderTop:"1px solid #e5e7eb",padding:isMobileC?"10px 12px":"12px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,color:"#374151",fontFamily:"'Inter',system-ui,sans-serif",boxShadow:"0 -2px 8px rgba(0,0,0,0.08)"}},
      h("span",{style:{fontSize:isMobileC?14:16,fontWeight:700,textAlign:"center"}},"Este site utiliza armazenamento local para guardar as tuas preferências."),
      h("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:gap,flexWrap:"nowrap"}},
        h("a",{href:"/privacidade.html",style:{color:"#2563eb",fontSize:fs,textDecoration:"underline",whiteSpace:"nowrap"}},"Política de Privacidade"),
        h("a",{href:"/aviso-legal.html",style:{color:"#2563eb",fontSize:fs,textDecoration:"underline",whiteSpace:"nowrap"}},"Aviso Legal"),
        h("button",{
          onClick:recusar,
          style:{background:"#fff",color:"#374151",border:"1px solid #d1d5db",borderRadius:6,padding:bpad,fontSize:fs,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}
        },"Recusar"),
        h("button",{
          onClick:aceitar,
          style:{background:"#2563eb",color:"#fff",border:"none",borderRadius:6,padding:bpad,fontSize:fs,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}
        },"Aceitar")
      )
    );
  }

  function PageFooter(){
    var _r=React.useState(null); var rating=_r[0]; var setRating=_r[1];
    React.useEffect(function(){
      var ok=true;
      fetch("/api/rating").then(function(r){return r.ok?r.json():null;}).then(function(d){ if(ok&&d&&d.count>0&&d.average!=null) setRating(d); }).catch(function(){});
      return function(){ ok=false; };
    },[]);
    var avgTxt=rating?(Math.round(rating.average*10)/10).toFixed(1).replace(".",","):"";
    return h("footer",{style:{textAlign:"center",padding:"18px 16px 28px",fontSize:12,color:"#6b7280",fontFamily:"'Inter',system-ui,sans-serif"}},
      rating&&h("div",{style:{marginBottom:8,fontSize:13,color:"#374151"}},
        h("span",{style:{color:"#c9a84c",fontSize:15,verticalAlign:"-1px"}},"★"),
        " ",
        h("strong",{style:{color:"#111827"}},avgTxt),
        " / 5 · "+rating.count+" "+(rating.count===1?"avaliação":"avaliações")
      ),
      "© 2026 simhabitacao.pt · ",
      h("a",{href:"https://www.instagram.com/simulador.habitacao/",target:"_blank",rel:"noopener noreferrer","aria-label":"Instagram",title:"Segue-nos no Instagram",style:{display:"inline-flex",alignItems:"center",verticalAlign:"middle"}},
        h("svg",{width:16,height:16,viewBox:"0 0 24 24","aria-hidden":"true"},
          h("defs",null,
            h("radialGradient",{id:"igGrad",cx:"30%",cy:"107%",r:"150%"},
              h("stop",{offset:"0%",stopColor:"#fdf497"}),
              h("stop",{offset:"5%",stopColor:"#fdf497"}),
              h("stop",{offset:"45%",stopColor:"#fd5949"}),
              h("stop",{offset:"60%",stopColor:"#d6249f"}),
              h("stop",{offset:"90%",stopColor:"#285AEB"})
            )
          ),
          h("rect",{x:2,y:2,width:20,height:20,rx:6,fill:"url(#igGrad)"}),
          h("rect",{x:6,y:6,width:12,height:12,rx:4,fill:"none",stroke:"#fff",strokeWidth:1.6}),
          h("circle",{cx:12,cy:12,r:3.2,fill:"none",stroke:"#fff",strokeWidth:1.6}),
          h("circle",{cx:16.4,cy:7.6,r:1,fill:"#fff"})
        )
      ),
      " · ",
      h("a",{href:"/privacidade.html",style:{color:"#4b5563",textDecoration:"underline"}},"Política de Privacidade"),
      " · ",
      h("a",{href:"/aviso-legal.html",style:{color:"#4b5563",textDecoration:"underline"}},"Aviso Legal"),
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
