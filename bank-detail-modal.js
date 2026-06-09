;(function(){
  'use strict';
  if(!window.React)return;
  var React=window.React,h=React.createElement;

  var G="#16a34a",R="#dc2626",Au="#2563eb",Sky="#0284c7";
  var ecC=function(ef){return ef<=35?G:ef<=40?Au:R;};
  var ecL=function(ef){return ef<=35?"Aprovável":ef<=40?"Limite":"Difícil";};

  function Row(props){
    return h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.05)"}},
      h("span",{style:{fontSize:12,color:"#374151",fontFamily:"sans-serif",flexShrink:0}},props.l),
      h("span",{style:{fontSize:props.big?17:13,fontWeight:props.big?700:600,color:props.c||"#111827",fontFamily:"sans-serif",textAlign:"right"}},
        props.v,
        props.sub&&h("div",{style:{fontSize:10,fontWeight:400,color:"#4b5563",marginTop:1}},props.sub)
      )
    );
  }

  function Sec(props){
    return h("div",{style:{marginTop:14}},
      h("div",{style:{fontSize:10,letterSpacing:2,color:"#4b5563",fontFamily:"monospace",marginBottom:2}},props.t),
      props.children
    );
  }

  function BankDetailModal(props){
    var b=props.row,ctx=props.ctx||{},onClose=props.onClose||function(){};
    if(!b)return null;
    var S=window._SIM||{};
    var fE=S.fE||function(v){return String(v);};
    var fP=S.fP||function(v){return String(v);};
    var EUR_COLORS=S.EUR_COLORS||{};
    var BANK_DOMAINS=S.BANK_DOMAINS||{};
    var ec=EUR_COLORS[b.ref]||[Au,"rgba(37,99,235,0.18)"];
    var seg=b.seg||{v1:0,v2:0,vTot:0,m:0,tot:0};
    var segIs=seg.tot+(b.isM||0)+(ctx.segProtecao?ctx.segProtMensal||0:0);
    var margem=ctx.margem||0;

    return h("div",{
      onClick:function(e){if(e.target===e.currentTarget)onClose();},
      style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}
    },
      h("div",{style:{background:"#fff",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",width:"100%",maxWidth:440,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}},
        h("div",{style:{padding:"14px 18px 12px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexShrink:0}},
          h("div",{style:{display:"flex",alignItems:"center",gap:9,minWidth:0}},
            h("div",{style:{width:32,height:28,borderRadius:5,background:"rgba(0,0,0,0.05)",border:"1px solid "+(b.color||"#999")+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},
              h("img",{src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[b.s]||"bank.pt")+"&sz=32",width:22,height:22,style:{objectFit:"contain",display:"block"},alt:b.s,
                onError:function(e){var d=e.currentTarget.parentElement;d.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+(b.color||"#666")+'">'+b.s+'</span>';e.currentTarget.onError=null;}})
            ),
            h("div",{style:{minWidth:0}},
              h("div",{style:{fontSize:15,fontWeight:700,color:"#111827",fontFamily:"sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},
                b.name,
                b.spreadUpdated&&h("span",{style:{fontSize:10,color:G,marginLeft:4}},"✓"),
                ctx.modoJovem&&h("span",{style:{fontSize:10,background:"rgba(74,222,128,0.12)",border:"1px solid rgba(74,222,128,0.25)",color:G,borderRadius:3,padding:"1px 4px",marginLeft:5,verticalAlign:"middle"}},"JOVEM")
              ),
              h("div",{style:{fontSize:11,color:"#4b5563",fontFamily:"sans-serif",marginTop:1}},"Detalhes da simulação")
            )
          ),
          h("button",{onClick:onClose,"aria-label":"Fechar detalhes",style:{background:"none",border:"none",fontSize:28,fontWeight:800,cursor:"pointer",color:"#dc2626",padding:"4px 8px",borderRadius:6,lineHeight:1,flexShrink:0}},"×")
        ),
        h("div",{style:{overflowY:"auto",padding:"4px 18px 16px",flex:1}},
          h("div",{style:{marginTop:12,padding:"10px 14px",background:"rgba(37,99,235,0.08)",border:"1px solid rgba(37,99,235,0.3)",borderRadius:10,textAlign:"center"}},
            h("div",{style:{fontSize:10,letterSpacing:2,color:Au,fontFamily:"monospace"}},"★ PRESTAÇÃO TOTAL"),
            h("div",{style:{fontSize:24,fontWeight:700,color:Au,fontFamily:"sans-serif",marginTop:2}},fE(b.ptC)+"/mês"),
            margem>0&&h("div",{style:{fontSize:11,color:"#4b5563",fontFamily:"monospace",marginTop:1}},fE(b.ptC-margem)+" – "+fE(b.ptC+margem))
          ),
          h(Sec,{t:"TAXAS"},
            h(Row,{l:"Euribor",v:h("span",null,
              h("span",{style:{display:"inline-block",background:ec[1],border:"1px solid "+ec[0],borderRadius:4,padding:"1px 6px",fontSize:11,fontFamily:"monospace",fontWeight:700,color:ec[0],marginRight:6}},"Eur."+b.ref),
              b.ev.toFixed(3).replace(".",",")+"%"
            )}),
            h(Row,{l:"Spread c/produtos",v:fP(b.sCom),c:G,sub:b.ltvAddon>0?"inclui ajuste LTV +"+b.ltvAddon.toFixed(2)+"pp":null}),
            h(Row,{l:"Spread s/produtos",v:fP(b.sSem),c:R}),
            h(Row,{l:"TAN c/produtos",v:fP(b.tanC),c:G}),
            h(Row,{l:"TAN s/produtos",v:fP(b.tanS),c:R})
          ),
          h(Sec,{t:"PRESTAÇÃO MENSAL"},
            ctx.carencia>0&&h(Row,{l:"⚡ Prestação carência",v:b.pCarenciaC?fE(b.pCarenciaC)+"/mês":"—",c:Sky}),
            h(Row,{l:"Prestação capital c/produtos",v:fE(b.pC)+"/mês",c:G}),
            h(Row,{l:"Prestação capital s/produtos",v:fE(b.pS)+"/mês",c:R}),
            h(Row,{l:"Seguros + IS",v:fE(segIs)+"/mês",c:"#14532d",
              sub:(ctx.is2?"Vida T1: "+fE(seg.v1)+" · Vida T2: "+fE(seg.v2)+" · ":"Vida: "+fE(seg.v1)+" · ")+"Multirriscos: "+fE(seg.m)+(b.isM>0?" · IS juros: "+fE(b.isM):"")}),
            h(Row,{l:"Conta",v:fE(b.contaM||0)+"/mês",sub:b.contaM>0?b.contaNota:null}),
            h(Row,{l:"Poupança c/produtos",v:"+"+fE(b.diff)+"/mês",c:G,sub:fE(b.diffTot)+" ao longo do prazo"})
          ),
          h(Sec,{t:"VIABILIDADE E CUSTO TOTAL"},
            h(Row,{l:"Taxa de esforço (DSTI)",v:ctx.rendT>0?b.efC.toFixed(1)+"% · "+ecL(b.efC):"—",c:ctx.rendT>0?ecC(b.efC):"#374151"}),
            h(Row,{l:"Stress (+1,5pp)",v:ctx.rendT>0?b.efSt.toFixed(1)+"%":"—",c:"#f97316",sub:ctx.rendT>0?fE(b.pSt)+"/mês":null}),
            h(Row,{l:"TAEG",v:(b.taeg||0).toFixed(2).replace(".",",")+"%",c:Sky}),
            h(Row,{l:"MTIC (total pago)",v:fE(b.mtic||0)}),
            h(Row,{l:"Capital "+fE(ctx.capital||0),
              v:b.capitalOk?"✅ Dentro dos limites":(ctx.capital<b.capitalMin?"⚠️ mínimo "+fE(b.capitalMin):"⚠️ máximo "+fE(b.capitalMax)),
              c:b.capitalOk?G:R})
          ),
          h("div",{style:{marginTop:14,padding:"8px 12px",background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:8,fontSize:10,color:"#4b5563",fontFamily:"sans-serif",lineHeight:1.6}},
            "Estimativa indicativa — intervalo ±5% na prestação total (mín. 25 €). Não substitui a FINE nem a proposta do banco.")
        )
      )
    );
  }

  window.BankDetailModal=BankDetailModal;
})();
