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

  // calcP e getLTVAddon vêm de js/core/calc.js (fonte única)
  var calcP=window._SIM.calcP;
  var getLTVAddon=window._SIM.getLTVAddon;
  var BANK_DOMAINS=window._SIM.BANK_DOMAINS;

  function breakEvenColor(months,remainingMonths){
    if(!isFinite(months)||months>=remainingMonths)return R;
    if(months<24)return G;
    if(months<48)return "#b45309";
    if(months<remainingMonths)return "#d97706";
    return R;
  }

  function TipoBtn(props){
    var active=props.active,label=props.label,onClick=props.onClick;
    return h("button",{
      onClick:onClick,
      style:{
        padding:"6px 10px",border:"1px solid "+(active?Au:"rgba(0,0,0,0.08)"),borderRadius:6,cursor:"pointer",
        fontSize:12,fontWeight:active?700:400,
        background:active?"rgba(37,99,235,0.1)":"transparent",
        color:active?Au:"#374151"
      }
    },label);
  }

  function TransferenciaPage(props){
    var EUR=props.EUR||FALLBACK_EUR;
    var banksFromApi=props.banks||[];
    var commentCount=props.commentCount||0;
    var onOpenComments=props.onOpenComments||function(){};
    var onOpenGlossario=props.onOpenGlossario||null;

    var _cap=useState(150000);
    var capital=_cap[0]; var setCapital=_cap[1];

    var _prazo=useState(25);
    var prazoRestante=_prazo[0]; var setPrazoRestante=_prazo[1];

    var _taxa=useState("3.50");
    var taxaAtualStr=_taxa[0]; var setTaxaAtualStr=_taxa[1];

    var _tipo=useState("variavel");
    var tipoTaxaAtual=_tipo[0]; var setTipoTaxaAtual=_tipo[1];

    var _imovel=useState(200000);
    var valorImovel=_imovel[0]; var setValorImovel=_imovel[1];

    var _eRef=useState("6m");
    var euriborRef=_eRef[0]; var setEuriborRef=_eRef[1];

    var _sort=useState("poupancaTotal");
    var sortBy=_sort[0]; var setSortBy=_sort[1];

    var _withProd=useState(true);
    var withProd=_withProd[0]; var setWithProd=_withProd[1];

    var taxaAtual=parseFloat(taxaAtualStr)||0;
    var ltv=valorImovel>0?Math.round(capital/valorImovel*100*10)/10:0;
    var remainingMonths=prazoRestante*12;
    var prestacaoAtual=calcP(capital,taxaAtual,prazoRestante);
    var penaltyRate=tipoTaxaAtual==="fixa"?0.02:0.005;
    var penaltyCost=Math.round(capital*penaltyRate);

    var resultados=useMemo(function(){
      if(!banksFromApi||banksFromApi.length===0)return[];
      var euriborVal=EUR[euriborRef]?EUR[euriborRef].valor:EUR["6m"].valor;
      var rows=[];
      for(var i=0;i<banksFromApi.length;i++){
        var bank=banksFromApi[i];
        var sp=bank.spreads||{};
        var bankCode=bank.code||bank.s;
        var capMin=sp.capMin||0;
        var capMax=sp.capMax||9999999;
        if(capital<capMin||capital>capMax)continue;

        var useRef=euriborRef;
        var bankRefs=bank.refs||[];
        var refMismatch=bankRefs.length>0&&bankRefs.indexOf(euriborRef)<0;
        if(refMismatch)useRef=bankRefs[0];
        var eurVal=EUR[useRef]?EUR[useRef].valor:euriborVal;

        var spread=withProd?(sp.sCom||0):(sp.sSem||0);
        var ltvAddon=getLTVAddon(bankCode,ltv);
        var newTAN=eurVal+spread+ltvAddon;
        var prestacaoNova=calcP(capital,newTAN,prazoRestante);
        var poupancaMensal=prestacaoAtual-prestacaoNova;
        var setupCosts=(sp.dossier||0)+(sp.avaliacao||0)+(sp.minutas||0);
        var custoTransf=penaltyCost+setupCosts;
        var equilibrioMeses=poupancaMensal>0?Math.ceil(custoTransf/poupancaMensal):Infinity;
        var poupancaTotal=Math.round(poupancaMensal*remainingMonths-custoTransf);
        var compensador=isFinite(equilibrioMeses)&&equilibrioMeses<remainingMonths&&poupancaMensal>0;
        rows.push({
          code:bankCode,
          name:bank.name||bankCode,
          color:bank.color||"#999",
          spread:spread,
          ltvAddon:ltvAddon,
          newTAN:newTAN,
          useRef:useRef,
          refMismatch:refMismatch,
          prestacaoNova:prestacaoNova,
          poupancaMensal:poupancaMensal,
          setupCosts:setupCosts,
          custoTransf:custoTransf,
          equilibrioMeses:equilibrioMeses,
          poupancaTotal:poupancaTotal,
          compensador:compensador,
          capMin:capMin
        });
      }
      rows.sort(function(a,b){
        if(sortBy==="poupancaMensal")return b.poupancaMensal-a.poupancaMensal;
        if(sortBy==="equilibrio"){
          if(!isFinite(a.equilibrioMeses)&&!isFinite(b.equilibrioMeses))return 0;
          if(!isFinite(a.equilibrioMeses))return 1;
          if(!isFinite(b.equilibrioMeses))return -1;
          return a.equilibrioMeses-b.equilibrioMeses;
        }
        return b.poupancaTotal-a.poupancaTotal;
      });
      return rows;
    },[banksFromApi,capital,prazoRestante,taxaAtual,valorImovel,euriborRef,withProd,sortBy,EUR,penaltyCost,prestacaoAtual,remainingMonths,ltv]);

    var ltvColor=ltv<=80?G:ltv<=90?"#b45309":R;

    // Sistema tipográfico consistente — herda Inter do wrapper, sem "sans-serif" explícito
    var cardS={background:"rgba(0,0,0,0.03)",borderRadius:11,padding:"13px 14px",marginBottom:10,border:"1px solid rgba(37,99,235,0.16)"};
    var secTitleS={fontSize:11,letterSpacing:3,color:Au,fontFamily:"monospace",marginBottom:10,textTransform:"uppercase"};
    var labelS={fontSize:11,color:"#374151",marginBottom:3,fontWeight:600,textTransform:"uppercase"};
    var fieldS={marginBottom:14};
    var thS={padding:"7px 10px",fontSize:11,color:"#374151",fontWeight:700,letterSpacing:0.5,borderBottom:"1px solid rgba(37,99,235,0.22)",background:"rgba(37,99,235,0.04)",textAlign:"right",whiteSpace:"nowrap"};
    var thSL={padding:"7px 10px",fontSize:11,color:"#374151",fontWeight:700,letterSpacing:0.5,borderBottom:"1px solid rgba(37,99,235,0.22)",background:"rgba(37,99,235,0.04)",textAlign:"left"};
    var tdS={padding:"7px 10px",fontSize:12,borderBottom:"1px solid rgba(0,0,0,0.05)",textAlign:"right",verticalAlign:"middle"};
    var tdSL={padding:"7px 10px",fontSize:12,borderBottom:"1px solid rgba(0,0,0,0.05)",textAlign:"left",verticalAlign:"middle"};

    return h("div",{style:{background:N,minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",color:"#111827"}},
      h(window.PageHeader,{EUR:EUR,activePage:"transferencia",commentCount:commentCount,onOpenComments:onOpenComments,onOpenGlossario:onOpenGlossario,subtitle:"Simula a transferência do teu crédito habitação para outro banco · Compara poupanças mensais, custos e ponto de equilíbrio"}),
      window.NoticeBanner&&h(window.NoticeBanner,null),
      h("div",{style:{maxWidth:1440,margin:"0 auto",padding:"14px 14px 40px"}},

        h("div",{style:cardS},
          h("div",{style:secTitleS},"Dados do crédito atual"),
          h("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"0 28px"}},
            h("div",null,
              h("div",{style:fieldS},
                h("div",{style:labelS},"Capital em dívida"),
                h(SliderInput,{min:10000,max:1000000,step:5000,value:capital,onChange:setCapital,color:Au,prefix:"€",ariaLabel:"Capital em dívida",formatFn:function(v){return Math.round(v).toLocaleString("pt-PT");}})
              ),
              h("div",{style:fieldS},
                h("div",{style:labelS},"Prazo restante"),
                h(SliderInput,{min:1,max:40,step:1,value:prazoRestante,onChange:setPrazoRestante,color:Sky,suffix:"anos",ariaLabel:"Prazo restante"})
              ),
              h("div",{style:fieldS},
                h("div",{style:labelS},"Taxa anual atual (TAN %)"),
                h("div",{style:{display:"flex",alignItems:"center",gap:8}},
                  h("input",{
                    type:"number",step:"0.01",min:"0",max:"15",
                    className:"val-compact",
                    value:taxaAtualStr,
                    onChange:function(e){setTaxaAtualStr(e.target.value);},
                    style:{width:78,padding:"2px 6px",background:"rgba(37,99,235,0.05)",border:"1px solid rgba(37,99,235,0.22)",borderRadius:6,color:"#111827",fontSize:12,fontWeight:600,textAlign:"right",outline:"none"}
                  }),
                  h("span",{style:{fontSize:14,color:"#374151"}},"%")
                )
              ),
              h("div",{style:fieldS},
                h("div",{style:labelS},"Tipo de taxa atual (afeta penalização)"),
                h("div",{style:{display:"flex",gap:6}},
                  h(TipoBtn,{active:tipoTaxaAtual==="variavel",label:"Variável / Mista (0,5%)",onClick:function(){setTipoTaxaAtual("variavel");}}),
                  h(TipoBtn,{active:tipoTaxaAtual==="fixa",label:"Fixa (2%)",onClick:function(){setTipoTaxaAtual("fixa");}})
                )
              )
            ),
            h("div",null,
              h("div",{style:fieldS},
                h("div",{style:labelS},"Valor do imóvel (para calcular LTV)"),
                h(SliderInput,{min:50000,max:2000000,step:5000,value:valorImovel,onChange:setValorImovel,color:"#7c3aed",prefix:"€",ariaLabel:"Valor do imóvel",formatFn:function(v){return Math.round(v).toLocaleString("pt-PT");}})
              ),
              h("div",{style:fieldS},
                h("div",{style:labelS},"Indexante Euribor (nova taxa)"),
                h("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                  ["3m","6m","12m"].map(function(r){return h(TipoBtn,{key:r,active:euriborRef===r,label:"Euribor "+r,onClick:function(){setEuriborRef(r);}});})
                )
              ),
              h("div",{style:fieldS},
                h("div",{style:labelS},"Mostrar spread"),
                h("div",{style:{display:"flex",gap:6}},
                  h(TipoBtn,{active:withProd,label:"Com produtos vinculados",onClick:function(){setWithProd(true);}}),
                  h(TipoBtn,{active:!withProd,label:"Sem vinculação",onClick:function(){setWithProd(false);}})
                )
              )
            )
          ),

          h("div",{style:{display:"flex",flexWrap:"wrap",gap:20,marginTop:4,padding:"12px 16px",background:"rgba(37,99,235,0.05)",borderRadius:8,border:"1px solid rgba(37,99,235,0.12)"}},
            h("div",null,
              h("div",{style:{fontSize:10,color:"#374151",fontFamily:"monospace",letterSpacing:1,marginBottom:4,textTransform:"uppercase"}},"Prestação atual (est.)"),
              h("div",{style:{fontSize:22,fontWeight:700,color:"#111827",fontFamily:"monospace"}},
                isFinite(prestacaoAtual)&&prestacaoAtual>0?fE(prestacaoAtual)+"/mês":"—"
              )
            ),
            h("div",null,
              h("div",{style:{fontSize:10,color:"#374151",fontFamily:"monospace",letterSpacing:1,marginBottom:4,textTransform:"uppercase"}},"LTV atual"),
              h("div",{style:{fontSize:22,fontWeight:700,color:ltvColor,fontFamily:"monospace"}},fP(ltv))
            ),
            h("div",null,
              h("div",{style:{fontSize:10,color:"#374151",fontFamily:"monospace",letterSpacing:1,marginBottom:4,textTransform:"uppercase"}},"Penalização reembolso ant."),
              h("div",{style:{fontSize:22,fontWeight:700,color:"#111827",fontFamily:"monospace"}},
                fE(penaltyCost)," ",h("span",{style:{fontSize:12,color:"#374151",fontWeight:400}},"("+(penaltyRate*100).toFixed(1).replace(".0","").replace(".",",")+"% do capital)")
              )
            )
          )
        ),

        h("div",{style:Object.assign({},cardS,{marginBottom:8})},
          h("div",{style:{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10,justifyContent:"space-between"}},
            h("div",{style:secTitleS},"Ordenar por"),
            h("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
              h(TipoBtn,{active:sortBy==="poupancaTotal",label:"Maior poupança total",onClick:function(){setSortBy("poupancaTotal");}}),
              h(TipoBtn,{active:sortBy==="poupancaMensal",label:"Menor prestação",onClick:function(){setSortBy("poupancaMensal");}}),
              h(TipoBtn,{active:sortBy==="equilibrio",label:"Ponto de equilíbrio",onClick:function(){setSortBy("equilibrio");}})
            )
          )
        ),

        banksFromApi.length===0
          ?h("div",{style:Object.assign({},cardS,{textAlign:"center",padding:"32px",color:"#374151",fontSize:15})},
              h("div",{style:{marginBottom:8,fontSize:26}},"⏳"),
              "A carregar dados dos bancos…"
            )
          :(IS_MOBILE&&window.TransfTableMobile)
            ?h(window.TransfTableMobile,{resultados:resultados,penaltyCost:penaltyCost,remainingMonths:remainingMonths})
            :h("div",{style:{overflowX:"auto"}},
              h("table",{style:{width:"100%",borderCollapse:"collapse",background:"#fff",borderRadius:11,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.07)"}},
                h("thead",null,
                  h("tr",null,
                    h("th",{style:thSL},"Banco"),
                    h("th",{style:thS},"Spread"),
                    h("th",{style:thS},"Nova TAN"),
                    h("th",{style:thS},"Prestação nova"),
                    h("th",{style:thS},"Poupança/mês"),
                    h("th",{style:thS},"Custo transf."),
                    h("th",{style:thS},"Equilíbrio"),
                    h("th",{style:thS},"Poupança líquida total")
                  )
                ),
                h("tbody",null,
                  resultados.length===0
                    ?h("tr",null,h("td",{colSpan:8,style:{padding:"24px",textAlign:"center",color:"#4b5563",fontSize:14}},"Nenhum banco elegível para o capital e prazo indicados."))
                    :resultados.map(function(row,idx){
                      var isTop=idx===0&&row.compensador;
                      var rowBg=isTop?"rgba(37,99,235,0.06)":row.compensador&&idx<3?"rgba(22,163,74,0.04)":"#fff";
                      var rowBorder=isTop?"2px solid "+Au:"";
                      var poupMensal=row.poupancaMensal;
                      var poupTotal=row.poupancaTotal;
                      var eqM=row.equilibrioMeses;
                      var eqColor=breakEvenColor(eqM,remainingMonths);
                      var eqLabel=!isFinite(eqM)||eqM>=remainingMonths?"Não compensa":(eqM<12?eqM+" meses":(Math.floor(eqM/12))+"a "+((eqM%12)>0?(eqM%12)+"m":""));
                      return h("tr",{key:row.code,style:{background:rowBg,outline:rowBorder?rowBorder:"none",position:"relative"}},
                        h("td",{style:tdSL},
                          h("div",{style:{display:"flex",alignItems:"center",gap:8}},
                            isTop&&h("span",{style:{fontSize:12,color:Au,fontWeight:700,fontFamily:"monospace",whiteSpace:"nowrap"}},"★ "),
                            h("div",{style:{width:30,height:26,borderRadius:5,background:"rgba(0,0,0,0.04)",border:"1px solid "+row.color+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},
                              h("img",{
                                src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[row.code]||"bank.pt")+"&sz=32",
                                width:22,height:22,
                                style:{objectFit:"contain",display:"block"},
                                alt:row.code,
                                onError:function(e){
                                  var d=e.currentTarget.parentElement;
                                  d.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+row.color+'">'+row.code+'</span>';
                                  e.currentTarget.onError=null;
                                }
                              })
                            ),
                            h("span",{style:{fontWeight:700,color:"#111827",fontSize:13}},row.name),
                            row.refMismatch&&h("span",{style:{fontSize:11,color:"#b45309",marginLeft:4}},"("+row.useRef+")")
                          )
                        ),
                        h("td",{style:Object.assign({},tdS,{fontFamily:"monospace",fontSize:13})},
                          fP(row.spread)+(row.ltvAddon>0?" +"+fP(row.ltvAddon)+" LTV":"")
                        ),
                        h("td",{style:Object.assign({},tdS,{fontFamily:"monospace"})},fP(row.newTAN)),
                        h("td",{style:Object.assign({},tdS,{fontFamily:"monospace",fontWeight:700})},
                          isFinite(row.prestacaoNova)?fE(row.prestacaoNova)+"/mês":"—"
                        ),
                        h("td",{style:Object.assign({},tdS,{fontFamily:"monospace",fontWeight:700,color:poupMensal>0?G:R})},
                          poupMensal>0?"+"+fE(poupMensal):fE(poupMensal)
                        ),
                        h("td",{style:Object.assign({},tdS,{fontFamily:"monospace",fontSize:13})},
                          h("div",null,fE(row.custoTransf)),
                          h("div",{style:{fontSize:11,color:"#4b5563",marginTop:2}},"penal. "+fE(penaltyCost)+" + comis. "+fE(row.setupCosts))
                        ),
                        h("td",{style:Object.assign({},tdS,{fontWeight:700,color:eqColor,fontFamily:"monospace"})},eqLabel),
                        h("td",{style:Object.assign({},tdS,{fontWeight:700,color:poupTotal>0?G:R,fontFamily:"monospace"})},
                          poupTotal>0?"+"+fE(poupTotal):fE(poupTotal)
                        )
                      );
                    })
                )
              )
            ),

        h("div",{style:{marginTop:18,padding:"12px 16px",background:"rgba(0,0,0,0.03)",borderRadius:8,fontSize:12,color:"#4b5563",lineHeight:1.7}},
          h("strong",null,"Nota: "),"Simulação indicativa. A penalização legal por reembolso antecipado é 0,5% do capital em dívida para taxas variáveis/mistas e 2% para taxas fixas (DL 74-A/2017). Os custos de transferência incluem a penalização e as comissões estimadas do novo banco (abertura de dossier, avaliação e minutas). Seguros, TAEG e outros encargos não estão incluídos. Consulte a FINE de cada banco antes de decidir. ",
          h("button",{
            onClick:function(){window.location.href="/";},
            style:{background:"none",border:"none",color:Au,cursor:"pointer",fontWeight:600,fontSize:12,textDecoration:"underline",padding:0}
          },"Ver simulador completo →")
        )
      ),window.PageFooter&&h(window.PageFooter,null),window.CookieBanner&&h(window.CookieBanner,null)
    );
  }

  window.TransferenciaPage=TransferenciaPage;
})();
