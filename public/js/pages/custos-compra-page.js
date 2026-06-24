;(function(){
  'use strict';
  if(!window.React||!window._SIM)return;
  var React=window.React;
  var h=React.createElement;
  var useState=React.useState;
  var useEffect=React.useEffect;
  var Au=window._SIM.Au;
  var calcIMT=window._SIM.calcIMT;
  var SliderInput=window._SIM.SliderInput;

  var fmtEur=new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:0}).format;

  function readParam(key,def){
    try{
      var v=new URLSearchParams(window.location.search).get(key);
      if(v===null)return def;
      if(typeof def==='number')return parseFloat(v)||def;
      if(typeof def==='boolean')return v==='1';
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

  var HPP_BRACKETS=[
    {min:0,      max:106346,   rate:'Isento'},
    {min:106346, max:145470,   rate:'2%'},
    {min:145470, max:198347,   rate:'5%'},
    {min:198347, max:330539,   rate:'7%'},
    {min:330539, max:660982,   rate:'8%'},
    {min:660982, max:Infinity, rate:'6% (taxa fixa)'},
  ];
  var SEGUNDA_BRACKETS_ORD=[
    {min:0,      max:106346,   rate:'1%'},
    {min:106346, max:145470,   rate:'2%'},
    {min:145470, max:198347,   rate:'5%'},
    {min:198347, max:330539,   rate:'7%'},
    {min:330539, max:633931,   rate:'8%'},
    {min:633931, max:Infinity, rate:'6% (taxa fixa)'},
  ];

  function getActiveBracketIndex(valor,finalidade){
    var brackets=finalidade==='hpp'?HPP_BRACKETS:SEGUNDA_BRACKETS_ORD;
    for(var i=0;i<brackets.length;i++){
      if(valor>brackets[i].min&&valor<=brackets[i].max)return i;
    }
    return brackets.length-1;
  }

  function CustosCompraPage(props){
    var EUR=props.EUR||{};
    var commentCount=props.commentCount||0;
    var onOpenComments=props.onOpenComments||function(){};
    var onOpenGlossario=props.onOpenGlossario||null;
    var onOpenProcesso=props.onOpenProcesso||null;

    var _v=useState(readParam('v',250000));var valor=_v[0];var setValor=_v[1];
    var _f=useState(readParam('f','hpp'));var finalidade=_f[0];var setFinalidade=_f[1];
    var _j=useState(readParam('j',false));var jovem=_j[0];var setJovem=_j[1];
    var _fi=useState(readParam('fi',true));var financiamento=_fi[0];var setFinanciamento=_fi[1];
    var _ltv=useState(readParam('ltv',80));var ltv=_ltv[0];var setLtv=_ltv[1];
    var _cn=useState(readParam('cn',700));var custosNotario=_cn[0];var setCustosNotario=_cn[1];
    var _st=useState(false);var showTable=_st[0];var setShowTable=_st[1];
    var _mob=useState(typeof window!=='undefined'&&window.innerWidth<640);var isMobile=_mob[0];var setIsMobile=_mob[1];

    useEffect(function(){
      function onR(){setIsMobile(window.innerWidth<640);}
      window.addEventListener('resize',onR,{passive:true});
      return function(){window.removeEventListener('resize',onR);};
    },[]);

    useEffect(function(){
      updateURL({v:valor,f:finalidade,j:jovem?'1':'0',fi:financiamento?'1':'0',ltv:ltv,cn:custosNotario});
    },[valor,finalidade,jovem,financiamento,ltv,custosNotario]);

    var isJovem=jovem&&finalidade==='hpp';
    var emprestimo=financiamento?Math.round(valor*ltv/100):0;
    var entrada=valor-emprestimo;
    var imt=Math.round(calcIMT(valor,isJovem,finalidade==='hpp'?'hpp':'segunda'));
    var isEscritura=Math.round(valor*0.008);
    var isCredito=financiamento?Math.round(emprestimo*0.006):0;
    var totalCustos=imt+isEscritura+isCredito+custosNotario;
    var totalNecessario=entrada+totalCustos;

    var componentes=[
      {label:'Entrada / Valor a pagar',valor:entrada,cor:'#2563eb'},
      {label:'IMT',valor:imt,cor:'#dc2626'},
      {label:'Imposto de Selo — escritura (0,8%)',valor:isEscritura,cor:'#d97706'},
    ];
    if(financiamento)componentes.push({label:'Imposto de Selo — crédito (0,6%)',valor:isCredito,cor:'#7c3aed'});
    componentes.push({label:'Notário / Registo',valor:custosNotario,cor:'#059669'});

    var brackets=finalidade==='hpp'?HPP_BRACKETS:SEGUNDA_BRACKETS_ORD;
    var activeBracket=getActiveBracketIndex(valor,finalidade);

    var card={background:'#fff',borderRadius:11,padding:isMobile?'16px 14px':'20px 24px',marginBottom:12};
    var lbl={fontSize:11,color:'#6b7280',fontFamily:'sans-serif',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:6};

    function btnFin(f,label){
      var active=f===finalidade;
      return h('button',{
        key:f,
        onClick:function(){setFinalidade(f);if(f!=='hpp')setJovem(false);},
        style:{padding:'8px 16px',border:'none',borderRadius:7,background:active?Au:'rgba(37,99,235,0.08)',color:active?'#fff':Au,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'sans-serif',transition:'all 0.15s'}
      },label);
    }

    return h('div',{style:{background:'#e5e7eb',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}},
      window.NoticeBanner&&h(window.NoticeBanner,null),
      h(window.PageHeader,{
        EUR:EUR,
        activePage:'custos',
        commentCount:commentCount,
        onOpenComments:onOpenComments,
        onOpenGlossario:onOpenGlossario,
        onOpenProcesso:onOpenProcesso,
        subtitle:'Calcula todos os custos necessários no dia da escritura'
      }),
      h('main',{style:{maxWidth:640,margin:'0 auto',padding:isMobile?'14px 10px':'22px 16px'}},

        // ── INPUTS ─────────────────────────────────────────────────────────
        h('div',{style:card},
          h('h2',{style:{fontSize:isMobile?15:17,fontWeight:700,color:'#111827',marginBottom:18,fontFamily:"'Inter',system-ui,sans-serif"}},'Dados do Imóvel'),

          h('div',{style:{marginBottom:18}},
            h('span',{style:lbl},'Valor do imóvel'),
            h(SliderInput,{min:50000,max:2000000,step:5000,value:valor,onChange:setValor,color:Au,prefix:'€',ariaLabel:'Valor do imóvel',formatFn:function(v){return Math.round(v).toLocaleString('pt-PT');}})
          ),

          h('div',{style:{marginBottom:18}},
            h('span',{style:lbl},'Finalidade'),
            h('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
              btnFin('hpp','1ª Habitação'),
              btnFin('segunda','2ª Habitação'),
              btnFin('arrendamento','Arrendamento')
            )
          ),

          finalidade==='hpp'&&h('div',{style:{marginBottom:14,display:'flex',alignItems:'center',gap:10}},
            h('input',{type:'checkbox',id:'jovem',checked:jovem,onChange:function(e){setJovem(e.target.checked);},style:{width:18,height:18,cursor:'pointer',accentColor:Au,flexShrink:0}}),
            h('label',{htmlFor:'jovem',style:{fontSize:14,color:'#374151',fontWeight:600,cursor:'pointer',fontFamily:'sans-serif',userSelect:'none'}},'Benefício IMT Jovem (≤ 35 anos) — isenção até €330 539')
          ),

          h('div',{style:{marginBottom:financiamento?14:0,display:'flex',alignItems:'center',gap:10}},
            h('input',{type:'checkbox',id:'financiamento',checked:financiamento,onChange:function(e){setFinanciamento(e.target.checked);},style:{width:18,height:18,cursor:'pointer',accentColor:Au,flexShrink:0}}),
            h('label',{htmlFor:'financiamento',style:{fontSize:14,color:'#374151',fontWeight:600,cursor:'pointer',fontFamily:'sans-serif',userSelect:'none'}},'Com financiamento bancário')
          ),

          financiamento&&h('div',{style:{paddingLeft:28,marginBottom:2}},
            h('span',{style:lbl},'LTV (Loan-to-Value)'),
            h(SliderInput,{min:50,max:90,step:5,value:ltv,onChange:setLtv,color:'#7c3aed',suffix:'%',ariaLabel:'LTV'}),
            h('p',{style:{fontSize:12,color:'#6b7280',fontFamily:'sans-serif',marginTop:5}},
              'Empréstimo: '+fmtEur(emprestimo)+'  ·  Entrada: '+fmtEur(entrada)
            )
          ),

          h('div',{style:{marginTop:18}},
            h('span',{style:lbl},'Custos estimados de notário / registo'),
            h('div',{style:{display:'flex',alignItems:'center',gap:8}},
              h('input',{
                type:'number',value:custosNotario,min:0,max:5000,step:50,
                onChange:function(e){setCustosNotario(Math.max(0,parseInt(e.target.value)||0));},
                style:{width:96,padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:7,fontSize:15,fontFamily:'monospace',fontWeight:700,color:'#111827',textAlign:'right'}
              }),
              h('span',{style:{fontSize:14,color:'#374151',fontFamily:'sans-serif',fontWeight:600}},'€')
            ),
            h('p',{style:{fontSize:11,color:'#9ca3af',marginTop:4,fontFamily:'sans-serif',lineHeight:1.5}},
              'Casa Pronta (Conservatória): aprox. €700  ·  Notário independente: €800–€1 500'
            )
          )
        ),

        // ── TOTAL NECESSÁRIO ───────────────────────────────────────────────
        h('div',{style:{background:'linear-gradient(135deg,#1e40af 0%,#2563eb 100%)',borderRadius:11,padding:isMobile?'22px 14px':'30px 28px',marginBottom:12,textAlign:'center',color:'#fff',boxShadow:'0 4px 16px rgba(37,99,235,0.35)'}},
          h('p',{style:{fontSize:11,color:'rgba(255,255,255,0.72)',fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'sans-serif'}},'Total necessário no dia da escritura'),
          h('p',{style:{fontSize:isMobile?36:48,fontWeight:800,fontFamily:"'Inter',system-ui,sans-serif",letterSpacing:-1.5,margin:'0 0 8px',lineHeight:1}},fmtEur(totalNecessario)),
          h('p',{style:{fontSize:12,color:'rgba(255,255,255,0.68)',fontFamily:'sans-serif'}},
            'Dos quais '+fmtEur(totalCustos)+' são impostos e custos'+
            (totalNecessario>0?' ('+Math.round(totalCustos/totalNecessario*100)+'% do total)':'')
          )
        ),

        // ── BREAKDOWN ──────────────────────────────────────────────────────
        h('div',{style:card},
          h('h3',{style:{fontSize:isMobile?14:15,fontWeight:700,color:'#111827',marginBottom:16,fontFamily:"'Inter',system-ui,sans-serif"}},'Detalhe dos custos'),
          componentes.map(function(c){
            var pct=totalNecessario>0?c.valor/totalNecessario*100:0;
            return h('div',{key:c.label,style:{marginBottom:14}},
              h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}},
                h('span',{style:{fontSize:13,fontWeight:600,color:'#374151',fontFamily:'sans-serif'}},c.label),
                h('span',{style:{fontSize:15,fontWeight:700,color:'#111827',fontFamily:'monospace'}},fmtEur(c.valor))
              ),
              h('div',{style:{height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}},
                h('div',{style:{height:'100%',width:Math.min(100,pct).toFixed(1)+'%',background:c.cor,borderRadius:4,transition:'width 0.3s ease'}})
              ),
              h('p',{style:{fontSize:11,color:'#9ca3af',marginTop:2,fontFamily:'sans-serif'}},
                pct.toFixed(1).replace('.',',')+' % do total'
              )
            );
          }),
          h('div',{style:{borderTop:'2px solid #e5e7eb',marginTop:12,paddingTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}},
            h('span',{style:{fontSize:14,fontWeight:700,color:'#111827',fontFamily:'sans-serif'}},'Total'),
            h('span',{style:{fontSize:20,fontWeight:800,color:Au,fontFamily:'monospace'}},fmtEur(totalNecessario))
          )
        ),

        // ── TABELA IMT ACCORDION ───────────────────────────────────────────
        h('div',{style:card},
          h('button',{
            onClick:function(){setShowTable(!showTable);},
            style:{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}
          },
            h('h3',{style:{fontSize:isMobile?14:15,fontWeight:700,color:'#111827',margin:0,fontFamily:"'Inter',system-ui,sans-serif"}},'Escalões IMT 2026'),
            h('span',{style:{fontSize:12,color:Au,fontWeight:600,fontFamily:'sans-serif',flexShrink:0,marginLeft:8}},showTable?'▲ Fechar':'▼ Ver escalões')
          ),

          isJovem&&h('div',{style:{marginTop:12,padding:'10px 14px',background:'#eff6ff',borderRadius:8,border:'1px solid #bfdbfe'}},
            h('p',{style:{fontSize:13,color:'#1e40af',fontWeight:700,fontFamily:'sans-serif',margin:'0 0 3px'}},'🎉 Benefício IMT Jovem (OE 2026)'),
            h('p',{style:{fontSize:12,color:'#1d4ed8',fontFamily:'sans-serif',margin:0,lineHeight:1.55}},
              'Isenção total para imóveis até €330 539  ·  ',
              'Entre €330 539 e €660 982: 8% apenas sobre o excedente  ·  ',
              'Acima de €660 982: tabela normal'
            )
          ),

          showTable&&h('div',{style:{marginTop:14,overflowX:'auto'}},
            h('p',{style:{fontSize:11,color:'#6b7280',fontFamily:'sans-serif',marginBottom:8}},
              finalidade==='hpp'?'Tabela I — 1ª Habitação Própria Permanente (Continente)':'Tabela II — 2ª Habitação e Arrendamento'
            ),
            h('table',{style:{width:'100%',borderCollapse:'collapse',fontSize:13,fontFamily:'sans-serif'}},
              h('thead',null,
                h('tr',{style:{background:'#f9fafb'}},
                  h('th',{style:{padding:'8px 10px',textAlign:'left',color:'#6b7280',fontWeight:700,borderBottom:'1px solid #e5e7eb',fontSize:11,letterSpacing:'0.5px'}},'Escalão'),
                  h('th',{style:{padding:'8px 10px',textAlign:'right',color:'#6b7280',fontWeight:700,borderBottom:'1px solid #e5e7eb',fontSize:11}}, 'Taxa marginal')
                )
              ),
              h('tbody',null,
                brackets.map(function(b,i){
                  var isActive=i===activeBracket;
                  var rangeLabel=b.max===Infinity?'Acima de '+fmtEur(b.min):fmtEur(b.min)+' a '+fmtEur(b.max);
                  return h('tr',{key:i,style:{background:isActive?'#eff6ff':'transparent',borderBottom:'1px solid #f3f4f6'}},
                    h('td',{style:{padding:'8px 10px',color:isActive?'#1e40af':'#374151',fontWeight:isActive?700:400}},
                      (isActive?'▶ ':'')+rangeLabel
                    ),
                    h('td',{style:{padding:'8px 10px',textAlign:'right',color:isActive?'#1e40af':'#374151',fontWeight:isActive?700:400}},b.rate)
                  );
                })
              )
            )
          )
        ),

        // ── NOTA ──────────────────────────────────────────────────────────
        h('p',{style:{fontSize:11,color:'#9ca3af',textAlign:'center',padding:'4px 10px 28px',fontFamily:'sans-serif',lineHeight:1.65}},
          'Valores estimados com base nas tabelas vigentes em 2026. O IMT incide sobre o maior valor entre o preço de escritura e o VPT.',
          h('br',null),
          'Consulta sempre um notário ou solicitador antes de avançar com a escritura.'
        ),

        h(window.PageFooter,null)
      ),
      h(window.CookieBanner,null)
    );
  }

  window.CustosCompraPage=CustosCompraPage;
})();
