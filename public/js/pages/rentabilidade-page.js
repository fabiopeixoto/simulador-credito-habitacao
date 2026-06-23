;(function(){
  'use strict';
  if(!window._SIM||!window.React)return;
  var React=window.React;
  var h=React.createElement;
  var IS_MOBILE=!!(window._SIM_SHARED&&window._SIM_SHARED.isMobileDevice);
  var useState=React.useState;
  var useMemo=React.useMemo;
  var fE=window._SIM.fE;
  var fP=window._SIM.fP;
  var fP1=window._SIM.fP1;
  var SliderInput=window._SIM.SliderInput;
  var FALLBACK_EUR=window._SIM.FALLBACK_EUR;
  var Au=window._SIM.Au;
  var G=window._SIM.G;
  var R=window._SIM.R;
  var N=window._SIM.N;
  var Sky=window._SIM.Sky;
  var calcP=window._SIM.calcP;
  var calcIMT=window._SIM.calcIMT;

  var RC=window.Recharts||{};
  var ResponsiveContainer=RC.ResponsiveContainer;
  var LineChart=RC.LineChart, Line=RC.Line, XAxis=RC.XAxis, YAxis=RC.YAxis;
  var CartesianGrid=RC.CartesianGrid, Tooltip=RC.Tooltip, Legend=RC.Legend;

  // Saldo em dívida ao fim de `meses` (tabela price)
  function saldoDevedor(C,tanA,anos,meses){
    if(!C||!tanA||!anos)return 0;
    var r=tanA/100/12, P=calcP(C,tanA,anos), s=C;
    var lim=Math.min(meses,anos*12);
    for(var m=0;m<lim;m++){ s=s-(P-s*r); if(s<0){s=0;break;} }
    return Math.max(0,s);
  }

  function RentabilidadePage(props){
    var EUR=props.EUR||FALLBACK_EUR;
    var commentCount=props.commentCount||0;
    var onOpenComments=props.onOpenComments||function(){};
    var onOpenGlossario=props.onOpenGlossario||null;
    var onOpenProcesso=props.onOpenProcesso||null;

    // ── Inputs: Imóvel & Financiamento ──
    var _vi=useState(250000);
    var valorImovel=_vi[0]; var setValorImovel=_vi[1];
    var _pf=useState(70);
    var pctFin=_pf[0]; var setPctFin=_pf[1];
    var _pz=useState(30);
    var prazo=_pz[0]; var setPrazo=_pz[1];
    var eur6m=(EUR["6m"]&&EUR["6m"].valor)||FALLBACK_EUR["6m"].valor;
    var _tan=useState(function(){return (eur6m+1.5).toFixed(2);});
    var tanStr=_tan[0]; var setTanStr=_tan[1];

    // ── Inputs: Rendimento ──
    var _rm=useState(1200);
    var rendaMensal=_rm[0]; var setRendaMensal=_rm[1];
    var _to=useState(90);
    var taxaOcupacao=_to[0]; var setTaxaOcupacao=_to[1];
    var _cr=useState(2);
    var crescimentoRenda=_cr[0]; var setCrescimentoRenda=_cr[1];

    // ── Inputs: Custos Operacionais ──
    var _imi=useState(0.4);
    var imiPct=_imi[0]; var setImiPct=_imi[1];
    var _cond=useState(50);
    var condominio=_cond[0]; var setCondominio=_cond[1];
    var _man=useState(1.0);
    var manutPct=_man[0]; var setManutPct=_man[1];
    var _seg=useState(300);
    var seguroMultirisco=_seg[0]; var setSeguroMultirisco=_seg[1];
    var _oc=useState(0);
    var outrosCustos=_oc[0]; var setOutrosCustos=_oc[1];

    // ── Inputs: Custos de Aquisição ──
    var _oi=useState(1.0);
    var outrosIniciaisPct=_oi[0]; var setOutrosIniciaisPct=_oi[1];

    // ── Inputs: Horizonte ──
    var _hz=useState(15);
    var horizonteAnos=_hz[0]; var setHorizonteAnos=_hz[1];
    var _va=useState(3);
    var valorizacaoAnual=_va[0]; var setValorizacaoAnual=_va[1];

    // ── Acordeões (mobile) ──
    var _acc=useState({imovel:false,rendimento:false,custos:false,aquisicao:false,horizonte:false});
    var acc=_acc[0]; var setAcc=_acc[1];
    function toggleAcc(k){ setAcc(function(p){var n=Object.assign({},p);n[k]=!n[k];return n;}); }

    var tan=parseFloat(tanStr)||0;
    var capitalEmprestado=valorImovel*pctFin/100;
    var capitalProprio=valorImovel-capitalEmprestado;

    var calc=useMemo(function(){
      if(!valorImovel||valorImovel<=0){
        return {
          prestacaoMensal:0,imtTotal:0,isTotal:0,outrosIniciais:0,totalInvestido:0,
          imiAnual:0,manutAnual:0,condAnual:0,custosOpAnuais:0,custosTotal:0,
          rendaAnual:0,yieldBruta:0,yieldLiquida:0,cashflowMensal:0,
          breakEvenMeses:0,serie:[]
        };
      }

      var prestacaoMensal=pctFin>0?calcP(capitalEmprestado,tan,prazo):0;
      var imtTotal=calcIMT(valorImovel,0,false);
      var isTotal=valorImovel*0.008;
      var outrosIniciais=valorImovel*(outrosIniciaisPct/100);
      var totalInvestido=capitalProprio+imtTotal+isTotal+outrosIniciais;

      var rendaAnual=rendaMensal*12*(taxaOcupacao/100);
      var imiAnual=valorImovel*(imiPct/100);
      var manutAnual=valorImovel*(manutPct/100);
      var condAnual=condominio*12;
      var custosOpAnuais=imiAnual+manutAnual+condAnual+seguroMultirisco+outrosCustos*12;
      var custosTotal=custosOpAnuais+prestacaoMensal*12;

      var yieldBruta=rendaMensal>0?(rendaMensal*12)/valorImovel*100:0;
      var yieldLiquida=(rendaAnual-custosOpAnuais)/totalInvestido*100;
      var cashflowMensal=(rendaAnual-custosTotal)/12;
      var breakEvenMeses=rendaMensal>0?custosOpAnuais/(rendaMensal*12)*12:Infinity;

      // Série anual para gráfico e tabela
      var serie=[];
      var cashflowAcum=0;
      for(var t=0;t<=horizonteAnos;t++){
        var imovelValT=valorImovel*Math.pow(1+valorizacaoAnual/100,t);
        var divida=pctFin>0?saldoDevedor(capitalEmprestado,tan,prazo,t*12):0;
        var equity=imovelValT-divida;
        var fatorRenda=Math.pow(1+crescimentoRenda/100,t);
        var rendaEsteAno=rendaMensal*12*(taxaOcupacao/100)*fatorRenda;
        // custos operacionais crescem a metade da taxa de renda (heurística conservadora)
        var fatorCustos=t===0?1:Math.pow(1+crescimentoRenda/100*0.5,t);
        var custosOpEsteAno=custosOpAnuais*fatorCustos;
        var cashflowAno=rendaEsteAno-(custosOpEsteAno+prestacaoMensal*12);
        if(t>0)cashflowAcum+=cashflowAno;
        var retornoTotal=equity+cashflowAcum-totalInvestido;
        serie.push({
          ano:t,
          cashflowAcumulado:Math.round(cashflowAcum),
          equity:Math.round(equity),
          retornoTotal:Math.round(retornoTotal),
          rendaBruta:Math.round(rendaEsteAno),
          custosAno:Math.round(custosOpEsteAno+prestacaoMensal*12),
          cashflowAno:Math.round(cashflowAno),
          divida:Math.round(divida),
          imovelVal:Math.round(imovelValT)
        });
      }

      return {
        prestacaoMensal:prestacaoMensal,imtTotal:imtTotal,isTotal:isTotal,
        outrosIniciais:outrosIniciais,totalInvestido:totalInvestido,
        imiAnual:imiAnual,manutAnual:manutAnual,condAnual:condAnual,
        custosOpAnuais:custosOpAnuais,custosTotal:custosTotal,
        rendaAnual:rendaAnual,yieldBruta:yieldBruta,yieldLiquida:yieldLiquida,
        cashflowMensal:cashflowMensal,breakEvenMeses:breakEvenMeses,serie:serie
      };
    },[valorImovel,pctFin,tan,prazo,rendaMensal,taxaOcupacao,crescimentoRenda,
       imiPct,condominio,manutPct,seguroMultirisco,outrosCustos,
       outrosIniciaisPct,horizonteAnos,valorizacaoAnual,capitalEmprestado,capitalProprio]);

    // ── Estilos (idênticos a comparacao-page.js) ──
    var cardS={background:"rgba(0,0,0,0.03)",borderRadius:11,padding:"13px 14px",marginBottom:10,border:"1px solid rgba(37,99,235,0.16)"};
    var secTitleS={fontSize:11,letterSpacing:3,color:Au,fontFamily:"monospace",marginBottom:10,textTransform:"uppercase"};
    var labelS={fontSize:11,color:"#374151",marginBottom:3,fontWeight:600,textTransform:"uppercase"};
    var fieldS={marginBottom:14};
    var thS={padding:"7px 10px",fontSize:11,color:"#374151",fontWeight:700,letterSpacing:0.5,borderBottom:"1px solid rgba(37,99,235,0.22)",background:"rgba(37,99,235,0.04)",textAlign:"right",whiteSpace:"nowrap"};
    var thSL={padding:"7px 10px",fontSize:11,color:"#374151",fontWeight:700,letterSpacing:0.5,borderBottom:"1px solid rgba(37,99,235,0.22)",background:"rgba(37,99,235,0.04)",textAlign:"left"};
    var tdS={padding:"7px 10px",fontSize:12,borderBottom:"1px solid rgba(0,0,0,0.05)",textAlign:"right",verticalAlign:"middle"};
    var tdSL={padding:"7px 10px",fontSize:12,borderBottom:"1px solid rgba(0,0,0,0.05)",textAlign:"left",verticalAlign:"middle"};

    // Yield líquida: verde >4%, laranja 2-4%, vermelho <2%
    var yieldColor=calc.yieldLiquida>=4?G:calc.yieldLiquida>=2?"#d97706":R;
    // Cash-flow: verde se >=0, vermelho se <0
    var cfColor=calc.cashflowMensal>=0?G:R;
    // Break-even (com financiamento): meses necessários incluindo prestação
    var breakEvenTotal=rendaMensal>0?calc.custosTotal/(rendaMensal*12)*12:Infinity;
    var beColor=breakEvenTotal<9?G:breakEvenTotal<11?"#d97706":R;
    var beImpossivel=breakEvenTotal>12;

    // Tabela: passo adaptativo
    var step=horizonteAnos<=12?1:(horizonteAnos<=24?2:5);
    var linhasTab=calc.serie.filter(function(row){return row.ano>0&&(row.ano%step===0||row.ano===horizonteAnos);});

    function ResumoCard(o){
      return h("div",{style:{flex:"1 1 160px",background:"rgba(255,255,255,1)",border:"1px solid "+(o.border||"rgba(37,99,235,0.16)"),borderRadius:10,padding:"12px 14px"}},
        h("div",{style:{fontSize:11,color:"#374151",fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}},o.label),
        h("div",{style:{fontSize:18,fontWeight:800,color:o.color||"#111827"}},o.value),
        o.sub&&h("div",{style:{fontSize:11,color:"#6b7280",marginTop:2}},o.sub)
      );
    }

    function inputField(label,node){ return h("div",{key:label,style:fieldS},h("div",{style:labelS},label),node); }

    function Accordion(k,title,bodyChildren){
      if(!IS_MOBILE){
        return h("div",{style:cardS},
          h("div",{style:secTitleS},title),
          bodyChildren
        );
      }
      var open=!!acc[k];
      return h("div",{style:cardS},
        h("div",{
          onClick:function(){toggleAcc(k);},
          role:"button","aria-expanded":open?"true":"false",
          style:{fontSize:11,letterSpacing:3,color:"#fff",background:Au,borderRadius:7,padding:"10px 12px",fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",WebkitTapHighlightColor:"transparent",marginBottom:open?12:0}
        },
          h("span",null,title),
          h("span",{style:{fontSize:14,fontWeight:800,lineHeight:1,color:"#fff",transform:open?"rotate(90deg)":"none",transition:"transform 0.2s",flexShrink:0}},"›")
        ),
        open&&h("div",null,bodyChildren)
      );
    }

    var semFinanciamento=pctFin===0;
    var inputDimStyle=semFinanciamento?{opacity:0.4,pointerEvents:"none"}:{};

    return h("div",{style:{background:N,minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",color:"#111827"}},
      h(window.PageHeader,{EUR:EUR,activePage:"rentabilidade",commentCount:commentCount,onOpenComments:onOpenComments,onOpenGlossario:onOpenGlossario,onOpenProcesso:onOpenProcesso,subtitle:"Yield bruta/líquida, cash-flow mensal e break-even de ocupação para imóvel de arrendamento"}),
      window.NoticeBanner&&h(window.NoticeBanner,null),
      h("div",{style:{maxWidth:1440,margin:"0 auto",padding:"14px 14px 40px"}},

        // ── Cards métricas-chave ──
        h("div",{style:{display:"flex",flexWrap:"wrap",gap:10,marginBottom:12}},
          ResumoCard({
            label:"Yield Bruta",
            value:fP1(calc.yieldBruta),
            sub:"renda anual / valor do imóvel (100% ocupação)",
            color:Au, border:"rgba(37,99,235,0.3)"
          }),
          ResumoCard({
            label:"Yield Líquida",
            value:isFinite(calc.yieldLiquida)?fP1(calc.yieldLiquida):"—",
            sub:"após custos operacionais e custos de aquisição",
            color:yieldColor,
            border:calc.yieldLiquida>=4?"rgba(22,163,74,0.3)":calc.yieldLiquida>=2?"rgba(217,119,6,0.3)":"rgba(220,38,38,0.3)"
          }),
          ResumoCard({
            label:"Cash-flow Mensal",
            value:(calc.cashflowMensal>=0?"+":"")+fE(calc.cashflowMensal),
            sub:semFinanciamento?"sem hipoteca — só custos op.":"após prestação + todos os custos",
            color:cfColor,
            border:calc.cashflowMensal>=0?"rgba(22,163,74,0.3)":"rgba(220,38,38,0.3)"
          }),
          ResumoCard({
            label:"Break-even Ocupação",
            value:beImpossivel?"Impossível":(Math.ceil(breakEvenTotal*10)/10).toFixed(1)+" meses/ano",
            sub:beImpossivel?"mesmo a 100% não cobre todos os custos":"de ocupação mínima para cobrir todos os custos",
            color:beColor,
            border:beColor==="rgba(22,163,74,0.3)"?"rgba(22,163,74,0.3)":beColor==="rgba(217,119,6,0.3)"?"rgba(217,119,6,0.3)":"rgba(220,38,38,0.3)"
          })
        ),

        // ── Inputs ──
        h("div",{style:{display:"grid",gridTemplateColumns:IS_MOBILE?"1fr":"repeat(auto-fit,minmax(300px,1fr))",gap:10,marginBottom:10}},

          Accordion("imovel","🏠 Imóvel & Financiamento",[
            inputField("Valor do imóvel",h(SliderInput,{min:50000,max:1000000,step:5000,value:valorImovel,onChange:setValorImovel,color:Au,prefix:"€",ariaLabel:"Valor do imóvel",formatFn:function(v){return Math.round(v).toLocaleString("pt-PT");}})),
            inputField("Financiamento — LTV (entrada "+fE(capitalProprio)+")",h(SliderInput,{min:0,max:90,step:5,value:pctFin,onChange:setPctFin,color:Au,suffix:"%",ariaLabel:"Percentagem de financiamento"})),
            h("div",{key:"prazo-wrap",style:Object.assign({},fieldS,inputDimStyle)},
              h("div",{style:labelS},"Prazo do crédito"),
              h(SliderInput,{min:5,max:40,step:1,value:prazo,onChange:setPrazo,color:Sky,suffix:"anos",ariaLabel:"Prazo do crédito"})
            ),
            h("div",{key:"tan",style:Object.assign({},fieldS,inputDimStyle)},
              h("div",{style:labelS},"TAN anual (%)"),
              h("div",{style:{display:"flex",alignItems:"center",gap:8}},
                h("input",{type:"number",step:"0.01",min:"0",max:"15",className:"val-compact",value:tanStr,onChange:function(e){setTanStr(e.target.value);},style:{width:90,padding:"6px 8px",border:"1px solid rgba(37,99,235,0.3)",borderRadius:6,fontSize:13}}),
                h("span",{style:{fontSize:11,color:"#6b7280"}},
                  semFinanciamento?"Sem financiamento — TAN não aplicável":"sugestão: Euribor 6m "+fP(eur6m)+" + spread ~1,5%"
                )
              )
            ),
            !semFinanciamento&&h("div",{key:"prestacao-info",style:{fontSize:11,color:"#6b7280",marginTop:4}},
              "Prestação estimada: ",h("strong",null,fE(calc.prestacaoMensal)+"/mês")," · ",fE(calc.prestacaoMensal*12)+"/ano"
            )
          ]),

          Accordion("rendimento","💰 Rendimento",[
            inputField("Renda mensal",h(SliderInput,{min:100,max:5000,step:25,value:rendaMensal,onChange:setRendaMensal,color:G,prefix:"€",ariaLabel:"Renda mensal",formatFn:function(v){return Math.round(v).toLocaleString("pt-PT");}})),
            inputField("Taxa de ocupação (renda efectiva "+fE(calc.rendaAnual/12)+"/mês)",h(SliderInput,{min:50,max:100,step:1,value:taxaOcupacao,onChange:setTaxaOcupacao,color:G,suffix:"%",ariaLabel:"Taxa de ocupação"})),
            inputField("Crescimento anual da renda",h(SliderInput,{min:0,max:5,step:0.1,value:crescimentoRenda,onChange:setCrescimentoRenda,color:Sky,suffix:"%/ano",ariaLabel:"Crescimento anual da renda"}))
          ]),

          Accordion("custos","💸 Custos Operacionais",[
            inputField("IMI anual ("+fE(calc.imiAnual)+"/ano)",h(SliderInput,{min:0,max:1.5,step:0.05,value:imiPct,onChange:setImiPct,color:"#f97316",suffix:"%",ariaLabel:"IMI anual"})),
            inputField("Condomínio",h(SliderInput,{min:0,max:500,step:5,value:condominio,onChange:setCondominio,color:"#f97316",suffix:"€/mês",ariaLabel:"Condomínio mensal"})),
            inputField("Manutenção anual ("+fE(calc.manutAnual)+"/ano)",h(SliderInput,{min:0,max:3,step:0.1,value:manutPct,onChange:setManutPct,color:"#f97316",suffix:"%",ariaLabel:"Manutenção anual"})),
            inputField("Seguro multiriscos",h(SliderInput,{min:0,max:2000,step:50,value:seguroMultirisco,onChange:setSeguroMultirisco,color:"#f97316",suffix:"€/ano",ariaLabel:"Seguro multiriscos"})),
            inputField("Outros custos mensais",h(SliderInput,{min:0,max:500,step:10,value:outrosCustos,onChange:setOutrosCustos,color:"#f97316",suffix:"€/mês",ariaLabel:"Outros custos mensais"})),
            h("div",{key:"custos-total",style:{fontSize:11,color:"#6b7280",marginTop:4}},
              "Custos operacionais: ",h("strong",null,fE(calc.custosOpAnuais)+"/ano")," (sem hipoteca)"
            )
          ]),

          Accordion("aquisicao","🏛️ Custos de Aquisição",[
            h("div",{key:"imt-info",style:Object.assign({},fieldS,{background:"rgba(0,0,0,0.02)",borderRadius:7,padding:"10px 12px"})},
              h("div",{style:Object.assign({},labelS,{marginBottom:6})},"IMT — Imposto Municipal sobre Transmissões"),
              h("div",{style:{fontSize:14,fontWeight:700,color:"#111827"}},fE(calc.imtTotal)),
              h("div",{style:{fontSize:11,color:"#6b7280",marginTop:2}},"2ª habitação / investimento (Tabela II OE 2026) — calculado automaticamente")
            ),
            h("div",{key:"is-info",style:Object.assign({},fieldS,{background:"rgba(0,0,0,0.02)",borderRadius:7,padding:"10px 12px"})},
              h("div",{style:Object.assign({},labelS,{marginBottom:6})},"Imposto de Selo sobre o imóvel (0,8%)"),
              h("div",{style:{fontSize:14,fontWeight:700,color:"#111827"}},fE(calc.isTotal)),
              h("div",{style:{fontSize:11,color:"#6b7280",marginTop:2}},"calculado automaticamente")
            ),
            inputField("Outros custos iniciais (notário, registo… "+fE(calc.outrosIniciais)+")",h(SliderInput,{min:0,max:3,step:0.1,value:outrosIniciaisPct,onChange:setOutrosIniciaisPct,color:"#f97316",suffix:"%",ariaLabel:"Outros custos iniciais"})),
            h("div",{key:"total-investido",style:{fontSize:11,color:"#374151",marginTop:4,fontWeight:600}},
              "Investimento inicial total: ",h("strong",{style:{color:Au}},fE(calc.totalInvestido)),
              h("span",{style:{fontWeight:400,color:"#6b7280"}}," (entrada + IMT + IS + outros)")
            )
          ]),

          Accordion("horizonte","📅 Horizonte de Investimento",[
            inputField("Horizonte de análise",h(SliderInput,{min:5,max:30,step:1,value:horizonteAnos,onChange:setHorizonteAnos,color:Au,suffix:"anos",ariaLabel:"Horizonte de análise"})),
            inputField("Valorização anual do imóvel",h(SliderInput,{min:0,max:10,step:0.5,value:valorizacaoAnual,onChange:setValorizacaoAnual,color:G,suffix:"%/ano",ariaLabel:"Valorização anual do imóvel"}))
          ])
        ),

        // ── Gráfico ──
        ResponsiveContainer&&h("div",{style:Object.assign({},cardS,{padding:"13px 0 13px",overflow:"hidden"})},
          h("div",{style:Object.assign({},secTitleS,{paddingLeft:14,paddingRight:14})},"📈 Evolução do investimento"),
          h("div",{style:{fontSize:12,color:"#6b7280",marginBottom:8,paddingLeft:14,paddingRight:14}},"Cash-flow acumulado, equity do imóvel e retorno total ao longo do horizonte de investimento."),
          h(ResponsiveContainer,{width:"100%",height:IS_MOBILE?260:400},
            h(LineChart,{data:calc.serie,margin:IS_MOBILE?{top:5,right:12,left:0,bottom:24}:{top:8,right:24,left:8,bottom:28}},
              h(CartesianGrid,{strokeDasharray:"3 3",stroke:"rgba(0,0,0,0.05)"}),
              h(XAxis,{dataKey:"ano",tick:{fill:"#374151",fontSize:IS_MOBILE?10:11},axisLine:false,tickLine:false,tickFormatter:function(v){return v+"a";}}),
              h(YAxis,{width:IS_MOBILE?52:68,tick:{fill:"#374151",fontSize:IS_MOBILE?10:11},axisLine:false,tickLine:false,tickFormatter:function(v){return Math.round(v/1000)+"k€";}}),
              h(Tooltip,{formatter:function(v,n){return [fE(v),n];},contentStyle:{background:"#ffffff",border:"1px solid "+Au,borderRadius:8,color:"#111827",fontFamily:"sans-serif",fontSize:12},labelFormatter:function(l){return "Ano "+l;}}),
              h(Legend,{verticalAlign:"bottom",iconSize:10,wrapperStyle:{paddingTop:8,fontSize:IS_MOBILE?11:12,fontFamily:"sans-serif",color:"#374151"}}),
              h(Line,{type:"monotone",dataKey:"cashflowAcumulado",name:"Cash-flow acumulado",stroke:Sky,strokeWidth:2,dot:false}),
              h(Line,{type:"monotone",dataKey:"equity",name:"Equity (imóvel − dívida)",stroke:G,strokeWidth:2.5,dot:false}),
              h(Line,{type:"monotone",dataKey:"retornoTotal",name:"Retorno total",stroke:Au,strokeWidth:2,dot:false,strokeDasharray:"5 3"})
            )
          )
        ),

        // ── Tabela anual ──
        h("div",{style:cardS},
          h("div",{style:secTitleS},"📊 Detalhe ano a ano"),
          h("div",{style:{overflowX:"auto"}},
            h("table",{style:{width:"100%",borderCollapse:"collapse",minWidth:620}},
              h("thead",null,h("tr",null,
                h("th",{style:thSL},"Ano"),
                h("th",{style:thS},"Renda (efectiva)"),
                h("th",{style:thS},"Custos totais"),
                h("th",{style:thS},"Cash-flow anual"),
                h("th",{style:thS},"CF acumulado"),
                h("th",{style:thS},"Saldo devedor"),
                h("th",{style:thS},"Equity")
              )),
              h("tbody",null,
                linhasTab.map(function(row){
                  var cfPos=row.cashflowAno>=0;
                  return h("tr",{key:row.ano,style:{background:cfPos?"rgba(22,163,74,0.04)":"transparent"}},
                    h("td",{style:tdSL},row.ano+"a"),
                    h("td",{style:tdS},fE(row.rendaBruta)),
                    h("td",{style:tdS},fE(row.custosAno)),
                    h("td",{style:Object.assign({},tdS,{color:cfPos?G:R,fontWeight:600})},fE(row.cashflowAno)),
                    h("td",{style:Object.assign({},tdS,{color:row.cashflowAcumulado>=0?G:R})},fE(row.cashflowAcumulado)),
                    h("td",{style:tdS},fE(row.divida)),
                    h("td",{style:Object.assign({},tdS,{color:G,fontWeight:700})},fE(row.equity))
                  );
                })
              )
            )
          )
        ),

        // ── Disclaimer ──
        h("div",{style:{fontSize:11,color:"#6b7280",lineHeight:1.6,padding:"4px 4px 0"}},
          "⚠️ Simulação informativa, não é aconselhamento financeiro. ",
          "Yield líquida calculada sobre renda efectiva (ajustada à taxa de ocupação) menos custos operacionais, dividida pelo investimento inicial total (entrada + IMT + IS + outros). ",
          "Break-even de ocupação indica os meses/ano necessários para cobrir todos os custos incluindo a prestação. ",
          "Custos operacionais projetados com crescimento de metade da taxa de renda (heurística conservadora). Confirme sempre com consultores especializados."
        )

      ),
      window.PageFooter&&h(window.PageFooter,null),
      window.CookieBanner&&h(window.CookieBanner,null)
    );
  }

  window.RentabilidadePage=RentabilidadePage;
})();
