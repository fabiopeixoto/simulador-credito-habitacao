;(function(){
  'use strict';
  if(!window._SIM||!window.React)return;
  const{fE,fP,SliderInput,CONTRATO_FACTOR,FALLBACK_EUR,G,Au,R,N,Sky,useState,EUR_COLORS}=window._SIM;
  const React=window.React;

function ReverseCalcPage({onBack,onSimulate,onOpenComments,onOpenGlossario,commentCount,EUR}){
  const[mJ,setMJ]=useState(false);
  const[tit,setTit]=useState(1);
  const[r1,setR1]=useState(1500);
  const[c1,setC1]=useState("efetivo");
  const[r2,setR2]=useState(1000);
  const[c2,setC2]=useState("efetivo");
  const[dep,setDep]=useState(0);
  const[out,setOut]=useState(0);
  const[dsti,setDsti]=useState(33);
  const[pz,setPz]=useState(30);
  const[tt,setTt]=useState("variavel");
  const[eRef,setERef]=useState("12m");
  const[spr,setSpr]=useState(1.0);
  const[tf,setTf]=useState(3.5);
  const[jovemLTV,setJovemLTV]=useState(0.9);
  const is2=tit===2;
  const CF=CONTRATO_FACTOR;
  const ra1=Math.round(r1*(CF[c1]||1));
  const ra2=is2?Math.round(r2*(CF[c2]||1)):0;
  const rendT=Math.max(0,ra1+ra2-dep*400);
  const pMax=Math.max(0,rendT*dsti/100-out);
  const ev=(EUR[eRef]||FALLBACK_EUR[eRef]).valor;
  const tan=tt==="fixa"?tf:Math.max(0.1,ev+spr);
  const rM=tan/100/12;
  const n=pz*12;
  const capMax=rM>0?pMax*(1-Math.pow(1+rM,-n))/rM:pMax*n;
  const maxLTV=mJ?jovemLTV:0.8;
  const valMax=capMax/maxLTV;
  const entMin=valMax-capMax;
  const tanS=tan+2;
  const rS=tanS/100/12;
  const capS=rS>0?pMax*(1-Math.pow(1+rS,-n))/rS:pMax*n;
  const pzList=[15,20,25,30,35,40];
  const scen=pzList.map(p=>{const nn=p*12;const c=rM>0?pMax*(1-Math.pow(1+rM,-nn))/rM:pMax*nn;return{prazo:p,cap:Math.round(c),val:Math.round(c/maxLTV)};});
  const tiOpts=[["efetivo","Efectivo (100%)"],["termo","A Termo (90%)"],["parcial","Part-time (80%)"],["recibo","Rec. Verde (70%)"],["pensao","Pensão (100%)"]];
  const lbS={fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"};
  const secS={background:"rgba(0,0,0,0.03)",border:"1px solid rgba(37,99,235,0.16)",borderRadius:11,padding:"13px 14px"};
  const secTitleS={fontSize:11,letterSpacing:3,color:Au,fontFamily:"monospace",marginBottom:10};
  return React.createElement("div",{style:{fontFamily:"'Inter',system-ui,sans-serif",background:N,minHeight:"100vh",color:"#111827"}},
    React.createElement(window.PageHeader||function(){return null;},{EUR:EUR,activePage:"inversa",commentCount:commentCount,onOpenComments:onOpenComments,onOpenGlossario:onOpenGlossario,subtitle:"Descobre o capital máximo que podes pedir com base na tua capacidade financeira · Indicativo"}),
    window.NoticeBanner&&React.createElement(window.NoticeBanner,null),
    React.createElement("div",{style:{maxWidth:1440,margin:"0 auto",padding:"12px 14px"}},
      React.createElement("div",{style:{display:"flex",borderRadius:9,overflow:"hidden",border:"1px solid rgba(0,0,0,0.07)",marginBottom:10}},
        [{id:false,icon:"🏦",label:"Crédito Normal (LTV 80%)",c:Au},{id:true,icon:"🎓",label:"Crédito Jovem ≤35a",c:G}].map(({id,icon,label,c})=>
          React.createElement("button",{key:String(id),onClick:()=>{setMJ(id);setJovemLTV(0.9);},style:{flex:1,padding:"9px",border:"none",background:mJ===id?"rgba("+(id?"74,222,128":"201,168,76")+",0.08)":"rgba(255,255,255,1)",borderBottom:"2px solid "+(mJ===id?c:"transparent"),color:mJ===id?c:"#4b5563",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600}},icon+" "+label)
        )
      ),
      mJ&&React.createElement("div",{style:{display:"flex",borderRadius:9,overflow:"hidden",border:"1px solid rgba(22,163,74,0.25)",marginBottom:10}},
        [{ltv:0.9,label:"Entrada 10% (LTV 90%)"},{ltv:1.0,label:"Entrada 0% (LTV 100%) — D.L. Jovem"}].map(({ltv,label})=>
          React.createElement("button",{key:ltv,onClick:()=>setJovemLTV(ltv),style:{flex:1,padding:"8px",border:"none",background:jovemLTV===ltv?"rgba(22,163,74,0.10)":"rgba(255,255,255,1)",borderBottom:"2px solid "+(jovemLTV===ltv?G:"transparent"),color:jovemLTV===ltv?G:"#4b5563",fontSize:12,fontFamily:"sans-serif",cursor:"pointer",fontWeight:jovemLTV===ltv?700:400}},label)
        )
      ),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:10,marginBottom:10}},
        React.createElement("div",{style:secS},
          React.createElement("div",{style:secTitleS},"RENDIMENTO & TAXA DE ESFORÇO"),
          React.createElement("div",{style:{display:"flex",gap:6,marginBottom:10}},
            [1,2].map(t=>React.createElement("button",{key:t,onClick:()=>setTit(t),style:{flex:1,padding:"5px",border:"1px solid "+(tit===t?Au:"rgba(0,0,0,0.08)"),borderRadius:7,background:tit===t?"rgba(37,99,235,0.10)":"transparent",color:tit===t?Au:"#4b5563",fontSize:12,fontFamily:"sans-serif",cursor:"pointer",fontWeight:tit===t?700:400}},t+" Titular"+(t>1?"es":"")))
          ),
          React.createElement("div",{style:{marginBottom:10}},
            React.createElement("div",{style:lbS},"RENDIMENTO LÍQUIDO T1"),
            React.createElement(SliderInput,{min:500,max:15000,step:100,value:r1,onChange:setR1,color:"rgba(201,168,76,1)",suffix:"€/mês",formatFn:v=>v.toLocaleString("pt-PT")}),
            React.createElement("div",{style:{marginTop:5}},
              React.createElement("div",{style:lbS},"TIPO DE CONTRATO T1"),
              React.createElement("select",{value:c1,onChange:e=>setC1(e.target.value),style:{width:"100%",background:"#ffffff",border:"1px solid rgba(37,99,235,0.3)",color:"#111827",borderRadius:6,padding:"5px 8px",fontSize:12,cursor:"pointer"}},
                tiOpts.map(([v,l])=>React.createElement("option",{key:v,value:v},l))
              ),
              (CF[c1]||1)<1&&React.createElement("div",{style:{fontSize:10,color:Au,marginTop:2}},"Banco considera "+Math.round((CF[c1]||1)*100)+"% = "+fE(ra1)+"/mês")
            )
          ),
          is2&&React.createElement("div",{style:{marginBottom:10,paddingTop:8,borderTop:"1px solid rgba(0,0,0,0.06)"}},
            React.createElement("div",{style:lbS},"RENDIMENTO LÍQUIDO T2"),
            React.createElement(SliderInput,{min:500,max:15000,step:100,value:r2,onChange:setR2,color:G,suffix:"€/mês",formatFn:v=>v.toLocaleString("pt-PT")}),
            React.createElement("div",{style:{marginTop:5}},
              React.createElement("div",{style:lbS},"TIPO DE CONTRATO T2"),
              React.createElement("select",{value:c2,onChange:e=>setC2(e.target.value),style:{width:"100%",background:"#ffffff",border:"1px solid rgba(22,163,74,0.3)",color:"#111827",borderRadius:6,padding:"5px 8px",fontSize:12,cursor:"pointer"}},
                tiOpts.map(([v,l])=>React.createElement("option",{key:v,value:v},l))
              ),
              (CF[c2]||1)<1&&React.createElement("div",{style:{fontSize:10,color:G,marginTop:2}},"Banco considera "+Math.round((CF[c2]||1)*100)+"% = "+fE(ra2)+"/mês")
            )
          ),
          React.createElement("div",{style:{paddingTop:8,borderTop:"1px solid rgba(0,0,0,0.06)"}},
            React.createElement("div",{style:lbS},"DEPENDENTES (−€400/dep.)"),
            React.createElement(SliderInput,{min:0,max:10,step:1,value:dep,onChange:setDep,color:"#f97316",suffix:" dep.",formatFn:v=>v.toString()}),
            dep>0&&React.createElement("div",{style:{fontSize:10,color:"#f97316",marginTop:2}},"-"+fE(dep*400)+"/mês no DSTI")
          ),
          React.createElement("div",{style:{marginTop:10}},
            React.createElement("div",{style:lbS},"OUTROS ENCARGOS MENSAIS"),
            React.createElement(SliderInput,{min:0,max:5000,step:50,value:out,onChange:setOut,color:"#f97316",suffix:"€/mês",formatFn:v=>v.toLocaleString("pt-PT")}),
            React.createElement("div",{style:{fontSize:10,color:"#6b7280",marginTop:2}},"Outros créditos, rendas, pensões de alimentos, etc.")
          ),
          React.createElement("div",{style:{marginTop:10}},
            React.createElement("div",{style:lbS},"TAXA DE ESFORÇO MÁXIMA (DSTI)"),
            React.createElement(SliderInput,{min:10,max:50,step:1,value:dsti,onChange:setDsti,color:"#0d9488",suffix:"%",formatFn:v=>v.toString()}),
            React.createElement("div",{style:{fontSize:10,color:dsti>40?R:dsti>33?"#b45309":"#0d9488",marginTop:2}},dsti<=33?"✓ BdP recomenda ≤33%":dsti<=40?"⚠️ Acima da recomendação BdP (33%)":"⚠️ Muito elevado — aprovação improvável acima de 40%")
          ),
          React.createElement("div",{style:{marginTop:12,padding:"8px 10px",background:"rgba(37,99,235,0.07)",border:"1px solid rgba(37,99,235,0.2)",borderRadius:8}},
            React.createElement("div",{style:{fontSize:10,color:"#4b5563",fontFamily:"monospace",letterSpacing:1,marginBottom:4}},"RENDIMENTO CONSIDERADO"),
            React.createElement("div",{style:{fontSize:18,fontWeight:700,color:Au}},fE(rendT)+"/mês"),
            (is2||dep>0)&&React.createElement("div",{style:{fontSize:10,color:"#6b7280",marginTop:2}},
              "T1 "+fE(ra1)+(ra1!==r1?" ("+Math.round((CF[c1]||1)*100)+"%)":"")+(is2?" + T2 "+fE(ra2)+(ra2!==r2?" ("+Math.round((CF[c2]||1)*100)+"%)":""):"")+( dep>0?" − dep. "+fE(dep*400):"")
            )
          ),
          React.createElement("div",{style:{marginTop:8,padding:"8px 10px",background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.2)",borderRadius:8}},
            React.createElement("div",{style:{fontSize:10,color:"#4b5563",fontFamily:"monospace",letterSpacing:1,marginBottom:4}},"PRESTAÇÃO MÁXIMA PARA HABITAÇÃO"),
            React.createElement("div",{style:{fontSize:18,fontWeight:700,color:pMax>0?Au:R}},fE(pMax)+"/mês"),
            React.createElement("div",{style:{fontSize:10,color:"#6b7280",marginTop:2}},fE(rendT)+" × "+dsti+"% − "+fE(out))
          )
        ),
        React.createElement("div",{style:secS},
          React.createElement("div",{style:secTitleS},"TAXA & PRAZO"),
          React.createElement("div",{style:{marginBottom:10}},
            React.createElement("div",{style:lbS},"TIPO DE TAXA"),
            React.createElement("div",{style:{display:"flex",gap:5}},
              [["variavel","Variável (Eur.+Spread)"],["fixa","Fixa"]].map(([v,l])=>
                React.createElement("button",{key:v,onClick:()=>setTt(v),style:{flex:1,padding:"6px 8px",border:"1px solid "+(tt===v?Au:"rgba(0,0,0,0.08)"),borderRadius:6,background:tt===v?"rgba(37,99,235,0.1)":"transparent",color:tt===v?Au:"#4b5563",fontSize:12,fontFamily:"sans-serif",cursor:"pointer",fontWeight:tt===v?700:400}},l)
              )
            )
          ),
          tt==="variavel"?React.createElement("div",null,
            React.createElement("div",{style:{marginBottom:10}},
              React.createElement("div",{style:lbS},"INDEXANTE EURIBOR"),
              React.createElement("div",{style:{display:"flex",gap:5}},
                ["3m","6m","12m"].map(k=>{
                  const kv=(EUR[k]||FALLBACK_EUR[k]).valor;
                  return React.createElement("button",{key:k,onClick:()=>setERef(k),style:{flex:1,padding:"5px 6px",border:"1px solid "+(eRef===k?Au:"rgba(0,0,0,0.08)"),borderRadius:6,background:eRef===k?"rgba(37,99,235,0.1)":"transparent",cursor:"pointer",fontFamily:"sans-serif",fontWeight:eRef===k?700:400}},
                    React.createElement("div",{style:{fontSize:11,color:eRef===k?Au:"#4b5563"}},"EUR "+k.toUpperCase()),
                    React.createElement("div",{style:{fontSize:10,color:eRef===k?Au:"#6b7280",fontFamily:"monospace"}},kv.toFixed(3).replace(".",",")+"%")
                  );
                })
              )
            ),
            React.createElement("div",{style:{marginBottom:10}},
              React.createElement("div",{style:lbS},"SPREAD ESTIMADO"),
              React.createElement(SliderInput,{min:0.1,max:3,step:0.05,value:spr,onChange:setSpr,color:Au,suffix:" p.p.",formatFn:v=>v.toFixed(2).replace(".",",")}),
              React.createElement("div",{style:{fontSize:10,color:"#6b7280",marginTop:2}},"Euribor "+ev.toFixed(3).replace(".",",")+"% + spread "+spr.toFixed(2).replace(".",",")+"%")
            )
          ):React.createElement("div",{style:{marginBottom:10}},
            React.createElement("div",{style:lbS},"TAN FIXA"),
            React.createElement(SliderInput,{min:1,max:8,step:0.05,value:tf,onChange:setTf,color:Au,suffix:"%",formatFn:v=>v.toFixed(2).replace(".",",")}),
            React.createElement("div",{style:{fontSize:10,color:"#6b7280",marginTop:2}},"Taxa anual nominal fixa")
          ),
          React.createElement("div",{style:{padding:"8px 10px",background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.2)",borderRadius:7,marginBottom:10}},
            React.createElement("div",{style:{fontSize:10,color:Au,fontFamily:"monospace",letterSpacing:1}},"TAN UTILIZADA"),
            React.createElement("div",{style:{fontSize:22,fontWeight:700,color:Au}},tan.toFixed(3).replace(".",",")+"%"),
            tt==="variavel"&&React.createElement("div",{style:{fontSize:10,color:"#6b7280"}},ev.toFixed(3).replace(".",",")+"% + "+spr.toFixed(2).replace(".",",")+" p.p. spread")
          ),
          React.createElement("div",{style:{marginBottom:10}},
            React.createElement("div",{style:lbS},"PRAZO"),
            React.createElement(SliderInput,{min:5,max:40,step:1,value:pz,onChange:setPz,color:Au,suffix:" anos",formatFn:v=>v.toString()}),
            React.createElement("div",{style:{fontSize:10,color:"#6b7280",marginTop:2}},"BdP: máx. 40a (idade ≤ 30 anos)")
          ),
          React.createElement("div",{style:{background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:9,padding:14,marginTop:4}},
            React.createElement("div",{style:{fontSize:10,color:Au,fontFamily:"monospace",letterSpacing:2,marginBottom:12}},"RESULTADO — QUANTO POSSO PEDIR?"),
            React.createElement("div",{style:{marginBottom:10}},
              React.createElement("div",{style:{fontSize:11,color:"#4b5563"}},"Capital máximo que podes pedir"),
              React.createElement("div",{style:{fontSize:28,fontWeight:700,color:capMax>0?Au:R,lineHeight:1.1}},fE(capMax)),
              capMax>0&&React.createElement("div",{style:{fontSize:10,color:"#6b7280",marginTop:2}},pz+"a · TAN "+tan.toFixed(3).replace(".",",")+"% · prest. "+fE(pMax)+"/mês")
            ),
            React.createElement("div",{style:{marginBottom:10}},
              React.createElement("div",{style:{fontSize:11,color:"#4b5563"}},"Valor máximo do imóvel (LTV "+(mJ?(jovemLTV===1.0?"100%":"90%"):"80%")+")"),
              React.createElement("div",{style:{fontSize:22,fontWeight:700,color:Au}},fE(valMax))
            ),
            React.createElement("div",null,
              React.createElement("div",{style:{fontSize:11,color:"#4b5563"}},"Entrada mínima necessária"),
              React.createElement("div",{style:{fontSize:18,fontWeight:700,color:"#7c3aed"}},fE(entMin))
            )
          )
        )
      ),
      capMax>0&&React.createElement("div",{style:{background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.25)",borderRadius:9,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:10,color:"#f97316",fontFamily:"monospace",letterSpacing:1}},"⚡ STRESS TEST (TAN +2%)"),
          React.createElement("div",{style:{fontSize:12,color:"#4b5563",marginTop:3}},"Se a taxa subir para "+tanS.toFixed(3).replace(".",",")+"% ainda consegues pagar "+fE(pMax)+"/mês → capital máximo:")
        ),
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:22,fontWeight:700,color:"#f97316"}},fE(capS)),
          React.createElement("div",{style:{fontSize:11,color:"#6b7280"}},"vs. "+fE(capMax)+" actual · diferença: −"+fE(capMax-capS))
        )
      ),
      React.createElement("div",{style:{background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.16)",borderRadius:11,padding:"13px 14px",marginBottom:10}},
        React.createElement("div",{style:{fontSize:11,letterSpacing:3,color:Au,fontFamily:"monospace",marginBottom:10}},"CAPITAL MÁXIMO POR PRAZO · LTV "+(mJ?(jovemLTV===1.0?"100%":"90%"):"80%")+" · TAN "+tan.toFixed(3).replace(".",",")+"%"),
        React.createElement("div",{style:{overflowX:"auto"}},
          React.createElement("table",{style:{width:"100%",borderCollapse:"separate",borderSpacing:"0 4px",fontFamily:"sans-serif",fontSize:12}},
            React.createElement("thead",null,
              React.createElement("tr",null,
                ["Prazo","Capital máximo","Valor imóvel máximo","Entrada mínima","vs. Prazo anterior"].map((h,i)=>
                  React.createElement("th",{key:i,style:{padding:"5px 8px",textAlign:i===0?"center":"right",fontSize:10,color:"#4b5563",fontWeight:700,letterSpacing:0.5,whiteSpace:"nowrap"}},h.toUpperCase())
                )
              )
            ),
            React.createElement("tbody",null,
              scen.map(({prazo:p,cap,val},idx)=>{
                const ent=val-cap;
                const prev=idx>0?scen[idx-1].cap:null;
                const diff=prev!==null?cap-prev:null;
                const isSelected=p===pz;
                const cellBase={padding:"6px 8px",border:isSelected?"1px solid rgba(37,99,235,0.18)":"1px solid transparent"};
                return React.createElement("tr",{key:p,style:{background:isSelected?"rgba(37,99,235,0.06)":"transparent"}},
                  React.createElement("td",{style:{...cellBase,textAlign:"center",fontWeight:isSelected?700:400,color:isSelected?Au:"#374151",borderRadius:isSelected?"6px 0 0 6px":"0",borderRight:"none"}},p+" anos"),
                  React.createElement("td",{style:{...cellBase,textAlign:"right",fontWeight:isSelected?700:400,color:isSelected?Au:"#374151",borderLeft:"none",borderRight:"none"}},fE(cap)),
                  React.createElement("td",{style:{...cellBase,textAlign:"right",color:isSelected?Au:"#374151",borderLeft:"none",borderRight:"none"}},fE(val)),
                  React.createElement("td",{style:{...cellBase,textAlign:"right",color:"#7c3aed",borderLeft:"none",borderRight:"none"}},fE(ent)),
                  React.createElement("td",{style:{...cellBase,textAlign:"right",color:diff&&diff>0?Au:diff&&diff<0?R:"#6b7280",borderRadius:isSelected?"0 6px 6px 0":"0",borderLeft:"none"}},diff!==null&&diff>0?"+"+fE(diff):"—")
                );
              })
            )
          )
        ),
        React.createElement("div",{style:{marginTop:8,fontSize:11,color:"#6b7280",lineHeight:1.6}},"Prestação de ",React.createElement("strong",{style:{color:Au}},fE(pMax)+"/mês")," disponível para habitação ("+dsti+"% DSTI de "+fE(rendT)+"/mês rendimento − "+fE(out)+" outros encargos).")
      ),
      capMax>0&&React.createElement("div",{style:{background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.2)",borderRadius:9,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontWeight:700,color:Au,marginBottom:3}},"Quer simular um banco específico para "+fE(capMax)+"?"),
          React.createElement("div",{style:{fontSize:12,color:"#4b5563"}},"Usa o Simulador Principal para comparar prestações de 14 bancos com este capital.")
        ),
        React.createElement("button",{onClick:()=>onSimulate(capMax,{youngMode:mJ,selectedLTV:jovemLTV,numTit:tit,prazo:pz,r1,c1,r2,c2,dep,out,tt,eRef}),style:{padding:"9px 18px",background:Au,border:"none",borderRadius:8,color:"#ffffff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"sans-serif",whiteSpace:"nowrap"}},"Abrir Simulador →")
      ),
      React.createElement("div",{style:{padding:"8px 0 14px"}},
        React.createElement("div",{style:{fontSize:11,color:"#6b7280",textAlign:"center",marginBottom:10}},"ℹ️ Valores indicativos. O banco faz a sua própria análise de risco e crédito. Aprovação final depende de scorecard, historial e perfil do mutuário."),
        React.createElement("div",{style:{marginTop:4,padding:"10px 14px",background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:9,fontFamily:"sans-serif"}},
          React.createElement("div",{style:{fontSize:12,fontWeight:700,color:Au,marginBottom:4}},"⚠️ Simulação indicativa — não substitui a FINE"),
          React.createElement("div",{style:{fontSize:11,color:"#6b7280",lineHeight:1.7}},"Os valores apresentados são estimativas com base em spreads e comissões publicadas. As condições efectivas dependem da análise de risco de cada banco. Consulte sempre a Ficha de Informação Normalizada Europeia (FINE) antes de contratar.")
        ),
        React.createElement("div",{style:{marginTop:6,padding:"10px 14px",background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:9,fontFamily:"sans-serif"}},
          React.createElement("div",{style:{fontSize:11,color:"#4b5563",lineHeight:1.7}},"🔄 Euribor via BCE · Cache 8h. 📊 Spread: LTV + finalidade + cert. energético. 🧮 TAEG: Directiva 2014/17/UE. 💰 MTIC = total pago. 🛡️ Seg. vida sobre capital médio. 🏠 IS HPP: €0 (art. 7º CIS). 📅 Prazo: BdP Aviso 4/2022.")
        )
      )
    ),window.PageFooter&&React.createElement(window.PageFooter,null),window.CookieBanner&&React.createElement(window.CookieBanner,null)
  );
}

  window.ReverseCalcPage=ReverseCalcPage;
})();
