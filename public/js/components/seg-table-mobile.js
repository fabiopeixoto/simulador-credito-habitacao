;(function(){
  'use strict';
  if(!window.React)return;
  var React=window.React,h=React.createElement;

  // ── Detalhe de seguros de um banco (popup, telemóvel) ─────────────────────
  // Espelha o BankDetailModal da Comparação, mas focado na composição dos
  // prémios (vida, multirriscos, IS sobre juros, protecção ao crédito e
  // seguradoras). Recebe a linha já enriquecida por SegTableMobile.
  function SegRow(props){
    return h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.05)"}},
      h("span",{style:{fontSize:12,color:"#374151",fontFamily:"sans-serif",flexShrink:0}},props.l),
      h("span",{style:{fontSize:props.big?17:13,fontWeight:props.big?700:600,color:props.c||"#111827",fontFamily:"sans-serif",textAlign:"right"}},
        props.v,
        props.sub&&h("div",{style:{fontSize:10,fontWeight:400,color:"#4b5563",marginTop:1}},props.sub)
      )
    );
  }
  function SegSec(props){
    return h("div",{style:{marginTop:14}},
      h("div",{style:{fontSize:10,letterSpacing:2,color:"#4b5563",fontFamily:"monospace",marginBottom:2}},props.t),
      props.children
    );
  }

  function SegDetailModal(props){
    var d=props.row;
    var onClose=props.onClose||function(){};
    if(!d)return null;
    var S=window._SIM||{};
    var fE2=S.fE2||function(v){return String(v);};
    var BANK_DOMAINS=S.BANK_DOMAINS||{};
    var G=S.G||"#16a34a",Sky=S.Sky||"#0284c7";
    var seg=d.seg,isM=d.isM,segProtM=d.segProtecao?d.segProtMensal:0;
    var total=seg.tot+isM+segProtM;

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
              h("div",{style:{fontSize:15,fontWeight:700,color:"#111827",fontFamily:"sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},d.name),
              h("div",{style:{fontSize:11,color:"#4b5563",fontFamily:"sans-serif",marginTop:1}},"Seguros e impostos")
            )
          ),
          h("button",{onClick:onClose,"aria-label":"Fechar detalhes",style:{background:"none",border:"none",fontSize:28,fontWeight:800,cursor:"pointer",color:"#dc2626",padding:"4px 8px",borderRadius:6,lineHeight:1,flexShrink:0}},"×")
        ),
        h("div",{style:{overflowY:"auto",padding:"4px 18px 16px",flex:1}},
          h("div",{style:{marginTop:12,padding:"10px 14px",background:"rgba(37,99,235,0.08)",border:"1px solid rgba(37,99,235,0.3)",borderRadius:10,textAlign:"center"}},
            h("div",{style:{fontSize:10,letterSpacing:2,color:"#2563eb",fontFamily:"monospace"}},"TOTAL SEGUROS + IS"),
            h("div",{style:{fontSize:24,fontWeight:700,color:"#2563eb",fontFamily:"sans-serif",marginTop:2}},fE2(total)+"/mês")
          ),
          h(SegSec,{t:"SEGURO DE VIDA"},
            h(SegRow,{l:d.is2?"Vida — Titular 1":"Vida",v:fE2(seg.v1)+"/mês",c:"#14532d"}),
            d.is2&&h(SegRow,{l:"Vida — Titular 2",v:fE2(seg.v2)+"/mês",c:G}),
            h(SegRow,{l:"Total vida",v:fE2(seg.vTot)+"/mês",c:G,big:true})
          ),
          h(SegSec,{t:"OUTROS ENCARGOS"},
            h(SegRow,{l:"Multirriscos",v:fE2(seg.m)+"/mês",c:"#14532d"}),
            h(SegRow,{l:"IS sobre juros",v:fE2(isM)+"/mês",sub:"Imposto do Selo 0,4% sobre os juros"}),
            h(SegRow,{l:"Seg. Protecção ao crédito",v:d.segProtecao?fE2(d.segProtMensal)+"/mês":"—",c:d.segProtecao?Sky:"#374151"})
          ),
          h(SegSec,{t:"SEGURADORAS"},
            h(SegRow,{l:"Vida",v:d.insV}),
            h(SegRow,{l:"Multirriscos",v:d.insM})
          ),
          h("div",{style:{marginTop:14,padding:"8px 12px",background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:8,fontSize:10,color:"#4b5563",fontFamily:"sans-serif",lineHeight:1.6}},
            "Estimativas baseadas nos prémios de referência de cada banco — variam com a idade dos titulares, capital seguro e valor de avaliação do imóvel. Não substituem a proposta do banco.")
        )
      )
    );
  }

  // ── Tabela de seguros compacta (dispositivos móveis) ──────────────────────
  // Banco / Vida / Multirriscos / Total; toque na linha abre o popup acima.
  function SegTableMobile(props){
    var segChart=props.segChart||[];
    var resultados=props.resultados||[];
    var bankData=props.bankData||{};
    var is2=!!props.is2,segProtecao=!!props.segProtecao,segProtMensal=props.segProtMensal||0;
    var S=window._SIM||{};
    var fE2=S.fE2||function(v){return String(v);};
    var BANK_DOMAINS=S.BANK_DOMAINS||{};
    var G=S.G||"#16a34a",Au=S.Au||"#2563eb",N=S.N||"#e5e7eb";
    var thSC=S.thSC||{};
    var tdGC=S.tdGC||function(){return{};};
    var rbg=S.rbg||function(){return "rgba(0,0,0,0.025)";};

    var sel=React.useState(null);
    var selected=sel[0],setSelected=sel[1];

    // Enriquecer cada banco com os dados de seguros (mesma fonte do desktop)
    var rows=segChart.map(function(b){
      var bk=bankData[b.name]||{};
      var r2=resultados.find(function(x){return x.s===b.name;});
      var sg=(r2&&r2.seg)||{v1:0,v2:0,vTot:0,m:0,tot:0};
      var isM=(r2&&r2.isM)||0;
      return {
        code:b.name,name:bk.name||b.name,color:bk.color||"#555",
        seg:sg,isM:isM,is2:is2,segProtecao:segProtecao,segProtMensal:segProtMensal,
        insV:(r2&&r2.insV)||bk.insV||"?",insM:(r2&&r2.insM)||bk.insM||"?",
        total:sg.tot+isM+(segProtecao?segProtMensal:0)
      };
    });

    var tdM={padding:"6px 2px"};
    return h("div",null,
      h("div",{style:{marginBottom:8,fontSize:11,fontWeight:700,color:"#111827",fontFamily:"sans-serif",textAlign:"center"}},"Toque numa linha para ver toda a composição dos seguros"),
      h("div",{style:{overflowX:"auto",margin:"0 -12px"}},h("table",{style:{width:"100%",borderCollapse:"separate",borderSpacing:"0 3px",fontFamily:"sans-serif",fontSize:12}},
        h("thead",null,h("tr",null,
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px"})},"#"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px"})},"BANCO"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",color:G,textAlign:"center"})},"VIDA"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",textAlign:"center"})},"MULTI"),
          h("th",{style:Object.assign({},thSC,{padding:"4px 3px",color:Au,fontWeight:700,textAlign:"center",width:"26%"})},"TOTAL",h("br",null),"/mês")
        )),
        h("tbody",null,rows.map(function(d,i){
          var bg=rbg(i);
          var top=i===0;
          return h("tr",{key:d.code,onClick:function(){setSelected(d);},style:{background:bg,cursor:"pointer",WebkitTapHighlightColor:"transparent"}},
            h("td",{style:Object.assign({},tdM,{padding:"6px 2px 6px 4px",verticalAlign:"middle",borderRadius:"6px 0 0 6px",background:bg,borderLeft:top?"3px solid "+Au:undefined})},
              h("span",{style:{width:18,height:18,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:i===0?Au:i===1?"rgba(192,192,192,0.85)":i===2?"rgba(160,108,50,0.85)":"rgba(0,0,0,0.06)",color:i<=2?N:"#111827"}},i+1)),
            h("td",{style:Object.assign({},tdM,{verticalAlign:"middle",background:bg})},
              h("div",{style:{display:"flex",alignItems:"center",gap:4}},
                h("div",{style:{width:20,height:20,borderRadius:4,background:"rgba(0,0,0,0.05)",border:"1px solid "+d.color+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},
                  h("img",{src:"/api/favicon?domain="+(BANK_DOMAINS[d.code]||"bank.pt")+"&sz=32",width:16,height:16,style:{objectFit:"contain",display:"block"},alt:d.code,onError:function(e){var t=e.currentTarget.parentElement;t.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+d.color+'">'+d.code+'</span>';e.currentTarget.onError=null;}})),
                h("span",{style:{fontWeight:700,color:top?"#2563eb":"#111827",fontSize:11}},d.name))),
            h("td",{style:Object.assign({},tdGC(i),{padding:"6px 2px",verticalAlign:"middle",textAlign:"center"})},
              h("div",{style:{fontSize:13,fontWeight:800,color:G,whiteSpace:"nowrap"}},fE2(d.seg.vTot))),
            h("td",{style:Object.assign({},tdM,{verticalAlign:"middle",background:bg,textAlign:"center",color:"#14532d",fontWeight:600})},fE2(d.seg.m)),
            h("td",{style:Object.assign({},tdM,{width:"26%",verticalAlign:"middle",position:"relative",borderRadius:"0 6px 6px 0",background:top?"rgba(37,99,235,0.1)":bg,textAlign:"center",borderLeft:"2px solid "+(top?Au:"rgba(37,99,235,0.15)")})},
              h("div",{style:{fontSize:top?15:14,fontWeight:800,color:top?Au:"#111827",whiteSpace:"nowrap",padding:"0 10px 0 0"}},fE2(d.total)),
              h("span",{style:{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",color:"#374151",fontSize:13,fontWeight:800,lineHeight:1}},"›"))
          );
        }))
      )),
      selected&&h(SegDetailModal,{row:selected,onClose:function(){setSelected(null);}})
    );
  }

  window.SegTableMobile=SegTableMobile;
})();
