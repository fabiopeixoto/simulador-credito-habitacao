;(function(){
  'use strict';
  if(!window.React)return;
  var React=window.React;

  // ── Tabela de comparação compacta (dispositivos móveis) ──────────────────
  // Só Banco / Euribor / TAN c/produtos / Total; toque na linha chama
  // onSelectBank(b), que abre o popup de detalhes (BankDetailModal).
  // Helpers e estilos partilhados vêm de window._SIM (lidos no render, com
  // fallbacks, para a ordem de carregamento dos scripts ser irrelevante).
  function CompTableMobile(props){
    var resultados=props.resultados||[];
    var capital=props.capital||0;
    var onSelectBank=props.onSelectBank||function(){};
    var S=window._SIM||{};
    var fE=S.fE||function(v){return String(v);};
    var fP=S.fP||function(v){return String(v);};
    var EUR_COLORS=S.EUR_COLORS||{};
    var BANK_DOMAINS=S.BANK_DOMAINS||{};
    var G=S.G||"#16a34a",R=S.R||"#dc2626",Au=S.Au||"#2563eb",N=S.N||"#e5e7eb";
    var thSC=S.thSC||{};
    var tdGC=S.tdGC||function(){return{};};
    var rbg=S.rbg||function(){return "rgba(0,0,0,0.025)";};

    // Células estreitas para o quadro caber em ecrãs ≥360px sem scroll lateral
    const tdM={padding:"6px 2px"};
    return React.createElement("div",null,
      React.createElement("div",{style:{marginBottom:8,fontSize:11,fontWeight:700,color:"#111827",fontFamily:"sans-serif",textAlign:"center"}},"Toque numa linha para ver todos os detalhes da simulação"),
      React.createElement("div",{style:{overflowX:"auto",margin:"0 -12px"}},React.createElement("table",{style:{width:"100%",borderCollapse:"separate",borderSpacing:"0 3px",fontFamily:"sans-serif",fontSize:12}},
        React.createElement("thead",null,React.createElement("tr",null,
          React.createElement("th",{style:{...thSC,padding:"4px 3px"}},"#"),
          React.createElement("th",{style:{...thSC,padding:"4px 3px"}},"BANCO"),
          React.createElement("th",{style:{...thSC,padding:"4px 3px",textAlign:"center"}},"EUR."),
          React.createElement("th",{style:{...thSC,padding:"4px 3px",color:G,textAlign:"center"}},"TAN"),
          React.createElement("th",{style:{...thSC,padding:"4px 3px",color:Au,fontWeight:700,textAlign:"center",width:"26%"}},"★ TOTAL",React.createElement("br",null),"/mês")
        )),
        React.createElement("tbody",null,resultados.map((b,i)=>{
          const prevBank=i>0?resultados[i-1].s:null;
          const isContinuation=prevBank===b.s;
          const distinctBanks=new Set(resultados.slice(0,i).map(r=>r.s)).size;
          const bg=rbg(isContinuation?distinctBanks-1:distinctBanks);
          const top=i===0;
          const[refC,refBg]=EUR_COLORS[b.ref]||[Au,"rgba(37,99,235,0.18)"];
          return React.createElement("tr",{key:b.rowKey,onClick:()=>onSelectBank(b),style:{background:bg,cursor:"pointer",WebkitTapHighlightColor:"transparent"}},
            React.createElement("td",{style:{...tdM,padding:"6px 2px 6px 4px",verticalAlign:"middle",borderRadius:"6px 0 0 6px",background:bg,borderLeft:top?"3px solid "+Au:undefined}},
              React.createElement("span",{style:{width:18,height:18,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:i===0?Au:i===1?"rgba(192,192,192,0.85)":i===2?"rgba(160,108,50,0.85)":"rgba(0,0,0,0.06)",color:i<=2?N:"#111827"}},i+1)),
            React.createElement("td",{style:{...tdM,verticalAlign:"middle",background:bg}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:4}},
                React.createElement("div",{style:{width:20,height:20,borderRadius:4,background:"rgba(0,0,0,0.05)",border:"1px solid "+b.color+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},
                  React.createElement("img",{src:"/api/favicon?domain="+(BANK_DOMAINS[b.s]||"bank.pt")+"&sz=32",width:16,height:16,style:{objectFit:"contain",display:"block"},alt:b.s,onError:function(e){const d=e.currentTarget.parentElement;d.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+b.color+'">'+b.s+'</span>';e.currentTarget.onError=null;}})),
                React.createElement("div",null,
                  React.createElement("span",{style:{fontWeight:700,color:top?"#2563eb":"#111827",fontSize:11}},b.name),
                  b.spreadUpdated&&React.createElement("span",{style:{fontSize:8,color:G,marginLeft:3}},"✓"),
                  !b.capitalOk&&React.createElement("div",{style:{fontSize:8,color:R}},capital<b.capitalMin?"⚠️ mín. "+fE(b.capitalMin):"⚠️ máx. "+fE(b.capitalMax))))),
            React.createElement("td",{style:{...tdM,verticalAlign:"middle",background:bg,textAlign:"center"}},
              React.createElement("span",{style:{display:"inline-block",background:refBg,border:"1px solid "+refC,borderRadius:4,padding:"1px 5px",fontSize:12,fontFamily:"monospace",fontWeight:700,color:refC}},b.ref)),
            React.createElement("td",{style:{...tdGC(i),padding:"6px 2px",verticalAlign:"middle",textAlign:"center"}},
              React.createElement("div",{style:{fontSize:13,fontWeight:800,color:G,whiteSpace:"nowrap"}},React.createElement("span",{style:{fontSize:9,fontWeight:600,marginRight:2}},"c/"),fP(b.tanC)),
              React.createElement("div",{style:{fontSize:9,fontWeight:600,color:"#4b5563",whiteSpace:"nowrap",marginTop:1}},React.createElement("span",{style:{fontSize:8,marginRight:2}},"s/"),fP(b.tanS))),
            React.createElement("td",{style:{...tdM,width:"26%",verticalAlign:"middle",position:"relative",borderRadius:"0 6px 6px 0",background:top?"rgba(37,99,235,0.1)":bg,textAlign:"center",borderLeft:"2px solid "+(top?Au:"rgba(37,99,235,0.15)")}},
              React.createElement("div",{style:{fontSize:top?15:14,fontWeight:800,color:top?Au:"#111827",whiteSpace:"nowrap",padding:"0 10px 0 0"}},React.createElement("span",{style:{fontSize:9,fontWeight:600,color:G,marginRight:2}},"c/"),fE(b.ptC)),
              React.createElement("div",{style:{fontSize:9,fontWeight:600,color:"#4b5563",whiteSpace:"nowrap",padding:"0 10px 0 0",marginTop:1}},React.createElement("span",{style:{fontSize:8,marginRight:2}},"s/"),fE(b.ptS)),
              React.createElement("span",{style:{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",color:"#374151",fontSize:13,fontWeight:800,lineHeight:1}},"›"))
          );
        }))
      ))
    );
  }

  window.CompTableMobile=CompTableMobile;
})();
