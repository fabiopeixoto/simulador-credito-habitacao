;(function(){
  'use strict';
  if(!window.React)return;
  var React=window.React,h=React.createElement;

  function breakEvenColor(months,remainingMonths){
    var R="#dc2626",G="#16a34a";
    if(!isFinite(months)||months>=remainingMonths)return R;
    if(months<24)return G;
    if(months<48)return "#b45309";
    if(months<remainingMonths)return "#d97706";
    return R;
  }
  function eqLabelFor(eqM,remainingMonths){
    if(!isFinite(eqM)||eqM>=remainingMonths)return "Não compensa";
    if(eqM<12)return eqM+" meses";
    return Math.ceil(eqM/12)+"a "+((eqM%12)>0?(eqM%12)+"m":"");
  }

  // ── Detalhe de uma proposta de transferência (popup, telemóvel) ───────────
  // Espelha o padrão das outras vistas mobile: a tabela compacta abre este
  // popup com a decomposição completa da proposta de transferência.
  function TransfRow(props){
    return h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.05)"}},
      h("span",{style:{fontSize:12,color:"#374151",fontFamily:"sans-serif",flexShrink:0}},props.l),
      h("span",{style:{fontSize:props.big?17:13,fontWeight:props.big?700:600,color:props.c||"#111827",fontFamily:"sans-serif",textAlign:"right"}},
        props.v,
        props.sub&&h("div",{style:{fontSize:10,fontWeight:400,color:"#4b5563",marginTop:1}},props.sub)
      )
    );
  }
  function TransfSec(props){
    return h("div",{style:{marginTop:14}},
      h("div",{style:{fontSize:10,letterSpacing:2,color:"#4b5563",fontFamily:"monospace",marginBottom:2}},props.t),
      props.children
    );
  }

  function TransfDetailModal(props){
    var d=props.row;
    var onClose=props.onClose||function(){};
    if(!d)return null;
    var S=window._SIM||{};
    var fE=S.fE||function(v){return String(v);};
    var fP=S.fP||function(v){return String(v);};
    var BANK_DOMAINS=S.BANK_DOMAINS||{};
    var G=S.G||"#16a34a",R=S.R||"#dc2626",Au=S.Au||"#2563eb";
    var hueT=d.poupancaTotal>0?G:R;
    var eqColor=breakEvenColor(d.equilibrioMeses,d.remainingMonths);

    return h("div",{
      onClick:function(e){if(e.target===e.currentTarget)onClose();},
      style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}
    },
      h("div",{style:{background:"#fff",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",width:"100%",maxWidth:440,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}},
        h("div",{style:{padding:"14px 18px 12px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexShrink:0}},
          h("div",{style:{display:"flex",alignItems:"center",gap:9,minWidth:0}},
            h("div",{style:{width:32,height:28,borderRadius:5,background:"rgba(0,0,0,0.05)",border:"1px solid "+(d.color||"#999")+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},
              h("img",{src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[d.code]||"bank.pt")+"&sz=32",width:22,height:22,style:{objectFit:"contain",display:"block"},alt:d.code,
                onError:function(e){var t=e.currentTarget.parentElement;t.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+(d.color||"#666")+'">'+d.code+'</span>';e.currentTarget.onError=null;}})
            ),
            h("div",{style:{minWidth:0}},
              h("div",{style:{fontSize:15,fontWeight:700,color:"#111827",fontFamily:"sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},d.name),
              h("div",{style:{fontSize:11,color:"#4b5563",fontFamily:"sans-serif",marginTop:1}},"Transferência de crédito")
            )
          ),
          h("button",{onClick:onClose,"aria-label":"Fechar detalhes",style:{background:"none",border:"none",fontSize:28,fontWeight:800,cursor:"pointer",color:"#dc2626",padding:"4px 8px",borderRadius:6,lineHeight:1,flexShrink:0}},"×")
        ),
        h("div",{style:{overflowY:"auto",padding:"4px 18px 16px",flex:1}},
          h("div",{style:{marginTop:12,padding:"10px 14px",background:hueT+"14",border:"1px solid "+hueT+"4d",borderRadius:10,textAlign:"center"}},
            h("div",{style:{fontSize:10,letterSpacing:2,color:hueT,fontFamily:"monospace"}},"POUPANÇA LÍQUIDA TOTAL"),
            h("div",{style:{fontSize:24,fontWeight:700,color:hueT,fontFamily:"sans-serif",marginTop:2}},(d.poupancaTotal>0?"+":"")+fE(d.poupancaTotal)),
            d.compensador
              ?h("div",{style:{fontSize:11,color:G,fontFamily:"sans-serif",marginTop:4}},"✓ Compensa — equilíbrio em "+eqLabelFor(d.equilibrioMeses,d.remainingMonths))
              :h("div",{style:{fontSize:11,color:R,fontFamily:"sans-serif",marginTop:4}},"Não compensa no prazo restante")
          ),
          h(TransfSec,{t:"NOVA TAXA"},
            h(TransfRow,{l:"Indexante",v:"Euribor "+d.useRef,sub:d.refMismatch?"banco não oferece o indexante escolhido":null}),
            h(TransfRow,{l:"Spread",v:fP(d.spread)+(d.ltvAddon>0?" +"+fP(d.ltvAddon)+" LTV":""),c:G}),
            h(TransfRow,{l:"Nova TAN",v:fP(d.newTAN)}),
            h(TransfRow,{l:"Prestação nova",v:isFinite(d.prestacaoNova)?fE(d.prestacaoNova)+"/mês":"—",big:true})
          ),
          h(TransfSec,{t:"POUPANÇA"},
            h(TransfRow,{l:"Poupança mensal",v:(d.poupancaMensal>0?"+":"")+fE(d.poupancaMensal)+"/mês",c:d.poupancaMensal>0?G:R})
          ),
          h(TransfSec,{t:"CUSTO DA TRANSFERÊNCIA"},
            h(TransfRow,{l:"Penalização reembolso ant.",v:fE(d.penaltyCost)}),
            h(TransfRow,{l:"Comissões do novo banco",v:fE(d.setupCosts),sub:"dossier + avaliação + minutas"}),
            h(TransfRow,{l:"Custo total",v:fE(d.custoTransf),c:"#111827",big:true}),
            h(TransfRow,{l:"Ponto de equilíbrio",v:eqLabelFor(d.equilibrioMeses,d.remainingMonths),c:eqColor})
          ),
          h("div",{style:{marginTop:14,padding:"8px 12px",background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:8,fontSize:10,color:"#4b5563",fontFamily:"sans-serif",lineHeight:1.6}},
            "Simulação indicativa. Seguros, TAEG e outros encargos não incluídos. Consulte a FINE de cada banco antes de decidir.")
        )
      )
    );
  }

  // ── Tabela de transferência compacta (dispositivos móveis) ────────────────
  // Banco / Poupança mês / Poupança total; toque na linha abre o popup acima.
  function TransfTableMobile(props){
    var resultados=props.resultados||[];
    var penaltyCost=props.penaltyCost||0;
    var remainingMonths=props.remainingMonths||0;
    var S=window._SIM||{};
    var fE=S.fE||function(v){return String(v);};
    var BANK_DOMAINS=S.BANK_DOMAINS||{};
    var G=S.G||"#16a34a",R=S.R||"#dc2626",Au=S.Au||"#2563eb",N=S.N||"#e5e7eb";
    var thSC=S.thSC||{};
    var rbg=S.rbg||function(){return "rgba(0,0,0,0.025)";};

    var sel=React.useState(null);
    var selected=sel[0],setSelected=sel[1];

    if(resultados.length===0){
      return h("div",{style:{padding:"24px",textAlign:"center",color:"#4b5563",fontSize:14,background:"#fff",borderRadius:11}},"Nenhum banco elegível para o capital e prazo indicados.");
    }

    var tdM={padding:"7px 3px"};
    return h("div",null,
      h("div",{style:{marginBottom:8,fontSize:11,fontWeight:700,color:"#111827",fontFamily:"sans-serif",textAlign:"center"}},"Toque numa linha para ver custos, equilíbrio e detalhes"),
      h("div",{style:{overflowX:"auto",margin:"0 -12px"}},h("table",{style:{width:"100%",borderCollapse:"separate",borderSpacing:"0 3px",fontFamily:"sans-serif",fontSize:12}},
        h("thead",null,h("tr",null,
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px"})},"#"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px"})},"BANCO"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",color:G,textAlign:"center"})},"POUP.",h("br",null),"/MÊS"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",color:Au,fontWeight:700,textAlign:"center",width:"30%"})},"★ POUP.",h("br",null),"TOTAL")
        )),
        h("tbody",null,resultados.map(function(d,i){
          var bg=rbg(i);
          var top=i===0&&d.compensador;
          var pmHue=d.poupancaMensal>0?G:R;
          var ptHue=d.poupancaTotal>0?G:R;
          return h("tr",{key:d.code,onClick:function(){setSelected(Object.assign({},d,{penaltyCost:penaltyCost,remainingMonths:remainingMonths}));},style:{background:bg,cursor:"pointer",WebkitTapHighlightColor:"transparent"}},
            h("td",{style:Object.assign({},tdM,{padding:"7px 2px 7px 4px",verticalAlign:"middle",borderRadius:"6px 0 0 6px",background:bg,borderLeft:top?"3px solid "+Au:undefined})},
              h("span",{style:{width:18,height:18,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:i===0?Au:i===1?"rgba(192,192,192,0.85)":i===2?"rgba(160,108,50,0.85)":"rgba(0,0,0,0.06)",color:i<=2?N:"#111827"}},i+1)),
            h("td",{style:Object.assign({},tdM,{verticalAlign:"middle",background:bg})},
              h("div",{style:{display:"flex",alignItems:"center",gap:4}},
                h("div",{style:{width:20,height:20,borderRadius:4,background:"rgba(0,0,0,0.05)",border:"1px solid "+d.color+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},
                  h("img",{src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[d.code]||"bank.pt")+"&sz=32",width:16,height:16,style:{objectFit:"contain",display:"block"},alt:d.code,onError:function(e){var t=e.currentTarget.parentElement;t.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+d.color+'">'+d.code+'</span>';e.currentTarget.onError=null;}})),
                h("div",null,
                  h("span",{style:{fontWeight:700,color:top?"#2563eb":"#111827",fontSize:11}},d.name),
                  d.refMismatch&&h("span",{style:{fontSize:9,color:"#b45309",marginLeft:3}},"("+d.useRef+")")))),
            h("td",{style:Object.assign({},tdM,{verticalAlign:"middle",background:bg,textAlign:"center",fontWeight:700,color:pmHue,whiteSpace:"nowrap"})},(d.poupancaMensal>0?"+":"")+fE(d.poupancaMensal)),
            h("td",{style:Object.assign({},tdM,{width:"30%",verticalAlign:"middle",position:"relative",borderRadius:"0 6px 6px 0",background:top?"rgba(37,99,235,0.08)":bg,textAlign:"center",borderLeft:"2px solid "+(top?Au:"rgba(37,99,235,0.15)")})},
              h("span",{style:{fontSize:top?15:13,fontWeight:800,color:ptHue,whiteSpace:"nowrap",paddingRight:12,display:"inline-block"}},(d.poupancaTotal>0?"+":"")+fE(d.poupancaTotal)),
              h("span",{style:{position:"absolute",right:5,top:"50%",transform:"translateY(-50%)",color:"#374151",fontSize:13,fontWeight:800,lineHeight:1}},"›"))
          );
        }))
      )),
      selected&&h(TransfDetailModal,{row:selected,onClose:function(){setSelected(null);}})
    );
  }

  window.TransfTableMobile=TransfTableMobile;
})();
