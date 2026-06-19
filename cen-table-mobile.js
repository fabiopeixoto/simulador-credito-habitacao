;(function(){
  'use strict';
  if(!window.React)return;
  var React=window.React,h=React.createElement;

  // ── Detalhe de um cenário de Euribor (popup, telemóvel) ───────────────────
  // Espelha o padrão da Comparação/Seguros/Custos: a tabela compacta abre este
  // popup com a decomposição completa da prestação no cenário escolhido.
  function CenRow(props){
    return h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.05)"}},
      h("span",{style:{fontSize:12,color:"#374151",fontFamily:"sans-serif",flexShrink:0}},props.l),
      h("span",{style:{fontSize:props.big?17:13,fontWeight:props.big?700:600,color:props.c||"#111827",fontFamily:"sans-serif",textAlign:"right"}},
        props.v,
        props.sub&&h("div",{style:{fontSize:10,fontWeight:400,color:"#4b5563",marginTop:1}},props.sub)
      )
    );
  }
  function CenSec(props){
    return h("div",{style:{marginTop:14}},
      h("div",{style:{fontSize:10,letterSpacing:2,color:"#4b5563",fontFamily:"monospace",marginBottom:2}},props.t),
      props.children
    );
  }

  function CenDetailModal(props){
    var c=props.row;
    var onClose=props.onClose||function(){};
    if(!c)return null;
    var S=window._SIM||{};
    var fE=S.fE||function(v){return String(v);};
    var ecC=S.ecC||function(){return "#374151";};
    var G=S.G||"#16a34a",R=S.R||"#dc2626",Au=S.Au||"#2563eb";
    var hueC=c.delta===0?Au:c.delta<0?G:R;
    var pct=function(x){return x.toFixed(3).replace(".",",")+"%";};

    return h("div",{
      onClick:function(e){if(e.target===e.currentTarget)onClose();},
      style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}
    },
      h("div",{style:{background:"#fff",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",width:"100%",maxWidth:440,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}},
        h("div",{style:{padding:"14px 18px 12px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexShrink:0}},
          h("div",{style:{display:"flex",alignItems:"center",gap:9,minWidth:0}},
            h("div",{style:{width:32,height:28,borderRadius:5,background:hueC+"1f",border:"1px solid "+hueC+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}},c.delta===0?"●":c.delta<0?"↓":"↑"),
            h("div",{style:{minWidth:0}},
              h("div",{style:{fontSize:15,fontWeight:700,color:"#111827",fontFamily:"sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},"Cenário "+c.label),
              h("div",{style:{fontSize:11,color:"#4b5563",fontFamily:"sans-serif",marginTop:1}},c.bancoNome+" · Euribor "+pct(c.eur))
            )
          ),
          h("button",{onClick:onClose,"aria-label":"Fechar detalhes",style:{background:"none",border:"none",fontSize:28,fontWeight:800,cursor:"pointer",color:"#dc2626",padding:"4px 8px",borderRadius:6,lineHeight:1,flexShrink:0}},"×")
        ),
        h("div",{style:{overflowY:"auto",padding:"4px 18px 16px",flex:1}},
          h("div",{style:{marginTop:12,padding:"10px 14px",background:hueC+"14",border:"1px solid "+hueC+"4d",borderRadius:10,textAlign:"center"}},
            h("div",{style:{fontSize:10,letterSpacing:2,color:hueC,fontFamily:"monospace"}},"PRESTAÇÃO TOTAL"),
            h("div",{style:{fontSize:24,fontWeight:700,color:hueC,fontFamily:"sans-serif",marginTop:2}},fE(c.pt)+"/mês")
          ),
          h(CenSec,{t:"TAXAS"},
            h(CenRow,{l:"Euribor",v:pct(c.eur)}),
            h(CenRow,{l:"TAN",v:pct(c.tan)})
          ),
          h(CenSec,{t:"PRESTAÇÃO MENSAL"},
            h(CenRow,{l:"Prestação capital",v:fE(c.p)+"/mês",c:hueC}),
            h(CenRow,{l:"IS sobre juros",v:fE(c.isJuros)+"/mês"}),
            h(CenRow,{l:"+ Seguros",v:fE(c.seguros)+"/mês",c:"#14532d"}),
            h(CenRow,{l:"TOTAL",v:fE(c.pt)+"/mês",c:hueC,big:true})
          ),
          h(CenSec,{t:"VIABILIDADE"},
            h(CenRow,{l:"Taxa de esforço (DSTI)",v:c.rendT>0?c.ef.toFixed(1)+"%":"—",c:c.rendT>0?ecC(c.ef):"#374151"}),
            h(CenRow,{l:"Stress (+1,5pp)",v:fE(c.st)+"/mês",c:"#f97316"}),
            h(CenRow,{l:"DSTI em stress",v:c.rendT>0?c.efSt.toFixed(1)+"%":"—",c:c.rendT>0?ecC(c.efSt):"#374151"})
          )
        )
      )
    );
  }

  // ── Tabela de cenários compacta (dispositivos móveis) ─────────────────────
  // Cenário / Euribor / TAN / Total; toque na linha abre o popup acima.
  function CenTableMobile(props){
    var cenarios=props.cenarios||[];
    var capital=props.capital||0,prazoR=props.prazoR||0,finalidade=props.finalidade;
    var rendT=props.rendT||0;
    var melhor=props.melhor||{};
    var bancoCenRow=props.bancoCenRow||melhor;
    var S=window._SIM||{};
    var fE=S.fE||function(v){return String(v);};
    var isJurosMedioMensal=S.isJurosMedioMensal||function(){return 0;};
    var G=S.G||"#16a34a",R=S.R||"#dc2626",Au=S.Au||"#2563eb";
    var thSC=S.thSC||{};

    var sel=React.useState(null);
    var selected=sel[0],setSelected=sel[1];
    var seguros=(melhor.seg&&melhor.seg.tot)||0;
    var bancoNome=bancoCenRow.name||melhor.name||"—";

    var rows=cenarios.map(function(c){
      return Object.assign({},c,{
        isJuros:isJurosMedioMensal(capital,c.tan,prazoR,finalidade),
        seguros:seguros,rendT:rendT,bancoNome:bancoNome
      });
    });

    var pct=function(x){return x.toFixed(3).replace(".",",")+"%";};
    var tdM={padding:"7px 3px"};
    return h("div",null,
      h("div",{style:{marginBottom:8,fontSize:11,fontWeight:700,color:"#111827",fontFamily:"sans-serif",textAlign:"center"}},"Toque num cenário para ver a decomposição completa"),
      h("div",{style:{overflowX:"auto",margin:"0 -12px"}},h("table",{style:{width:"100%",borderCollapse:"separate",borderSpacing:"0 4px",fontFamily:"sans-serif",fontSize:12}},
        h("thead",null,h("tr",null,
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px"})},"CENÁRIO"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",textAlign:"center"})},"EURIBOR"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",textAlign:"center"})},"TAN"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",color:Au,fontWeight:700,textAlign:"center",width:"26%"})},"TOTAL",h("br",null),"/mês")
        )),
        h("tbody",null,rows.map(function(c){
          var hueC=c.delta===0?Au:c.delta<0?G:R;
          var bg=c.delta===0?"rgba(37,99,235,0.11)":c.delta<0?"rgba(74,222,128,0.055)":"rgba(248,113,113,0.055)";
          var lb=c.delta===0?"3px solid "+Au:c.delta<0?"3px solid rgba(74,222,128,0.35)":"3px solid rgba(248,113,113,0.3)";
          var top=c.delta===0;
          return h("tr",{key:c.label,onClick:function(){setSelected(c);},style:{background:bg,cursor:"pointer",WebkitTapHighlightColor:"transparent"}},
            h("td",{style:Object.assign({},tdM,{verticalAlign:"middle",borderRadius:"6px 0 0 6px",borderLeft:lb,fontWeight:top?700:600,color:hueC,textAlign:"center"})},c.label),
            h("td",{style:Object.assign({},tdM,{verticalAlign:"middle",textAlign:"center",fontFamily:"monospace",color:"#111827"})},pct(c.eur)),
            h("td",{style:Object.assign({},tdM,{verticalAlign:"middle",textAlign:"center",fontFamily:"monospace",color:"#111827"})},pct(c.tan)),
            h("td",{style:Object.assign({},tdM,{width:"26%",verticalAlign:"middle",position:"relative",borderRadius:"0 6px 6px 0",textAlign:"center"})},
              h("span",{style:{fontSize:top?15:14,fontWeight:800,color:hueC,whiteSpace:"nowrap",paddingRight:12,display:"inline-block"}},fE(c.pt)),
              h("span",{style:{position:"absolute",right:5,top:"50%",transform:"translateY(-50%)",color:"#374151",fontSize:13,fontWeight:800,lineHeight:1}},"›"))
          );
        }))
      )),
      selected&&h(CenDetailModal,{row:selected,onClose:function(){setSelected(null);}})
    );
  }

  window.CenTableMobile=CenTableMobile;
})();
