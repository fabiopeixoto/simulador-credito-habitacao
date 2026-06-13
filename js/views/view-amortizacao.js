/**
 * Tab «Amortização» — amortização antecipada anual, impacto e gráfico de capital em dívida.
 * Vista extraída de app.js — sem hooks próprios; todo o estado vem por props.
 */
;(function(){
"use strict";
if(!window.React)return;
const React=window.React;
const IS_MOBILE=!!(window._SIM_SHARED&&window._SIM_SHARED.isMobileDevice);
const {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend}=window.Recharts||{};

function ViewAmortizacao(props){
  const {fE,fP,SliderInput,G,R,Au,Sky,RefBadge}=window._SIM||{};
  const {carencia,amortExtra,setAmortExtra,setBancoAmort,capital,prazoR,resultados,melhor,bancoAmortS,bancoAmortRow,tanBest,bancoAmortNome,bancoAmortRef,amSem,amCom,amCh}=props;
  return (
          React.createElement("div", null, carencia>0&&(
              React.createElement("div", {style: {background:"rgba(2,132,199,0.06)",border:"1px solid rgba(2,132,199,0.25)",borderRadius:10,padding:"9px 14px",marginBottom:12,fontFamily:"sans-serif",fontSize:12,color:"#374151"}}, "⚡ Carência de capital: ", React.createElement("strong", {style: {color:Sky}}, carencia+" meses"), " · Prestação durante a carência (só juros): ", React.createElement("strong", {style: {color:Sky}}, bancoAmortRow?fE(bancoAmortRow.pCarenciaC||0)+"/mês":"—"), " · Após carência: ", React.createElement("strong", {style: {color:Au}}, bancoAmortRow?fE(bancoAmortRow.pC)+"/mês":"—"))
            ), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14,marginBottom:14}}, React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:11,padding:16}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:Au,fontFamily:"monospace",marginBottom:10}}, "AMORTIZAÇÃO ANTECIPADA ANUAL"), React.createElement("div", {style: {marginBottom:12}}, React.createElement("div", {style: {fontSize:11,color:"#374151",marginBottom:5,fontFamily:"sans-serif"}}, "BANCO"), React.createElement("select", {value: bancoAmortS, onChange: e=>setBancoAmort(e.target.value), style: {width:"100%",background:"#ffffff",border:"1px solid rgba(37,99,235,0.35)",color:"#111827",borderRadius:7,padding:"6px 9px",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600}}, resultados.filter((r,i,arr)=>arr.findIndex(x=>x.s===r.s)===i).map(r=>(
                      React.createElement("option", {key: r.s, value: r.s}, r.name+(melhor&&r.s===melhor.s?" ⭐":"")+" · Eur."+r.ref+" · TAN "+fP(r.tanC))
                    )))), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12,padding:"10px 12px",background:"rgba(37,99,235,0.05)",border:"1px solid rgba(37,99,235,0.2)",borderRadius:8}}, [
                    {l:"Banco",    v:bancoAmortNome,  c:"#111827"},
                    {l:"Indexante",v:bancoAmortRef,    c:"#111827", badge:true},
                    {l:"TAN",      v:fP(tanBest),      c:Au},
                    {l:"Prestação capital", v:bancoAmortRow?fE(bancoAmortRow.pC)+"/mês":"—", c:Au},
                    {l:"Seguros banco", v:bancoAmortRow?fE(bancoAmortRow.seg.tot)+"/mês":"—", c:G},
                    {l:"TOTAL/mês", v:bancoAmortRow?fE(bancoAmortRow.ptC)+"/mês":"—", c:Au, big:true},
                  ].map(({l,v,c,badge,big})=>(
                    React.createElement("div", {key: l}, React.createElement("div", {style: {fontSize:10,color:"#374151",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}, l.toUpperCase()), React.createElement("div", {style: {fontSize:big?17:13,fontWeight:700,color:c||"#111827",fontFamily:"sans-serif"}}, badge?(React.createElement(RefBadge, {refKey: v})):v))
                  ))), React.createElement("div", {style: {fontSize:10,color:"#374151",fontFamily:"sans-serif",marginBottom:10}}, "ℹ️ HPP taxa variável: ", React.createElement("strong", {style: {color:G}}, "sem comissão de reembolso antecipado"), " (Lei 1/2025). Taxa fixa: 2% sobre capital amortizado."), React.createElement("div", {style: {fontSize:11,color:"#374151",marginBottom:3,fontFamily:"sans-serif"}}, "AMORTIZAÇÃO EXTRA / ANO"), React.createElement(SliderInput, {min: 0, max: 50000, step: 500, value: amortExtra, onChange: setAmortExtra, color: G, suffix: "€/ano", formatFn: v=>v===0?"0":v.toLocaleString('pt-PT')}), React.createElement("div", {style: {fontSize:13,fontWeight:700,color:amortExtra>0?G:"#374151",marginTop:2}}, amortExtra===0?"Sem amortização extra":"")), React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:11,padding:16}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:G,fontFamily:"monospace",marginBottom:12}}, "IMPACTO DA AMORTIZAÇÃO"), [{label:"Sem amortização",d:amSem,ex:0},...(amCom?[{label:"Com "+fE(amortExtra)+"/ano",d:amCom,ex:amortExtra}]:[])].map(({label,d,ex})=>(
                  React.createElement("div", {key: label, style: {marginBottom:10,padding:"12px 14px",background:"rgba(255,255,255,1)",border:"1px solid rgba("+(ex>0?"74,222,128":"255,255,255")+",0.08)",borderRadius:8}}, React.createElement("div", {style: {fontSize:12,fontWeight:700,color:ex>0?G:Au,fontFamily:"sans-serif",marginBottom:10}}, label), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}, [{l:"Prazo efetivo",v:Math.floor(d.meses/12)+"a "+d.meses%12+"m"},{l:"Total juros",v:fE(d.juros)},{l:"Prazo poupado",v:ex>0?d.poupados+" meses":"—"},{l:"Poupança juros",v:ex>0?fE(d.economia):"—"}].map(({l,v})=>(
                        React.createElement("div", {key: l}, React.createElement("div", {style: {fontSize:11,color:"#374151",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}, l.toUpperCase()), React.createElement("div", {style: {fontSize:15,fontWeight:700,color:ex>0&&v!=="—"&&(l.includes("Poupança")||l.includes("Prazo p"))?G:"#111827",fontFamily:"sans-serif"}}, v))
                      ))), ex>0&&amCom&&(
                      React.createElement("div", {style: {marginTop:10,padding:"10px 14px",background:"rgba(74,222,128,0.09)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:8}}, React.createElement("div", {style: {fontSize:10,color:"rgba(74,222,128,0.6)",fontFamily:"monospace",letterSpacing:1,marginBottom:3}}, "POUPANÇA TOTAL"), React.createElement("div", {style: {fontSize:22,fontWeight:700,color:G,fontFamily:"sans-serif",lineHeight:1}}, fE(amCom.economia)), React.createElement("div", {style: {fontSize:12,color:"#374151",fontFamily:"sans-serif",marginTop:5}}, "Termina "+amCom.poupados+" meses mais cedo · ROI: "+((amCom.economia/amortExtra/prazoR)*100).toFixed(1)+"%/ano"))
                    ))
                )))), amortExtra>0&&amCh.length>0&&(
              React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:11,padding:14}}, React.createElement("div", {style: {fontSize:11,letterSpacing:2,color:G,fontFamily:"monospace",marginBottom:10}}, "CAPITAL EM DÍVIDA AO LONGO DO TEMPO"), React.createElement(ResponsiveContainer, {width: "100%", height: 250}, React.createElement(LineChart, {data: amCh, margin: {top:5,right:10,left:5,bottom:5}}, React.createElement(CartesianGrid, {strokeDasharray: "3 3", stroke: "rgba(0,0,0,0.05)"}), React.createElement(XAxis, {dataKey: "ano", tick: {fill:"#374151",fontSize:11}, axisLine: false, tickLine: false}), React.createElement(YAxis, {tick: {fill:"#374151",fontSize:11}, axisLine: false, tickLine: false, tickFormatter: v=>Math.round(v/1000)+"k€"}), React.createElement(Tooltip, {formatter: (v,n)=>[fE(v),n], contentStyle: {background:"#ffffff",border:"1px solid "+Au,borderRadius:8,color:"#111827",fontFamily:"sans-serif",fontSize:12}, labelFormatter: l=>"Ano "+l}), React.createElement(Legend, {wrapperStyle: {color:"#374151",fontSize:12,fontFamily:"sans-serif"}}), React.createElement(Line, {type: "monotone", dataKey: "Sem amort.", stroke: R, strokeWidth: 2, dot: false}), React.createElement(Line, {type: "monotone", dataKey: "Com amort.", stroke: G, strokeWidth: 2.5, dot: false}))))
            ))
        );
}
window.ViewAmortizacao=ViewAmortizacao;
})();
