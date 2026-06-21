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
  var SliderInput=window._SIM.SliderInput;
  var FALLBACK_EUR=window._SIM.FALLBACK_EUR;
  var Au=window._SIM.Au;
  var G=window._SIM.G;
  var R=window._SIM.R;
  var N=window._SIM.N;
  var Sky=window._SIM.Sky;

  // Funções do motor de cálculo partilhado (js/core/calc.js)
  var calcP=window._SIM.calcP;
  var calcIMT=window._SIM.calcIMT;
  var sTot=window._SIM.sTot;

  // Recharts (carregado via recharts-polyfill.js na página)
  var RC=window.Recharts||{};
  var ResponsiveContainer=RC.ResponsiveContainer;
  var LineChart=RC.LineChart, Line=RC.Line, XAxis=RC.XAxis, YAxis=RC.YAxis;
  var CartesianGrid=RC.CartesianGrid, Tooltip=RC.Tooltip, Legend=RC.Legend;

  // Configuração representativa de seguros (média do mercado) — usada por sTot.
  // Vida escala com capital/idade; multirriscos com o valor do imóvel.
  var SEG_G={vRef:16,vCap:150000,vAge:30,mAno:180,pRef:200000};

  // Saldo em dívida ao fim de `meses` (tabela price)
  function saldoDevedor(C,tanA,anos,meses){
    var r=tanA/100/12, P=calcP(C,tanA,anos), s=C;
    var lim=Math.min(meses,anos*12);
    for(var m=0;m<lim;m++){ s=s-(P-s*r); }
    return Math.max(0,s);
  }

  function veredictoColor(comprarCompensa){ return comprarCompensa?G:R; }

  function ComparacaoPage(props){
    var EUR=props.EUR||FALLBACK_EUR;
    var commentCount=props.commentCount||0;
    var onOpenComments=props.onOpenComments||function(){};
    var onOpenGlossario=props.onOpenGlossario||null;

    // ── Inputs: Compra ──
    var _vi=useState(250000);
    var valorImovel=_vi[0]; var setValorImovel=_vi[1];
    var _pf=useState(80);
    var pctFin=_pf[0]; var setPctFin=_pf[1];
    var _pz=useState(30);
    var prazo=_pz[0]; var setPrazo=_pz[1];
    var eur6m=(EUR["6m"]&&EUR["6m"].valor)||FALLBACK_EUR["6m"].valor;
    var _tan=useState(function(){return (eur6m+1.0).toFixed(2);});
    var tanStr=_tan[0]; var setTanStr=_tan[1];
    var _idade=useState(35);
    var idade=_idade[0]; var setIdade=_idade[1];

    // ── Inputs: custos correntes de compra ──
    var _imi=useState(0.3);
    var imiPct=_imi[0]; var setImiPct=_imi[1];
    var _man=useState(1.0);
    var manutPct=_man[0]; var setManutPct=_man[1];
    var _cond=useState(0);
    var condominio=_cond[0]; var setCondominio=_cond[1];

    // ── Inputs: Arrendamento ──
    var _renda=useState(1000);
    var renda=_renda[0]; var setRenda=_renda[1];
    var _ra=useState(2);
    var rendaAtualiz=_ra[0]; var setRendaAtualiz=_ra[1];

    // ── Inputs: Pressupostos da comparação ──
    var _val=useState(2);
    var valorizacao=_val[0]; var setValorizacao=_val[1];
    var _hz=useState(10);
    var horizonte=_hz[0]; var setHorizonte=_hz[1];

    var tan=parseFloat(tanStr)||0;
    var capital=Math.round(valorImovel*pctFin/100);
    var entrada=valorImovel-capital;

    var calc=useMemo(function(){
      // Custos iniciais de compra
      var imt=calcIMT(valorImovel,0,"hpp");
      var isAquisicao=valorImovel*0.008;   // IS sobre aquisição (verba 1.1)
      var isCredito=capital*0.006;          // IS sobre o crédito (verba 17.1)
      var custosFixos=1500;                 // escritura + registo + dossier/avaliação (estimativa)
      var custosIniciais=imt+isAquisicao+isCredito+custosFixos;

      var prestacaoMensal=calcP(capital,tan,prazo);
      var seg=sTot(SEG_G,idade,0,false,capital,valorImovel,prazo);
      var segMensal=seg.tot;
      var imiAno=valorImovel*imiPct/100;
      var manutAno=valorImovel*manutPct/100;

      var maxAnos=Math.max(horizonte,prazo);
      var serie=[]; // ano a ano
      var breakEven=null;

      for(var t=0;t<=maxAnos;t++){
        var meses=t*12;
        // Desembolso de compra acumulado (cash out)
        var desembolso=entrada+custosIniciais
          +prestacaoMensal*meses
          +segMensal*meses
          +condominio*meses
          +imiAno*t
          +manutAno*t;
        var imovelVal=valorImovel*Math.pow(1+valorizacao/100,t);
        var divida=saldoDevedor(capital,tan,prazo,meses);
        var equity=imovelVal-divida;
        var custoLiqComprar=desembolso-equity;
        // Renda acumulada (atualização anual composta)
        var rendaAcum=0;
        for(var k=1;k<=t;k++){ rendaAcum+=12*renda*Math.pow(1+rendaAtualiz/100,k-1); }

        if(breakEven===null&&t>0&&custoLiqComprar<=rendaAcum)breakEven=t;

        if(t<=horizonte){
          serie.push({
            ano:t,
            Comprar:Math.round(custoLiqComprar),
            Arrendar:Math.round(rendaAcum),
            desembolso:Math.round(desembolso),
            imovel:Math.round(imovelVal),
            divida:Math.round(divida),
            equity:Math.round(equity)
          });
        }
      }

      var fim=serie[serie.length-1]||serie[0];
      var comprarCompensa=fim.Comprar<=fim.Arrendar;

      return {
        custosIniciais:custosIniciais, imt:imt, isAquisicao:isAquisicao, isCredito:isCredito, custosFixos:custosFixos,
        prestacaoMensal:prestacaoMensal, segMensal:segMensal, imiAno:imiAno, manutAno:manutAno,
        serie:serie, breakEven:breakEven, fim:fim, comprarCompensa:comprarCompensa
      };
    },[valorImovel,capital,entrada,tan,prazo,idade,imiPct,manutPct,condominio,renda,rendaAtualiz,valorizacao,horizonte]);

    // Estilos (consistentes com transferencia-page.js)
    var cardS={background:"rgba(0,0,0,0.03)",borderRadius:11,padding:"13px 14px",marginBottom:10,border:"1px solid rgba(37,99,235,0.16)"};
    var secTitleS={fontSize:11,letterSpacing:3,color:Au,fontFamily:"monospace",marginBottom:10,textTransform:"uppercase"};
    var labelS={fontSize:11,color:"#374151",marginBottom:3,fontWeight:600,textTransform:"uppercase"};
    var fieldS={marginBottom:14};
    var thS={padding:"7px 10px",fontSize:11,color:"#374151",fontWeight:700,letterSpacing:0.5,borderBottom:"1px solid rgba(37,99,235,0.22)",background:"rgba(37,99,235,0.04)",textAlign:"right",whiteSpace:"nowrap"};
    var thSL={padding:"7px 10px",fontSize:11,color:"#374151",fontWeight:700,letterSpacing:0.5,borderBottom:"1px solid rgba(37,99,235,0.22)",background:"rgba(37,99,235,0.04)",textAlign:"left"};
    var tdS={padding:"7px 10px",fontSize:12,borderBottom:"1px solid rgba(0,0,0,0.05)",textAlign:"right",verticalAlign:"middle"};
    var tdSL={padding:"7px 10px",fontSize:12,borderBottom:"1px solid rgba(0,0,0,0.05)",textAlign:"left",verticalAlign:"middle"};

    var fim=calc.fim;
    var diff=Math.abs(fim.Comprar-fim.Arrendar);

    // Tabela: escolher passo de anos para não ficar gigante
    var step=horizonte<=12?1:(horizonte<=24?2:5);
    var linhasTab=calc.serie.filter(function(row){return row.ano>0&&(row.ano%step===0||row.ano===horizonte);});

    // ── Cards-resumo ──
    function ResumoCard(o){
      return h("div",{style:{flex:"1 1 160px",background:"rgba(255,255,255,1)",border:"1px solid "+(o.border||"rgba(37,99,235,0.16)"),borderRadius:10,padding:"12px 14px"}},
        h("div",{style:{fontSize:11,color:"#374151",fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}},o.label),
        h("div",{style:{fontSize:18,fontWeight:800,color:o.color||"#111827"}},o.value),
        o.sub&&h("div",{style:{fontSize:11,color:"#6b7280",marginTop:2}},o.sub)
      );
    }

    function inputField(label,node){ return h("div",{style:fieldS},h("div",{style:labelS},label),node); }

    return h("div",{style:{background:N,minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",color:"#111827"}},
      h(window.PageHeader,{EUR:EUR,activePage:"comparacao",commentCount:commentCount,onOpenComments:onOpenComments,onOpenGlossario:onOpenGlossario,subtitle:"Comprar com crédito habitação vs arrendar · Prestação, seguros, IMI, valorização e o ano em que comprar compensa"}),
      window.NoticeBanner&&h(window.NoticeBanner,null),
      h("div",{style:{maxWidth:1440,margin:"0 auto",padding:"14px 14px 40px"}},

        // ── Veredicto ──
        h("div",{style:{background:calc.comprarCompensa?"rgba(22,163,74,0.08)":"rgba(220,38,38,0.06)",border:"1px solid "+(calc.comprarCompensa?"rgba(22,163,74,0.35)":"rgba(220,38,38,0.3)"),borderRadius:11,padding:"14px 16px",marginBottom:12}},
          h("div",{style:{fontSize:IS_MOBILE?16:19,fontWeight:800,color:veredictoColor(calc.comprarCompensa),marginBottom:4}},
            calc.comprarCompensa?("✅ Ao fim de "+horizonte+" anos, COMPRAR compensa"):("⏳ Ao fim de "+horizonte+" anos, ARRENDAR ainda compensa")
          ),
          h("div",{style:{fontSize:13,color:"#374151"}},
            calc.comprarCompensa
              ?("Comprar fica "+fE(diff)+" mais barato (custo líquido, já a contar com a valorização e o capital amortizado).")
              :("Arrendar fica "+fE(diff)+" mais barato neste horizonte — os custos iniciais de compra ainda não foram recuperados.")
          ),
          h("div",{style:{fontSize:13,color:"#374151",marginTop:4}},
            calc.breakEven!==null
              ?h("span",null,"Ponto de equilíbrio: comprar passa a compensar a partir do ",h("strong",{style:{color:G}},"ano "+calc.breakEven),".")
              :h("span",null,"Dentro do prazo do crédito (",prazo," anos), comprar ",h("strong",{style:{color:R}},"nunca chega a compensar")," com estes pressupostos.")
          )
        ),

        // ── Cards-resumo ──
        h("div",{style:{display:"flex",flexWrap:"wrap",gap:10,marginBottom:12}},
          ResumoCard({label:"Prestação mensal",value:fE(calc.prestacaoMensal),sub:"+ seguros "+fE(calc.segMensal)+"/mês",color:Au}),
          ResumoCard({label:"Renda inicial",value:fE(renda),sub:"atualiza "+fP(rendaAtualiz)+"/ano",color:Sky}),
          ResumoCard({label:"Custo líq. comprar ("+horizonte+"a)",value:fE(fim.Comprar),color:calc.comprarCompensa?G:"#111827",border:"rgba(22,163,74,0.3)"}),
          ResumoCard({label:"Custo arrendar ("+horizonte+"a)",value:fE(fim.Arrendar),color:!calc.comprarCompensa?R:"#111827",border:"rgba(220,38,38,0.25)"}),
          ResumoCard({label:"Património ao fim de "+horizonte+"a",value:fE(fim.equity),sub:"imóvel "+fE(fim.imovel)+" − dívida "+fE(fim.divida),color:G,border:"rgba(22,163,74,0.3)"})
        ),

        // ── Inputs ──
        h("div",{style:{display:"grid",gridTemplateColumns:IS_MOBILE?"1fr":"repeat(auto-fit,minmax(300px,1fr))",gap:10,marginBottom:10}},
          h("div",{style:cardS},
            h("div",{style:secTitleS},"🏠 Compra"),
            inputField("Valor do imóvel",h(SliderInput,{min:50000,max:1000000,step:5000,value:valorImovel,onChange:setValorImovel,color:Au,prefix:"€",ariaLabel:"Valor do imóvel",formatFn:function(v){return Math.round(v).toLocaleString("pt-PT");}})),
            inputField("Financiamento ("+fP(pctFin)+" · entrada "+fE(entrada)+")",h(SliderInput,{min:10,max:100,step:1,value:pctFin,onChange:setPctFin,color:Au,suffix:"%",ariaLabel:"Percentagem de financiamento"})),
            inputField("Prazo do crédito",h(SliderInput,{min:10,max:40,step:1,value:prazo,onChange:setPrazo,color:Sky,suffix:"anos",ariaLabel:"Prazo do crédito"})),
            h("div",{style:fieldS},
              h("div",{style:labelS},"TAN anual (%)"),
              h("div",{style:{display:"flex",alignItems:"center",gap:8}},
                h("input",{type:"number",step:"0.01",min:"0",max:"15",className:"val-compact",value:tanStr,onChange:function(e){setTanStr(e.target.value);},style:{width:90,padding:"6px 8px",border:"1px solid rgba(37,99,235,0.3)",borderRadius:6,fontSize:13}}),
                h("span",{style:{fontSize:11,color:"#6b7280"}},"sugestão: Euribor 6m "+fP(eur6m)+" + spread ~1%")
              )
            ),
            inputField("Idade (para seguros)",h(SliderInput,{min:18,max:75,step:1,value:idade,onChange:setIdade,color:Au,suffix:"anos",ariaLabel:"Idade"}))
          ),
          h("div",{style:cardS},
            h("div",{style:secTitleS},"💸 Custos correntes (compra)"),
            inputField("IMI anual ("+fE(calc.imiAno)+"/ano)",h(SliderInput,{min:0,max:1,step:0.05,value:imiPct,onChange:setImiPct,color:"#f97316",suffix:"%",ariaLabel:"IMI anual"})),
            inputField("Manutenção anual ("+fE(calc.manutAno)+"/ano)",h(SliderInput,{min:0,max:3,step:0.1,value:manutPct,onChange:setManutPct,color:"#f97316",suffix:"%",ariaLabel:"Manutenção anual"})),
            inputField("Condomínio",h(SliderInput,{min:0,max:500,step:5,value:condominio,onChange:setCondominio,color:"#f97316",suffix:"€/mês",ariaLabel:"Condomínio mensal"})),
            h("div",{style:{fontSize:11,color:"#6b7280",marginTop:4,lineHeight:1.5}},
              "Custos iniciais estimados: ",h("strong",null,fE(calc.custosIniciais)),
              " (IMT "+fE(calc.imt)+" · IS aquisição "+fE(calc.isAquisicao)+" · IS crédito "+fE(calc.isCredito)+" · escritura/registo "+fE(calc.custosFixos)+")"
            )
          ),
          h("div",{style:cardS},
            h("div",{style:secTitleS},"🔑 Arrendamento & pressupostos"),
            inputField("Renda mensal",h(SliderInput,{min:200,max:5000,step:25,value:renda,onChange:setRenda,color:Sky,prefix:"€",ariaLabel:"Renda mensal",formatFn:function(v){return Math.round(v).toLocaleString("pt-PT");}})),
            inputField("Atualização anual da renda",h(SliderInput,{min:0,max:10,step:0.5,value:rendaAtualiz,onChange:setRendaAtualiz,color:Sky,suffix:"%",ariaLabel:"Atualização anual da renda"})),
            inputField("Valorização anual do imóvel",h(SliderInput,{min:-2,max:8,step:0.5,value:valorizacao,onChange:setValorizacao,color:G,suffix:"%",ariaLabel:"Valorização anual do imóvel"})),
            inputField("Horizonte de comparação",h(SliderInput,{min:3,max:40,step:1,value:horizonte,onChange:setHorizonte,color:Au,suffix:"anos",ariaLabel:"Horizonte de comparação"}))
          )
        ),

        // ── Gráfico ──
        ResponsiveContainer&&h("div",{style:cardS},
          h("div",{style:secTitleS},"📈 Custo acumulado ao longo dos anos"),
          h("div",{style:{fontSize:12,color:"#6b7280",marginBottom:8}},"Linha mais baixa = opção mais barata. O cruzamento é o ponto de equilíbrio."),
          h(ResponsiveContainer,{width:"100%",height:IS_MOBILE?240:300},
            h(LineChart,{data:calc.serie,margin:{top:5,right:10,left:5,bottom:5}},
              h(CartesianGrid,{strokeDasharray:"3 3",stroke:"rgba(0,0,0,0.05)"}),
              h(XAxis,{dataKey:"ano",tick:{fill:"#374151",fontSize:11},axisLine:false,tickLine:false,tickFormatter:function(v){return v+"a";}}),
              h(YAxis,{tick:{fill:"#374151",fontSize:11},axisLine:false,tickLine:false,tickFormatter:function(v){return Math.round(v/1000)+"k€";}}),
              h(Tooltip,{formatter:function(v,n){return [fE(v),n];},contentStyle:{background:"#ffffff",border:"1px solid "+Au,borderRadius:8,color:"#111827",fontFamily:"sans-serif",fontSize:12},labelFormatter:function(l){return "Ano "+l;}}),
              h(Legend,{wrapperStyle:{color:"#374151",fontSize:12,fontFamily:"sans-serif"}}),
              h(Line,{type:"monotone",dataKey:"Arrendar",name:"Arrendar (renda paga)",stroke:R,strokeWidth:2,dot:false}),
              h(Line,{type:"monotone",dataKey:"Comprar",name:"Comprar (custo líquido)",stroke:G,strokeWidth:2.5,dot:false})
            )
          )
        ),

        // ── Tabela ──
        h("div",{style:cardS},
          h("div",{style:secTitleS},"📊 Detalhe ano a ano"),
          h("div",{style:{overflowX:"auto"}},
            h("table",{style:{width:"100%",borderCollapse:"collapse",minWidth:560}},
              h("thead",null,h("tr",null,
                h("th",{style:thSL},"Ano"),
                h("th",{style:thS},"Desembolso compra"),
                h("th",{style:thS},"Renda paga"),
                h("th",{style:thS},"Imóvel"),
                h("th",{style:thS},"Dívida"),
                h("th",{style:thS},"Património"),
                h("th",{style:thS},"Custo líq. comprar")
              )),
              h("tbody",null,
                linhasTab.map(function(row){
                  var compensa=row.Comprar<=row.Arrendar;
                  return h("tr",{key:row.ano,style:{background:compensa?"rgba(22,163,74,0.05)":"transparent"}},
                    h("td",{style:tdSL},row.ano+"a"),
                    h("td",{style:tdS},fE(row.desembolso)),
                    h("td",{style:tdS},fE(row.Arrendar)),
                    h("td",{style:tdS},fE(row.imovel)),
                    h("td",{style:tdS},fE(row.divida)),
                    h("td",{style:Object.assign({},tdS,{color:G,fontWeight:600})},fE(row.equity)),
                    h("td",{style:Object.assign({},tdS,{color:compensa?G:R,fontWeight:700})},fE(row.Comprar))
                  );
                })
              )
            )
          )
        ),

        // ── Disclaimer ──
        h("div",{style:{fontSize:11,color:"#6b7280",lineHeight:1.6,padding:"4px 4px 0"}},
          "⚠️ Simulação informativa, não é aconselhamento financeiro. ",
          "O «custo líquido de comprar» = todo o dinheiro desembolsado (entrada, custos iniciais, prestações, seguros, IMI, manutenção, condomínio) menos o património acumulado no imóvel (valor valorizado − capital em dívida). ",
          "O cenário de arrendamento não assume que a entrada poupada seja investida. Seguros estimados com valores médios de mercado. Impostos e taxas podem variar; confirme sempre com o banco e simuladores oficiais."
        )

      ),
      window.PageFooter&&h(window.PageFooter,null),
      window.CookieBanner&&h(window.CookieBanner,null)
    );
  }

  window.ComparacaoPage=ComparacaoPage;
})();
