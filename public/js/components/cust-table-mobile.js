;(function(){
  'use strict';
  if(!window.React)return;
  var React=window.React,h=React.createElement;

  // ── Detalhe de comissões/limites de um banco (popup, telemóvel) ───────────
  // Espelha o padrão da Comparação/Seguros: a tabela compacta abre este popup,
  // que mostra todas as comissões e limites e permite escolher o banco para o
  // quadro de «Custos Iniciais» (preserva o toque-para-seleccionar do desktop).
  function CustRow(props){
    return h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.05)"}},
      h("span",{style:{fontSize:12,color:"#374151",fontFamily:"sans-serif",flexShrink:0}},props.l),
      h("span",{style:{fontSize:props.big?17:13,fontWeight:props.big?700:600,color:props.c||"#111827",fontFamily:"sans-serif",textAlign:"right"}},
        props.v,
        props.sub&&h("div",{style:{fontSize:10,fontWeight:400,color:"#4b5563",marginTop:1}},props.sub)
      )
    );
  }
  function CustSec(props){
    return h("div",{style:{marginTop:14}},
      h("div",{style:{fontSize:10,letterSpacing:2,color:"#4b5563",fontFamily:"monospace",marginBottom:2}},props.t),
      props.children
    );
  }

  function CustDetailModal(props){
    var d=props.row;
    var onClose=props.onClose||function(){};
    var onSelect=props.onSelect||function(){};
    if(!d)return null;
    var S=window._SIM||{};
    var fE=S.fE||function(v){return String(v);};
    var BANK_DOMAINS=S.BANK_DOMAINS||{};
    var G=S.G||"#16a34a",R=S.R||"#dc2626",Au=S.Au||"#2563eb";
    var comTot=d.dossier+d.avaliacao;

    return h("div",{
      onClick:function(e){if(e.target===e.currentTarget)onClose();},
      style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}
    },
      h("div",{style:{background:"#fff",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",width:"100%",maxWidth:440,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}},
        h("div",{style:{padding:"14px 18px 12px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexShrink:0}},
          h("div",{style:{display:"flex",alignItems:"center",gap:9,minWidth:0}},
            h("div",{style:{width:32,height:28,borderRadius:5,background:"rgba(0,0,0,0.05)",border:"1px solid "+(d.color||"#999")+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},
              h("img",{src:"/api/favicon?domain="+(BANK_DOMAINS[d.code]||"bank.pt")+"&sz=32",width:22,height:22,style:{objectFit:"contain",display:"block"},alt:d.code,
                onError:function(e){var t=e.currentTarget.parentElement;t.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+(d.color||"#666")+'">'+d.code+'</span>';e.currentTarget.onError=null;}})
            ),
            h("div",{style:{minWidth:0}},
              h("div",{style:{fontSize:15,fontWeight:700,color:"#111827",fontFamily:"sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},
                d.name,
                d.isBest&&h("span",{style:{fontSize:11,color:Au,marginLeft:4}},"⭐")
              ),
              h("div",{style:{fontSize:11,color:"#4b5563",fontFamily:"sans-serif",marginTop:1}},"Comissões e limites")
            )
          ),
          h("button",{onClick:onClose,"aria-label":"Fechar detalhes",style:{background:"none",border:"none",fontSize:28,fontWeight:800,cursor:"pointer",color:"#dc2626",padding:"4px 8px",borderRadius:6,lineHeight:1,flexShrink:0}},"×")
        ),
        h("div",{style:{overflowY:"auto",padding:"4px 18px 16px",flex:1}},
          h("div",{style:{marginTop:12,padding:"10px 14px",background:"rgba(74,222,128,0.10)",border:"1px solid rgba(74,222,128,0.35)",borderRadius:10,textAlign:"center"}},
            h("div",{style:{fontSize:10,letterSpacing:2,color:"#15803d",fontFamily:"monospace"}},"COMISSÕES DE ABERTURA"),
            h("div",{style:{fontSize:24,fontWeight:700,color:"#15803d",fontFamily:"sans-serif",marginTop:2}},fE(comTot)),
            h("div",{style:{fontSize:11,color:"#4b5563",fontFamily:"sans-serif",marginTop:2}},"Dossier + avaliação")
          ),
          h(CustSec,{t:"COMISSÕES"},
            h(CustRow,{l:"Comissão de dossier",v:d.dossier===0?"Grátis":fE(d.dossier),c:d.dossier===0?G:"#111827",sub:d.dossier===0?"Banco isenta (jovem/promoção)":null}),
            h(CustRow,{l:"Comissão de avaliação",v:d.avaliacao===0?"Grátis":fE(d.avaliacao),c:d.avaliacao===0?G:"#111827",sub:"Perito independente (CMVM)"})
          ),
          h(CustSec,{t:"LIMITES DE CAPITAL"},
            h(CustRow,{l:"Capital mínimo",v:fE(d.capMin),c:d.capital<d.capMin?R:"#111827"}),
            h(CustRow,{l:"Capital máximo",v:fE(d.capMax),c:d.capital>d.capMax?R:"#111827"}),
            h(CustRow,{l:"Capital "+fE(d.capital),v:d.capOk?"✅ Dentro dos limites":(d.capital<d.capMin?"⚠️ abaixo do mínimo":"⚠️ acima do máximo"),c:d.capOk?G:R})
          ),
          h(CustSec,{t:"ELEGIBILIDADE"},
            h(CustRow,{l:"Medida Jovem (≤35 anos)",v:d.jOk?"✅ Elegível":"❌ Não elegível",c:d.jOk?G:R})
          ),
          d.isSelected
            ?h("div",{style:{marginTop:16,padding:"10px",textAlign:"center",fontSize:12,fontWeight:700,color:Au,background:"rgba(37,99,235,0.08)",border:"1px solid rgba(37,99,235,0.3)",borderRadius:9}},"✓ Banco em destaque nos custos iniciais")
            :h("button",{onClick:function(){onSelect(d.code);onClose();},style:{marginTop:16,width:"100%",padding:"11px",fontSize:13,fontWeight:700,color:"#fff",background:Au,border:"none",borderRadius:9,cursor:"pointer",fontFamily:"sans-serif"}},"Usar este banco nos custos iniciais")
        )
      )
    );
  }

  // ── Tabela de comissões compacta (dispositivos móveis) ────────────────────
  // Banco / Dossier / Avaliação; toque na linha abre o popup acima.
  function CustTableMobile(props){
    var BANKS=props.BANKS||[];
    var bankData=props.bankData||{};
    var modoJovem=!!props.modoJovem;
    var capital=props.capital||0;
    var melhor=props.melhor;
    var bancoSCustos=props.bancoSCustos;
    var setBancoCustos=props.setBancoCustos||function(){};
    var S=window._SIM||{};
    var fE=S.fE||function(v){return String(v);};
    var BANK_DOMAINS=S.BANK_DOMAINS||{};
    var G=S.G||"#16a34a",R=S.R||"#dc2626",Au=S.Au||"#2563eb";
    var thSC=S.thSC||{};
    var rbg=S.rbg||function(){return "rgba(0,0,0,0.025)";};

    var sel=React.useState(null);
    var selected=sel[0],setSelected=sel[1];

    var rows=BANKS.filter(function(b){return modoJovem?b.jOk:true;}).map(function(b,i){
      var bd=bankData[b.s]||{};
      var capMin=bd.capMin!=null?bd.capMin:0;
      var capMax=bd.capMax!=null?bd.capMax:9999999;
      var dossier=bd.dossier!=null?bd.dossier:300;
      var avaliacao=bd.avaliacao!=null?bd.avaliacao:230;
      return {
        code:b.s,name:b.name,color:b.color||"#555",jOk:!!b.jOk,
        capMin:capMin,capMax:capMax,dossier:dossier,avaliacao:avaliacao,capital:capital,
        capOk:capital>=(capMin||0)&&capital<=(capMax||9999999),
        isSelected:b.s===bancoSCustos,isBest:!!(melhor&&b.s===melhor.s),
        idx:i
      };
    });

    var tdM={padding:"6px 2px"};
    return h("div",null,
      h("div",{style:{marginBottom:8,fontSize:11,fontWeight:700,color:"#111827",fontFamily:"sans-serif",textAlign:"center"}},"Toque numa linha para ver comissões, limites e escolher o banco"),
      h("div",{style:{overflowX:"auto",margin:"0 -12px"}},h("table",{style:{width:"100%",borderCollapse:"separate",borderSpacing:"0 3px",fontFamily:"sans-serif",fontSize:12}},
        h("thead",null,h("tr",null,
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px"})},"BANCO"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",textAlign:"center"})},"DOSSIER"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",textAlign:"center"})},"AVAL."),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",textAlign:"center",width:"12%"})},"JOVEM")
        )),
        h("tbody",null,rows.map(function(d){
          var bg=d.isSelected?"rgba(37,99,235,0.10)":rbg(d.idx);
          return h("tr",{key:d.code,onClick:function(){setSelected(d);},style:{background:bg,cursor:"pointer",WebkitTapHighlightColor:"transparent"}},
            h("td",{style:Object.assign({},tdM,{padding:"6px 2px 6px 4px",verticalAlign:"middle",borderRadius:"6px 0 0 6px",background:bg,borderLeft:d.isSelected?"3px solid "+Au:"3px solid transparent"})},
              h("div",{style:{display:"flex",alignItems:"center",gap:4}},
                h("div",{style:{width:20,height:20,borderRadius:4,background:"rgba(0,0,0,0.05)",border:"1px solid "+d.color+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},
                  h("img",{src:"/api/favicon?domain="+(BANK_DOMAINS[d.code]||"bank.pt")+"&sz=32",width:16,height:16,style:{objectFit:"contain",display:"block"},alt:d.code,onError:function(e){var t=e.currentTarget.parentElement;t.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+d.color+'">'+d.code+'</span>';e.currentTarget.onError=null;}})),
                h("span",{style:{fontWeight:d.isSelected?700:600,color:d.capOk?(d.isSelected?"#1e40af":"#111827"):R,fontSize:11}},d.name),
                d.isBest&&h("span",{style:{fontSize:10,color:Au,marginLeft:1}},"⭐"))),
            h("td",{style:Object.assign({},tdM,{verticalAlign:"middle",background:bg,textAlign:"center",color:d.dossier===0?G:d.isSelected?Au:"#374151",fontWeight:d.dossier===0||d.isSelected?700:400})},d.dossier===0?"0€":fE(d.dossier)),
            h("td",{style:Object.assign({},tdM,{verticalAlign:"middle",background:bg,textAlign:"center",color:d.isSelected?Au:"#374151",fontWeight:d.isSelected?700:400})},fE(d.avaliacao)),
            h("td",{style:Object.assign({},tdM,{width:"12%",verticalAlign:"middle",position:"relative",borderRadius:"0 6px 6px 0",background:bg,textAlign:"center"})},
              h("span",{style:{fontSize:13,color:d.jOk?G:R}},d.jOk?"✅":"❌"),
              h("span",{style:{position:"absolute",right:5,top:"50%",transform:"translateY(-50%)",color:"#374151",fontSize:13,fontWeight:800,lineHeight:1}},"›"))
          );
        }))
      )),
      selected&&h(CustDetailModal,{row:selected,onClose:function(){setSelected(null);},onSelect:setBancoCustos})
    );
  }

  window.CustTableMobile=CustTableMobile;
})();
