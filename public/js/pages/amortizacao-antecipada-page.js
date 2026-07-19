;(function(){
  'use strict';
  if(!window._SIM||!window.React)return;
  var React=window.React;
  var h=React.createElement;
  var useState=React.useState;
  var useMemo=React.useMemo;
  var useEffect=React.useEffect;
  var fE=window._SIM.fE;
  var SliderInput=window._SIM.SliderInput;
  var FALLBACK_EUR=window._SIM.FALLBACK_EUR;
  var Au=window._SIM.Au;
  var G=window._SIM.G;
  var N=window._SIM.N;
  var simA=window._SIM.simA;
  var amChart=window._SIM.amChart;
  var calcP=window._SIM.calcP;
  var RC=window.Recharts||{};
  var ResponsiveContainer=RC.ResponsiveContainer;
  var LineChart=RC.LineChart,Line=RC.Line,XAxis=RC.XAxis,YAxis=RC.YAxis;
  var CartesianGrid=RC.CartesianGrid,Tooltip=RC.Tooltip,Legend=RC.Legend;

  function readParam(k,d){
    try{var v=new URLSearchParams(window.location.search).get(k);if(v===null)return d;if(typeof d==='number')return parseFloat(v)||d;return v;}
    catch(_){return d;}
  }
  function updateURL(p){
    try{var sp=new URLSearchParams(window.location.search);Object.keys(p).forEach(function(k){sp.set(k,String(p[k]));});window.history.replaceState(null,'',window.location.pathname+'?'+sp.toString());}
    catch(_){}
  }
  function fmtMeses(m){
    var a=Math.floor(m/12),mo=m%12;
    if(a>0&&mo>0)return a+'a '+mo+'m';
    if(a>0)return a+(a===1?' ano':' anos');
    return mo+(mo===1?' mês':' meses');
  }

  var SCEN_EXTRAS=[0,1000,2500,5000,10000];

  function AmortizacaoAntPage(props){
    var EUR=props.EUR||FALLBACK_EUR;
    var commentCount=props.commentCount||0;
    var onOpenComments=props.onOpenComments||function(){};
    var onOpenGlossario=props.onOpenGlossario||null;
    var onOpenProcesso=props.onOpenProcesso||null;
    var eur6m=(EUR['6m']&&EUR['6m'].valor)||FALLBACK_EUR['6m'].valor;

    var _c=useState(readParam('c',150000));var capital=_c[0];var setCapital=_c[1];
    var _p=useState(readParam('p',25));var prazo=_p[0];var setPrazo=_p[1];
    var _t=useState(readParam('t',parseFloat((eur6m+1.0).toFixed(3))));var tan=_t[0];var setTan=_t[1];
    var _e=useState(readParam('e',2400));var extra=_e[0];var setExtra=_e[1];
    var _mob=useState(typeof window!=='undefined'&&window.innerWidth<640);var isMobile=_mob[0];var setIsMobile=_mob[1];

    useEffect(function(){
      function onR(){setIsMobile(window.innerWidth<640);}
      window.addEventListener('resize',onR,{passive:true});
      return function(){window.removeEventListener('resize',onR);};
    },[]);

    useEffect(function(){
      updateURL({c:capital,p:prazo,t:typeof tan==='number'?tan.toFixed(3):tan,e:extra});
    },[capital,prazo,tan,extra]);

    var res=useMemo(function(){
      var tanN=typeof tan==='number'?tan:parseFloat(tan)||0;
      var semExtra=simA(capital,tanN,prazo,0);
      var comExtra=simA(capital,tanN,prazo,extra);
      var chartData=amChart(capital,tanN,prazo,extra);
      var cenarios=SCEN_EXTRAS.map(function(ex){
        var r=simA(capital,tanN,prazo,ex);
        return{extra:ex,meses:r.meses,juros:Math.round(r.juros),economia:r.economia,poupados:r.poupados};
      });
      var prestBase=Math.round(calcP(capital,tanN,prazo));
      return{semExtra:semExtra,comExtra:comExtra,chartData:chartData,cenarios:cenarios,prestBase:prestBase};
    },[capital,tan,prazo,extra]);

    var mesesPoupados=res.comExtra.poupados;
    var jurosPoupados=res.comExtra.economia;
    var REGRAS=((window._SIM||{}).CONST||{}).regras||{};
    var penVar=REGRAS.amortPenaltyVar!=null?REGRAS.amortPenaltyVar:0.005;
    var penVarPct=(penVar*100).toFixed(1).replace('.',',')+'%';
    var penFixaPct=(((REGRAS.amortPenaltyFixa!=null?REGRAS.amortPenaltyFixa:0.02))*100).toFixed(0)+'%';
    var penalizacaoAnual=extra*penVar;

    var card={background:'#fff',borderRadius:11,padding:isMobile?'14px 12px':'18px 20px',marginBottom:12};
    var secTitleS={fontSize:11,letterSpacing:3,color:Au,fontFamily:'monospace',marginBottom:12,textTransform:'uppercase'};
    var lbl={fontSize:11,color:'#374151',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:6};
    var fieldS={marginBottom:16};
    var thS={padding:isMobile?'7px 6px':'8px 10px',textAlign:'left',color:'#6b7280',fontWeight:700,borderBottom:'1px solid #e5e7eb',fontSize:11,letterSpacing:'0.4px',whiteSpace:'nowrap'};

    return h('div',{style:{background:N,minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif",color:'#111827'}},
      h(window.PageHeader,{
        EUR:EUR,activePage:'amortizacao',commentCount:commentCount,
        onOpenComments:onOpenComments,onOpenGlossario:onOpenGlossario,onOpenProcesso:onOpenProcesso,
        subtitle:'Calcula quanto poupas em juros e tempo ao fazer pagamentos extra anuais'
      }),
      window.NoticeBanner&&h(window.NoticeBanner,null),
      h('main',{style:{maxWidth:780,margin:'0 auto',padding:isMobile?'12px 10px 40px':'18px 16px 48px'}},

        // ── INPUTS ──────────────────────────────────────────────────────────
        h('div',{style:card},
          h('div',{style:secTitleS},'Parâmetros do Crédito'),
          h('div',{style:{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:isMobile?0:20}},
            h('div',null,
              h('div',{style:fieldS},
                h('span',{style:lbl},'Capital em dívida'),
                h(SliderInput,{min:10000,max:600000,step:5000,value:capital,onChange:setCapital,color:Au,prefix:'€',ariaLabel:'Capital em dívida',formatFn:function(v){return Math.round(v).toLocaleString('pt-PT');}})
              ),
              h('div',{style:fieldS},
                h('span',{style:lbl},'Prazo restante'),
                h(SliderInput,{min:5,max:40,step:1,value:prazo,onChange:setPrazo,color:'#059669',suffix:' anos',ariaLabel:'Prazo restante',formatFn:function(v){return String(v);}})
              )
            ),
            h('div',null,
              h('div',{style:fieldS},
                h('span',{style:lbl},'TAN anual (%)'),
                h('div',{style:{display:'flex',alignItems:'center',gap:8}},
                  h('input',{type:'number',step:'0.001',min:'0',max:'15',className:'val-compact',
                    value:typeof tan==='number'?tan.toFixed(3):tan,
                    onChange:function(e){var v=parseFloat(e.target.value);if(!isNaN(v)&&v>=0)setTan(v);},
                    style:{width:90,padding:'6px 8px',border:'1px solid rgba(37,99,235,0.3)',borderRadius:6,fontSize:13}}),
                  h('span',{style:{fontSize:11,color:'#6b7280'}},'Euribor 6m '+eur6m.toFixed(3).replace('.',',')+'% + spread ~1%')
                )
              ),
              h('div',{style:fieldS},
                h('span',{style:lbl},'Amortização extra por ano'),
                h(SliderInput,{min:0,max:20000,step:500,value:extra,onChange:setExtra,color:G,prefix:'€',ariaLabel:'Amortização extra anual',formatFn:function(v){return Math.round(v).toLocaleString('pt-PT');}})
              )
            )
          ),
          h('div',{style:{padding:'8px 12px',background:'rgba(37,99,235,0.05)',borderRadius:8,fontSize:12,color:'#374151'}},
            'Prestação mensal: ',h('strong',{style:{color:Au}},fE(res.prestBase)),
            ' · Juros totais sem amortizações extra: ',h('strong',null,fE(res.semExtra.juros))
          )
        ),

        // ── CARDS RESULTADO ──────────────────────────────────────────────────
        h('div',{style:{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap'}},
          h('div',{style:{flex:'1 1 150px',background:'rgba(22,163,74,0.08)',border:'1px solid rgba(22,163,74,0.3)',borderRadius:11,padding:'14px 16px'}},
            h('div',{style:{fontSize:11,color:'#374151',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}},'Poupança em juros'),
            h('div',{style:{fontSize:isMobile?21:27,fontWeight:800,color:G}},jurosPoupados>0?fE(jurosPoupados):'—'),
            h('div',{style:{fontSize:11,color:'#6b7280',marginTop:2}},extra>0?('com '+fE(extra)+'/ano extra'):'Insere um valor extra')
          ),
          h('div',{style:{flex:'1 1 150px',background:'rgba(22,163,74,0.06)',border:'1px solid rgba(22,163,74,0.22)',borderRadius:11,padding:'14px 16px'}},
            h('div',{style:{fontSize:11,color:'#374151',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}},'Tempo poupado'),
            h('div',{style:{fontSize:isMobile?21:27,fontWeight:800,color:G}},mesesPoupados>0?fmtMeses(mesesPoupados):'—'),
            h('div',{style:{fontSize:11,color:'#6b7280',marginTop:2}},
              mesesPoupados>0?('terminas em '+fmtMeses(res.comExtra.meses)+' vs '+prazo+'a'):'—'
            )
          ),
          h('div',{style:{flex:'1 1 150px',background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:11,padding:'14px 16px'}},
            h('div',{style:{fontSize:11,color:'#374151',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}},'Penalização estimada'),
            h('div',{style:{fontSize:isMobile?21:27,fontWeight:800,color:'#f97316'}},extra>0?fE(penalizacaoAnual)+'/ano':'—'),
            h('div',{style:{fontSize:11,color:'#6b7280',marginTop:2}},extra>0?penVarPct+' do valor (taxa variável)':'—')
          )
        ),

        // ── GRÁFICO ─────────────────────────────────────────────────────────
        ResponsiveContainer&&h('div',{style:Object.assign({},card,{padding:isMobile?'14px 0':'18px 0',overflow:'hidden'})},
          h('div',{style:{paddingLeft:isMobile?12:20,paddingRight:isMobile?12:20,marginBottom:8}},
            h('div',{style:secTitleS},'Capital em dívida ao longo do tempo'),
            h('div',{style:{fontSize:12,color:'#6b7280'}},'Com amortizações extra a linha azul chega a zero mais cedo.')
          ),
          h(ResponsiveContainer,{width:'100%',height:isMobile?240:320},
            h(LineChart,{data:res.chartData,margin:isMobile?{top:4,right:12,left:0,bottom:20}:{top:8,right:24,left:8,bottom:24}},
              h(CartesianGrid,{strokeDasharray:'3 3',stroke:'rgba(0,0,0,0.05)'}),
              h(XAxis,{dataKey:'ano',ticks:(function(){var t=[];for(var y=0;y<=prazo;y+=5)t.push(y);return t;})(),tick:{fill:'#374151',fontSize:isMobile?10:11},axisLine:{stroke:'rgba(0,0,0,0.2)'},tickLine:{stroke:'rgba(0,0,0,0.2)'},tickFormatter:function(v){return v+'a';}}),
              h(YAxis,{width:isMobile?50:60,tick:{fill:'#374151',fontSize:isMobile?10:11},axisLine:false,tickLine:false,tickFormatter:function(v){return Math.round(v/1000)+'k€';}}),
              h(Tooltip,{formatter:function(v,n){return[fE(v),n];},contentStyle:{background:'#fff',border:'1px solid '+Au,borderRadius:8,color:'#111827',fontFamily:'sans-serif',fontSize:12},labelFormatter:function(l){return 'Ano '+l;}}),
              h(Legend,{verticalAlign:'bottom',iconSize:10,wrapperStyle:{paddingTop:6,fontSize:isMobile?11:12,fontFamily:'sans-serif',color:'#374151'}}),
              h(Line,{type:'monotone',dataKey:'Sem amort.',name:'Sem amortizações extra',stroke:'#dc2626',strokeWidth:2,dot:false}),
              h(Line,{type:'monotone',dataKey:'Com amort.',name:'Com amortizações extra',stroke:Au,strokeWidth:2.5,dot:false})
            )
          )
        ),

        // ── TABELA DE CENÁRIOS ───────────────────────────────────────────────
        h('div',{style:card},
          h('div',{style:secTitleS},'Comparação de Cenários'),
          h('div',{style:{overflowX:'auto'}},
            h('table',{style:{width:'100%',borderCollapse:'collapse',fontSize:isMobile?12:13,fontFamily:'sans-serif',minWidth:isMobile?400:480}},
              h('thead',null,
                h('tr',{style:{background:'#f9fafb'}},
                  h('th',{style:thS},'Extra / ano'),
                  h('th',{style:Object.assign({},thS,{textAlign:'right'})},'Juros pagos'),
                  h('th',{style:Object.assign({},thS,{textAlign:'right'})},'Poupança'),
                  h('th',{style:Object.assign({},thS,{textAlign:'right'})},'Tempo poupado'),
                  h('th',{style:Object.assign({},thS,{textAlign:'right'})},'Termina em')
                )
              ),
              h('tbody',null,
                res.cenarios.map(function(c){
                  var isSelected=c.extra===extra;
                  return h('tr',{key:c.extra,style:{background:isSelected?'rgba(37,99,235,0.06)':'transparent',borderBottom:'1px solid #f3f4f6'}},
                    h('td',{style:{padding:isMobile?'8px 6px':'9px 10px',fontWeight:isSelected?700:500,color:isSelected?Au:'#374151'}},
                      c.extra===0?'Sem extra':fE(c.extra)+'/ano'
                    ),
                    h('td',{style:{padding:isMobile?'8px 6px':'9px 10px',textAlign:'right',color:'#374151',fontFamily:'monospace'}},fE(c.juros)),
                    h('td',{style:{padding:isMobile?'8px 6px':'9px 10px',textAlign:'right',fontWeight:600,color:c.economia>0?G:'#9ca3af',fontFamily:'monospace'}},
                      c.economia>0?fE(c.economia):'—'
                    ),
                    h('td',{style:{padding:isMobile?'8px 6px':'9px 10px',textAlign:'right',color:c.poupados>0?G:'#9ca3af',fontFamily:'monospace'}},
                      c.poupados>0?fmtMeses(c.poupados):'—'
                    ),
                    h('td',{style:{padding:isMobile?'8px 6px':'9px 10px',textAlign:'right',color:'#374151',fontFamily:'monospace'}},fmtMeses(c.meses))
                  );
                })
              )
            )
          )
        ),

        // ── INFO BOX ─────────────────────────────────────────────────────────
        h('div',{style:Object.assign({},card,{background:'#eff6ff',border:'1px solid #bfdbfe'})},
          h('p',{style:{fontSize:13,fontWeight:700,color:'#1e40af',marginBottom:8,fontFamily:'sans-serif'}},'ℹ️ O que saber sobre amortizações antecipadas'),
          h('ul',{style:{fontSize:13,color:'#1d4ed8',fontFamily:'sans-serif',lineHeight:1.85,margin:0,paddingLeft:18}},
            h('li',null,'Taxa variável: penalização de ',h('strong',null,penVarPct),' do capital amortizado (DL 74-A/2017).'),
            h('li',null,'Taxa fixa: penalização de ',h('strong',null,penFixaPct),' — verifica se a poupança de juros justifica o custo antes de avançar.'),
            h('li',null,'Amortizar reduz o ',h('strong',null,'prazo'),' (poupas mais juros) ou a ',h('strong',null,'prestação'),' (mais folga mensal) — negocia com o banco.'),
            h('li',null,'O banco tem de ser notificado com antecedência — confirma o prazo no teu contrato.')
          )
        ),

        h('p',{style:{fontSize:11,color:'#111827',textAlign:'center',padding:'4px 10px 20px',fontFamily:'sans-serif',lineHeight:1.65}},
          'Simulação baseada no método francês (prestação constante). A penalização de '+penVarPct+' aplica-se à taxa variável; confirma o valor exacto no teu contrato de crédito.'
        ),

        h(window.PageFooter,null)
      ),
      window.CookieBanner&&h(window.CookieBanner,null)
    );
  }

  window.AmortizacaoAntPage=AmortizacaoAntPage;
})();
