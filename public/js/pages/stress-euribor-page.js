;(function(){
  'use strict';
  if(!window.React||!window._SIM)return;
  var React=window.React;
  var h=React.createElement;
  var useState=React.useState;
  var useEffect=React.useEffect;
  var Au=window._SIM.Au;
  var calcP=window._SIM.calcP;
  var SliderInput=window._SIM.SliderInput;

  var fmtEur=new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:0}).format;
  var fmtPct=function(v){return v.toFixed(2).replace('.',',')+' %';};

  function readParam(key,def){
    try{
      var v=new URLSearchParams(window.location.search).get(key);
      if(v===null)return def;
      if(typeof def==='number')return parseFloat(v)||def;
      return v;
    }catch(_){return def;}
  }

  function updateURL(params){
    try{
      var sp=new URLSearchParams(window.location.search);
      Object.keys(params).forEach(function(k){sp.set(k,String(params[k]));});
      window.history.replaceState(null,'',window.location.pathname+'?'+sp.toString());
    }catch(_){}
  }

  var DELTAS=[0,0.5,1,1.5,2,3];

  function barColor(d){
    if(d===0)return '#16a34a';
    if(d<=0.5)return '#65a30d';
    if(d<=1)return '#ca8a04';
    if(d<=1.5)return '#f97316';
    if(d<=2)return '#dc2626';
    return '#991b1b';
  }

  function StressEuriborPage(props){
    var EUR=props.EUR||{};
    var commentCount=props.commentCount||0;
    var onOpenComments=props.onOpenComments||function(){};
    var onOpenGlossario=props.onOpenGlossario||null;
    var onOpenProcesso=props.onOpenProcesso||null;

    var _c=useState(readParam('c',200000));var capital=_c[0];var setCapital=_c[1];
    var _s=useState(readParam('s',1.0));var spread=_s[0];var setSpread=_s[1];
    var _p=useState(readParam('p',25));var prazo=_p[0];var setPrazo=_p[1];
    var _i=useState(readParam('idx','12m'));var idx=_i[0];var setIdx=_i[1];
    var _mob=useState(typeof window!=='undefined'&&window.innerWidth<640);var isMobile=_mob[0];var setIsMobile=_mob[1];

    useEffect(function(){
      function onR(){setIsMobile(window.innerWidth<640);}
      window.addEventListener('resize',onR,{passive:true});
      return function(){window.removeEventListener('resize',onR);};
    },[]);

    useEffect(function(){
      updateURL({c:capital,s:spread,p:prazo,idx:idx});
    },[capital,spread,prazo,idx]);

    var eurObj=EUR[idx]||{};
    var eurAtual=typeof eurObj.valor==='number'?eurObj.valor:2.5;
    var eurLabel=eurObj.data||'';

    var cenarios=DELTAS.map(function(d){
      var euribor=Math.round((eurAtual+d)*1000)/1000;
      var tan=Math.round((euribor+spread)*1000)/1000;
      var prestacao=Math.round(calcP(capital,tan,prazo));
      return {delta:d,euribor:euribor,tan:tan,prestacao:prestacao};
    });
    var prestacaoBase=cenarios[0].prestacao;
    var prestacaoMax=cenarios[cenarios.length-1].prestacao;

    var card={background:'#fff',borderRadius:11,padding:isMobile?'16px 14px':'20px 24px',marginBottom:12};
    var lbl={fontSize:11,color:'#6b7280',fontFamily:'sans-serif',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:6};
    var thS={padding:isMobile?'8px 6px':'8px 10px',textAlign:'left',color:'#6b7280',fontWeight:700,borderBottom:'1px solid #e5e7eb',fontSize:isMobile?10:11,letterSpacing:'0.4px',whiteSpace:'nowrap'};

    function btnIdx(k,label){
      var active=k===idx;
      return h('button',{
        key:k,onClick:function(){setIdx(k);},
        style:{padding:'8px 16px',border:'none',borderRadius:7,background:active?Au:'rgba(37,99,235,0.08)',color:active?'#fff':Au,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'sans-serif',transition:'all 0.15s'}
      },label);
    }

    return h('div',{style:{background:'#e5e7eb',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}},
      h(window.PageHeader,{
        EUR:EUR,
        activePage:'stress',
        commentCount:commentCount,
        onOpenComments:onOpenComments,
        onOpenGlossario:onOpenGlossario,
        onOpenProcesso:onOpenProcesso,
        subtitle:'Simula o impacto de subidas da Euribor na tua prestação'
      }),
      window.NoticeBanner&&h(window.NoticeBanner,null),
      h('main',{style:{maxWidth:640,margin:'0 auto',padding:isMobile?'14px 10px':'22px 16px'}},

        // ── INPUTS ───────────────────────────────────────────────────────────
        h('div',{style:card},
          h('h2',{style:{fontSize:isMobile?15:17,fontWeight:700,color:'#111827',marginBottom:18,fontFamily:"'Inter',system-ui,sans-serif"}},'Parâmetros do Crédito'),

          h('div',{style:{marginBottom:18}},
            h('span',{style:lbl},'Capital em dívida'),
            h(SliderInput,{min:20000,max:1000000,step:5000,value:capital,onChange:setCapital,color:Au,prefix:'€',ariaLabel:'Capital em dívida',formatFn:function(v){return Math.round(v).toLocaleString('pt-PT');}})
          ),

          h('div',{style:{marginBottom:18}},
            h('span',{style:lbl},'Spread do banco'),
            h(SliderInput,{min:0.1,max:3.0,step:0.05,value:spread,onChange:setSpread,color:'#7c3aed',suffix:'%',ariaLabel:'Spread',formatFn:function(v){return v.toFixed(2).replace('.',',');}})
          ),

          h('div',{style:{marginBottom:18}},
            h('span',{style:lbl},'Prazo restante'),
            h(SliderInput,{min:5,max:40,step:1,value:prazo,onChange:setPrazo,color:'#059669',suffix:' anos',ariaLabel:'Prazo restante',formatFn:function(v){return String(v);}})
          ),

          h('div',null,
            h('span',{style:lbl},'Indexante'),
            h('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}},
              btnIdx('3m','Euribor 3m'),
              btnIdx('6m','Euribor 6m'),
              btnIdx('12m','Euribor 12m')
            ),
            h('p',{style:{fontSize:12,color:'#6b7280',fontFamily:'sans-serif'}},
              'Euribor '+idx+' actual: ',
              h('strong',{style:{color:Au}},fmtPct(eurAtual)),
              eurLabel?' ('+eurLabel+')':''
            )
          )
        ),

        // ── TABELA DE CENÁRIOS ───────────────────────────────────────────────
        h('div',{style:card},
          h('h3',{style:{fontSize:isMobile?14:15,fontWeight:700,color:'#111827',marginBottom:16,fontFamily:"'Inter',system-ui,sans-serif"}},'Cenários de Stress'),
          h('div',{style:{overflowX:'auto'}},
            h('table',{style:{width:'100%',borderCollapse:'collapse',fontSize:isMobile?12:13,fontFamily:'sans-serif',minWidth:isMobile?440:520}},
              h('thead',null,
                h('tr',{style:{background:'#f9fafb'}},
                  h('th',{style:thS},'Cenário'),
                  h('th',{style:Object.assign({},thS,{textAlign:'right'})},'Euribor'),
                  h('th',{style:Object.assign({},thS,{textAlign:'right'})},'TAN'),
                  h('th',{style:Object.assign({},thS,{textAlign:'right'})},'Prestação'),
                  h('th',{style:Object.assign({},thS,{textAlign:'right'})},'Δ / mês'),
                  h('th',{style:Object.assign({},thS,{textAlign:'right'})},isMobile?'Rend. mín.':'Rendimento mín. (DSTI 35%)')
                )
              ),
              h('tbody',null,
                cenarios.map(function(c){
                  var isBdP=c.delta===1.5;
                  var delta=c.prestacao-prestacaoBase;
                  var rendMin=Math.round(c.prestacao/0.35);
                  var barPct=prestacaoMax>prestacaoBase?(c.prestacao-prestacaoBase)/(prestacaoMax-prestacaoBase)*100:0;
                  if(c.delta===0)barPct=0;
                  var rowBg=isBdP?'#eff6ff':'transparent';
                  var pad=isMobile?'8px 6px':'10px 10px';
                  return h(React.Fragment,{key:String(c.delta)},
                    h('tr',{style:{background:rowBg,borderBottom:'none'}},
                      h('td',{style:{padding:pad,color:isBdP?'#1e40af':'#374151',fontWeight:isBdP?700:500,whiteSpace:'nowrap',fontFamily:'sans-serif'}},
                        (isBdP?'⚑ ':'')+
                        (c.delta===0?'Actual':'+'+c.delta.toFixed(1).replace('.',',')+' p.p.')
                      ),
                      h('td',{style:{padding:pad,textAlign:'right',color:'#374151',fontFamily:'monospace'}},fmtPct(c.euribor)),
                      h('td',{style:{padding:pad,textAlign:'right',color:isBdP?'#1e40af':'#374151',fontFamily:'monospace',fontWeight:isBdP?700:400}},fmtPct(c.tan)),
                      h('td',{style:{padding:pad,textAlign:'right',fontWeight:700,color:isBdP?'#1e40af':'#111827',fontFamily:'monospace'}},fmtEur(c.prestacao)),
                      h('td',{style:{padding:pad,textAlign:'right',fontWeight:600,color:c.delta===0?'#6b7280':barColor(c.delta),fontFamily:'monospace'}},
                        c.delta===0?'—':(delta>0?'+':'')+fmtEur(delta)
                      ),
                      h('td',{style:{padding:pad,textAlign:'right',color:'#6b7280',fontFamily:'monospace',fontSize:isMobile?11:12}},fmtEur(rendMin))
                    ),
                    h('tr',{style:{background:rowBg,borderBottom:'1px solid #e5e7eb'}},
                      h('td',{colSpan:6,style:{padding:'0 '+(isMobile?'6':'10')+'px '+(isMobile?'8':'10')+'px'}},
                        c.delta===0
                          ?h('div',{style:{height:6,background:'#f3f4f6',borderRadius:3}},
                              h('div',{style:{height:'100%',width:'2px',background:'#16a34a',borderRadius:3}})
                            )
                          :h('div',{style:{height:6,background:'#f3f4f6',borderRadius:3,overflow:'hidden'}},
                              h('div',{style:{height:'100%',width:Math.min(100,barPct).toFixed(1)+'%',background:barColor(c.delta),borderRadius:3,transition:'width 0.3s ease'}})
                            )
                      )
                    )
                  );
                })
              )
            )
          )
        ),

        // ── NOTA BdP ─────────────────────────────────────────────────────────
        h('div',{style:Object.assign({},card,{background:'#eff6ff',border:'1px solid #bfdbfe'})},
          h('p',{style:{fontSize:13,fontWeight:700,color:'#1e40af',marginBottom:8,fontFamily:'sans-serif'}},'⚑  Stress Test BdP — o que significa?'),
          h('p',{style:{fontSize:13,color:'#1d4ed8',fontFamily:'sans-serif',lineHeight:1.7,margin:0}},
            'Para créditos com prazo superior a 10 anos, o Banco de Portugal obriga os bancos a avaliar a capacidade de pagamento com a taxa agravada em ',
            h('strong',null,'+1,5 p.p.'),
            '. Este cenário determina o rendimento mínimo aceite na análise de crédito. Se o teu rendimento líquido mensal for inferior ao valor indicado na linha ⚑, a aprovação do crédito pode ser recusada ou condicionada.'
          )
        ),

        h('p',{style:{fontSize:11,color:'#9ca3af',textAlign:'center',padding:'4px 10px 28px',fontFamily:'sans-serif',lineHeight:1.65}},
          'Simulação indicativa baseada no método francês (prestação constante). Não inclui seguros, comissões nem produtos vinculados.',
          h('br',null),
          'Euribor actualizada periodicamente a partir do BCE. Confirma sempre a TAN contratual com o teu banco.'
        ),

        h(window.PageFooter,null)
      ),
      window.CookieBanner&&h(window.CookieBanner,null)
    );
  }

  window.StressEuriborPage=StressEuriborPage;
})();
