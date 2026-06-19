/**
 * Tab «Seguros» — tabela de seguros por banco e composição dos prémios.
 * Vista extraída de app.js — sem hooks próprios; todo o estado vem por props.
 */
;(function(){
"use strict";
if(!window.React)return;
const React=window.React;
const IS_MOBILE=!!(window._SIM_SHARED&&window._SIM_SHARED.isMobileDevice);

function ViewSeguros(props){
  const {fE,fE2,thS,tdB,rbg,G,Sky,BANK_DOMAINS}=window._SIM||{};
  const {segChart,resultados,bankData,is2,idade1,idade2,titulares,capital,segProtecao,segProtMensal}=props;
  return (
          React.createElement("div", null, React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:11,padding:16,marginBottom:14}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:G,fontFamily:"monospace",marginBottom:10}}, "SEGUROS POR BANCO — "+titulares+" TITULAR"+(is2?"ES":"")+" · T1:"+idade1+"a"+(is2?" · T2:"+idade2+"a":"")+" · Capital: "+fE(capital)), ((IS_MOBILE&&window.SegTableMobile)?React.createElement(window.SegTableMobile, {segChart:segChart,resultados:resultados,bankData:bankData,is2:is2,segProtecao:segProtecao,segProtMensal:segProtMensal}):React.createElement("div", {style: {overflowX:"auto"}}, React.createElement("table", {style: {width:"100%",borderCollapse:"separate",borderSpacing:"0 6px",fontFamily:"sans-serif",fontSize:13}}, React.createElement("thead", null, React.createElement("tr", null, ["Banco","Vida T1","Vida T2","Total Vida","Multirriscos","IS Juros/mês","Seg. Prot.","TOTAL/mês","Seguradoras"].map(h=>React.createElement("th", {key: h, style: {...thS,textAlign:"center"}}, h.toUpperCase())))), React.createElement("tbody", null, segChart.map((b,i)=>{
                      const bk=bankData[b.name]||{};
                      const r2=resultados.find(x=>x.s===b.name);
                      const sg=r2?.seg||{v1:0,v2:0,vTot:0,m:0,tot:0};
                      const isM=r2?.isM||0;
                      return(
                        React.createElement("tr", {key: b.name, style: {background:i===0?"rgba(74,222,128,0.06)":rbg(i)}}, React.createElement("td", {style: {...tdB,borderRadius:"6px 0 0 6px",whiteSpace:"nowrap",borderLeft:i===0?"3px solid "+G:"3px solid transparent"}}, React.createElement("div", {style: {display:"flex",alignItems:"center",gap:6}}, React.createElement("div", {style:{width:28,height:24,borderRadius:4,background:"rgba(0,0,0,0.05)",border:"1px solid "+(bk.color||"#555")+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}, React.createElement("img", {src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[bk.s]||"bank.pt")+"&sz=32",width:20,height:20,style:{objectFit:"contain",display:"block"},alt:bk.s||"",onError:function(e){const d=e.currentTarget.parentElement;d.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+(bk.color||"#aaa")+'">'+(bk.s||"")+"</span>";e.currentTarget.onError=null;}})), React.createElement("span", {style:{fontWeight:700,color:i===0?"#111827":"#374151",fontSize:13}}, bk.name||b.name))), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#14532d",fontWeight:600}}, fE2(sg.v1)+"/mês"), is2?React.createElement("td", {style: {...tdB,textAlign:"center",color:G,fontWeight:600}}, fE2(sg.v2)+"/mês"):React.createElement("td", {style: {...tdB,textAlign:"center",color:"#374151"}}, "—"), React.createElement("td", {style: {...tdB,textAlign:"center",color:G,fontWeight:700}}, fE2(sg.vTot)+"/mês"), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#14532d"}}, fE2(sg.m)+"/mês"), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#374151"}}, fE2(isM)+"/mês"), React.createElement("td", {style: {...tdB,textAlign:"center",color:segProtecao?Sky:"#374151"}}, segProtecao?fE2(segProtMensal)+"/mês":"—"), React.createElement("td", {style: {...tdB,textAlign:"center",fontWeight:700,color:i===0?G:"#111827",fontSize:i===0?15:12,borderLeft:"1px solid rgba(74,222,128,0.15)",borderRight:"1px solid rgba(74,222,128,0.15)"}}, fE2(sg.tot+isM+(segProtecao?segProtMensal:0))+"/mês"), React.createElement("td", {style: {...tdB,borderRadius:"0 6px 6px 0",color:"#374151",fontSize:11,whiteSpace:"nowrap"}}, ((r2?.insV||bankData[b.name]?.insV||"?")+" / "+(r2?.insM||bankData[b.name]?.insM||"?"))))
                      );
                    }))))), React.createElement("div", {style: {marginTop:10,padding:"8px 12px",background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:8,fontSize:11,color:"#374151",fontFamily:"sans-serif",lineHeight:1.7}}, "ℹ️", React.createElement("strong", {style: {color:"#111827"}}, "IS sobre juros"), ": Imposto do Selo de 0,4% sobre os juros de cada prestação (art.º 1.º Tabela Geral TGIS). Todos os bancos cobram este imposto — está incluído na TAEG oficial mas raramente mostrado nos simuladores informais.", React.createElement("strong", {style: {color:"#111827"}}, "Seg. Protecção ao Crédito"), ": cobre prestações em caso de desemprego ou incapacidade temporária (opcional, ≈0,12%/ano sobre capital).")), React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(74,222,128,0.12)",borderRadius:11,padding:14}}, React.createElement("div", {style: {fontSize:11,letterSpacing:2,color:G,fontFamily:"monospace",marginBottom:10}}, "COMPOSIÇÃO SEGUROS POR BANCO"), (function(){
  var maxT=Math.max.apply(null,segChart.map(function(b){return (b["Vida T1"]||0)+(b["Vida T2"]||0)+(b["Multirriscos"]||0);}));
  if(!maxT)maxT=1;
  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",gap:16,marginBottom:10,flexWrap:"wrap",alignItems:"center"}},
      React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#374151",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:"#c9a84c",borderRadius:2,opacity:0.85}}),"Vida T1"),
      is2&&React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#374151",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:G,borderRadius:2,opacity:0.85}}),"Vida T2"),
      React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#374151",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:Sky,borderRadius:2,opacity:0.8}}),"Multirriscos")
    ),
    React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:7}},
      segChart.map(function(b){
        var v1=b["Vida T1"]||0,v2=b["Vida T2"]||0,vm=b["Multirriscos"]||0,tot=v1+v2+vm;
        var bw=tot/maxT*100;
        var p1=tot?v1/tot*100:0,p2=tot?v2/tot*100:0,pm=tot?vm/tot*100:0;
        return React.createElement("div",{key:b.name,style:{display:"flex",alignItems:"center",gap:8}},
          React.createElement("div",{style:{width:130,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5,flexShrink:0}},
            React.createElement("span",{style:{fontSize:11,color:"#374151",fontFamily:"sans-serif",fontWeight:600,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
              (bankData[b.name]?.name||b.name)
            ),
            React.createElement("div",{style:{width:18,height:18,borderRadius:3,background:"rgba(0,0,0,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},
              React.createElement("img",{src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[b.name]||"bank.pt")+"&sz=32",width:16,height:16,style:{objectFit:"contain",display:"block"},alt:b.name,onError:function(e){var d=e.currentTarget.parentElement;d.innerHTML='<span style="font-size:7px;font-weight:700;font-family:monospace;color:#666">'+b.name+'</span>';e.currentTarget.onError=null;}})
            )
          ),
          React.createElement("div",{style:{flex:1,height:18,background:"rgba(0,0,0,0.06)",borderRadius:4,overflow:"hidden"}},
            React.createElement("div",{style:{width:bw+"%",height:"100%",display:"flex"}},
              v1>0&&React.createElement("div",{style:{width:p1+"%",background:"#c9a84c",opacity:0.9,height:"100%"}}),
              v2>0&&React.createElement("div",{style:{width:p2+"%",background:G,opacity:0.85,height:"100%"}}),
              vm>0&&React.createElement("div",{style:{width:pm+"%",background:Sky,opacity:0.8,height:"100%"}})
            )
          ),
          React.createElement("span",{style:{width:56,fontSize:11,color:"#374151",fontFamily:"monospace",flexShrink:0,textAlign:"right"}},tot.toFixed(0)+"€/mês")
        );
      })
    ),
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginLeft:146,paddingRight:64,marginTop:5,fontSize:10,color:"#9bb4cc",fontFamily:"monospace"}},
      [0,0.25,0.5,0.75,1].map(function(f,i){return React.createElement("span",{key:i},Math.round(maxT*f)+"€");})
    ),
    React.createElement("div",{style:{marginTop:10,fontSize:11,color:"#4b5563",fontFamily:"sans-serif",lineHeight:1.6,background:"rgba(37,99,235,0.04)",border:"1px solid rgba(37,99,235,0.12)",borderRadius:6,padding:"6px 10px"}},
      "📊 ",React.createElement("strong",{style:{color:"#374151"}},"Como ler: "),
      "Cada barra representa o prémio mensal total de seguros obrigatórios do banco, proporcional ao máximo da lista. A parte ",React.createElement("strong",{style:{color:"#c9a84c"}},"dourada")," é o seguro de vida T1",is2&&React.createElement("span",null," (e ",React.createElement("strong",{style:{color:G}},"verde")," para T2)")," e a parte ",React.createElement("strong",{style:{color:Sky}},"azul-celeste")," é o seguro multirriscos. Os valores são estimativas baseadas nos prémios de referência de cada banco — variam com a idade dos titulares, capital seguro e valor de avaliação do imóvel."
    )
  );
})()))
        );
}
window.ViewSeguros=ViewSeguros;
})();
