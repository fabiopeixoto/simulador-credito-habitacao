/**
 * Tab «Custos» — custos iniciais (IMT, IS, comissões) e comissões por banco.
 * Vista extraída de app.js — sem hooks próprios; todo o estado vem por props.
 */
;(function(){
"use strict";
if(!window.React)return;
const React=window.React;
const IS_MOBILE=!!(window._SIM_SHARED&&window._SIM_SHARED.isMobileDevice);

function ViewCustos(props){
  const {fE,thS,tdB,rbg,G,R,Au,BANK_DOMAINS,calcIMT}=window._SIM||{};
  const {bancoCustos,setBancoCustos,melhor,bankData,BANKS,modoJovem,finalidade,valorImovel,capital,pctR,entrada}=props;
  // Custos detalhados (derivados apenas desta vista)
  const imt=calcIMT(valorImovel,modoJovem,finalidade);
  const isEsc=modoJovem&&finalidade==="hpp"?0:valorImovel*0.008;
  const isCred=capital*0.006;
  // IS escritura sobre a prestação (0,6% do capital em vigor — já incluído no isCred)
  const registoHipoteca=modoJovem&&finalidade==="hpp"?0:Math.round(capital*0.0008+150); // emolumentos
  // Banco seleccionado para custos (usa o melhor como default)
  const bancoSCustos = bancoCustos || (melhor?.s) || "CA";
  const bdCustos=bankData?.[bancoSCustos]||{};
  const comB={dossier:bdCustos.dossier??300,avaliacao:bdCustos.avaliacao??230,minutas:bdCustos.minutas??0,jovemIsenta:bdCustos.jovemIsenta??false,jovemIsentaAval:bdCustos.jovemIsentaAval??false};
  const comDossier=modoJovem&&comB.jovemIsenta?0:comB.dossier;
  const comAval=modoJovem&&comB.jovemIsentaAval?0:comB.avaliacao;
  const comMinutas=comB.minutas||0;
  const dpa=200;
  const notario=750;
  const totalCustos=imt+isEsc+isCred+comDossier+comAval+comMinutas+dpa+registoHipoteca;
  const bancoNomeCustos=bankData?.[bancoSCustos]?.name||"—";
  return (
          React.createElement("div", {style: {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}}, React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:11,padding:16}}, React.createElement("div", {style: {marginBottom:12}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:Au,fontFamily:"monospace",marginBottom:8}}, "CUSTOS INICIAIS — "+(finalidade==="hpp"?"HPP":finalidade==="hab2"?"2.ª Habitação":"Arrendamento")), React.createElement("div", {style: {display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}, React.createElement("span", {style: {fontSize:11,color:"#374151",fontFamily:"sans-serif",flexShrink:0}}, "Banco:"), React.createElement("select", {value: bancoSCustos, onChange: e=>{setBancoCustos(e.target.value);}, style: {flex:1,minWidth:140,background:"#ffffff",border:"1px solid rgba(37,99,235,0.35)",color:"#111827",borderRadius:7,padding:"5px 9px",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600}}, BANKS.filter(b=>modoJovem?b.jOk:true).map(b=>(
                      React.createElement("option", {key: b.s, value: b.s}, b.name+(melhor&&melhor.s===b.s?" ⭐ (melhor)":""))
                    ))), melhor&&bancoSCustos!==melhor.s&&(
                    React.createElement("button", {onClick: ()=>setBancoCustos(melhor.s), style: {padding:"4px 10px",background:"rgba(37,99,235,0.12)",border:"1px solid rgba(37,99,235,0.35)",borderRadius:6,color:Au,fontSize:11,fontFamily:"sans-serif",cursor:"pointer"}}, "⭐ "+melhor.name)
                  )), comB.jovemIsenta&&modoJovem&&(
                  React.createElement("div", {style: {fontSize:10,color:G,fontFamily:"sans-serif",marginTop:4}}, "✅ "+bancoNomeCustos+" isenta comissão de dossier para jovens")
                )), [
                {k:"imovel",   l:"Valor do Imóvel",                      v:valorImovel},
                {k:"capital",  l:"Capital Emprestado",                    v:capital,      note:"LTV "+pctR+"%"},
                {k:"entrada",  l:"Entrada necessária",                    v:entrada,      c:entrada===0?G:Au, note:entrada===0?"100% financiado (garantia Estado)":null},
                {k:"sep1",     l:null},
                {k:"imt",      l:"IMT",                                   v:imt,          c:imt===0?G:R,  note:modoJovem&&finalidade==="hpp"&&imt===0?"Isento ≤35a (HPP ≤330.539€)":modoJovem&&finalidade==="hpp"&&imt>0&&valorImovel<=660982?"IMT parcial OE2026: 8% sobre (valor − 330.539€)":imt===0?"Isento":finalidade!=="hpp"?"Taxa progressiva 1-8% (Portaria 352/2024)":null},
                {k:"isesc",    l:"Imp. Selo escritura (0,8%)",            v:isEsc,        c:isEsc===0?G:undefined, note:modoJovem&&isEsc===0?"✅ Isento ≤35a":null},
                {k:"iscred",   l:"Imp. Selo crédito (0,6%)",             v:isCred,       c:undefined, note:modoJovem?"ℹ️ Não isento (só IS escritura é isento ≤35a)":null},
                {k:"sep2",     l:null},
                {k:"dossier",  l:"Comissão de dossier",                  v:comDossier,   c:comDossier===0?G:"#374151", note:comDossier===0?"✅ Banco isenta (jovem/promoção)":null},
                {k:"aval",     l:"Comissão de avaliação",                 v:comAval,      c:comAval===0?G:"#374151", note:comAval===0?"✅ Banco isenta (jovem)":"Perito independente (CMVM) — obrigatório"},
                ...(comMinutas>0?[{k:"minutas", l:"Preparação de minutas", v:comMinutas, c:"#374151"}]:[]),
                {k:"dpa",      l:"Documento Particular Autenticado (DPA)",v:dpa,          c:"#374151", note:"Alternativa à escritura notarial"},
                {k:"registo",  l:"Registo de hipoteca",                   v:registoHipoteca, c:registoHipoteca===0?G:"#374151", note:registoHipoteca===0?"✅ Isento ≤35a HPP (DL 48-D/2024)":"Emolumentos registo predial"},
                {k:"sep3",     l:null},
                {k:"total",    l:"TOTAL CUSTOS INICIAIS",                 v:totalCustos,  bold:true, c:R},
                {k:"nec",      l:"TOTAL NECESSÁRIO (entrada + custos)",   v:entrada+totalCustos, bold:true, c:Au, note:"Dinheiro líquido no dia da escritura"},
                {k:"sep4",     l:null},
                {k:"notario",  l:"Alternativa: escritura notarial",       v:notario,      c:"#374151", note:"Em vez do DPA — diferença: "+fE(notario-dpa)},
              ].map((item)=>{
                if (!item.l) return (React.createElement("div", {key: item.k, style: {height:1,background:"rgba(0,0,0,0.06)",margin:"8px 0"}}));
                const k=item.k, l=item.l, v=item.v, note=item.note, bold=item.bold;
                const clr=item.c||"#111827";
                return (
                  React.createElement("div", {key: k, style: {display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:"1px solid rgba(0,0,0,0.05)"}}, React.createElement("div", null, React.createElement("div", {style: {fontSize:13,color:bold?"#111827":"#374151",fontFamily:"sans-serif",fontWeight:bold?700:400}}, l), note&&React.createElement("div", {style: {fontSize:10,color:clr,fontFamily:"sans-serif"}}, note)), React.createElement("div", {style: {fontSize:bold?16:14,fontWeight:bold?700:600,color:clr,fontFamily:"sans-serif",whiteSpace:"nowrap",marginLeft:12}}, fE(v)))
                );
              })), React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:11,padding:16}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:G,fontFamily:"monospace",marginBottom:10}}, "COMISSÕES POR BANCO"+(bancoSCustos?" — "+bancoNomeCustos+" em destaque":"")), React.createElement("div", {style: {overflowX:"auto"}}, React.createElement("table", {style: {width:"100%",borderCollapse:"separate",borderSpacing:"0 4px",fontFamily:"sans-serif",fontSize:12}}, React.createElement("thead", null, React.createElement("tr", null, ["Banco","Capital Mín.","Capital Máx.","Dossier","Avaliação","Jovem?"].map(h=>(
                      React.createElement("th", {key: h, style: {...thS,textAlign:"center"}}, h.toUpperCase())
                    )))), React.createElement("tbody", null, BANKS.filter(b=>modoJovem?b.jOk:true).map((b,i)=>{
                      const lim={min:bankData[b.s]?.capMin??0,max:bankData[b.s]?.capMax??9999999};
                      const com2={dossier:bankData[b.s]?.dossier??300,avaliacao:bankData[b.s]?.avaliacao??230};
                      const capOk=capital>=(lim.min||0)&&capital<=(lim.max||9999999);
                      const isSelected=b.s===bancoSCustos;
                      const isBest=melhor&&b.s===melhor.s;
                      return(
                        React.createElement("tr", {key: b.s, onClick: ()=>setBancoCustos(b.s), style: {background:isSelected?"rgba(37,99,235,0.10)":rbg(i),cursor:"pointer"}}, React.createElement("td", {style: {...tdB,borderRadius:"6px 0 0 6px",borderLeft:isSelected?"3px solid "+Au:"3px solid transparent"}}, React.createElement("div", {style: {display:"flex",alignItems:"center",gap:6}}, React.createElement("div", {style:{width:26,height:22,borderRadius:4,background:"rgba(0,0,0,0.05)",border:"1px solid "+(b.color||"#555")+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}, React.createElement("img", {src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[b.s]||"bank.pt")+"&sz=32",width:18,height:18,style:{objectFit:"contain",display:"block"},alt:b.s,onError:function(e){const d=e.currentTarget.parentElement;d.innerHTML='<span style="font-size:7px;font-weight:700;font-family:monospace;color:'+(b.color||"#aaa")+'">'+(b.s||"")+"</span>";e.currentTarget.onError=null;}})), React.createElement("span", {style: {fontWeight:isSelected?700:600,color:capOk?(isSelected?"#1e40af":"#111827"):R}}, b.name), isBest&&React.createElement("span", {style: {fontSize:10,color:Au,marginLeft:2}}, "⭐"), isSelected&&React.createElement("span", {style: {fontSize:8,background:"rgba(37,99,235,0.2)",color:Au,borderRadius:3,padding:"1px 4px",marginLeft:2}}, "SELEC."))), React.createElement("td", {style: {...tdB,textAlign:"center",color:capital<(lim.min||0)?R:"#374151"}}, fE(lim.min||0)), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#374151"}}, fE(lim.max||999999)), React.createElement("td", {style: {...tdB,textAlign:"center",color:(com2.dossier||0)===0?G:isSelected?Au:"#374151",fontWeight:isSelected?700:400}}, (com2.dossier||0)===0?"✅ 0€":fE(com2.dossier||0)), React.createElement("td", {style: {...tdB,textAlign:"center",color:isSelected?Au:"#374151",fontWeight:isSelected?700:400}}, fE(com2.avaliacao||0)), React.createElement("td", {style: {...tdB,borderRadius:"0 6px 6px 0",textAlign:"center"}}, b.jOk ? (React.createElement("span", {style: {color:G,fontSize:13}}, "✅")) : (React.createElement("span", {style: {color:R,fontSize:13}}, "❌"))))
                      );
                    })))), React.createElement("div", {style: {marginTop:12,padding:"8px 12px",background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:8,fontSize:11,color:"#374151",fontFamily:"sans-serif",lineHeight:1.7}}, "DPA (Documento Particular Autenticado) = formalização pelo advogado do banco, sem necessidade de notário. Custo típico: €150-200. Escritura notarial = alternativa mais cara (€500-900) mas obrigatória em alguns casos. Registo de hipoteca: emolumentos a pagar no registo predial (isento para jovens HPP, DL 48-D/2024).")))
        );
}
window.ViewCustos=ViewCustos;
})();
