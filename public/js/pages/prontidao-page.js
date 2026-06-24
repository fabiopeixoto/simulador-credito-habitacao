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
  var CONTRATO_FACTOR=window._SIM.CONTRATO_FACTOR;
  var calcP=window._SIM.calcP;
  var Au=window._SIM.Au;
  var G=window._SIM.G;
  var R=window._SIM.R;
  var N=window._SIM.N;

  var TIPO_OPTS=[
    ['efetivo','Efectivo (100%)'],
    ['termo','A Termo (90%)'],
    ['parcial','Part-time (80%)'],
    ['recibo','Rec. Verde (70%)'],
    ['pensao','Pensão (100%)']
  ];

  function statusColor(s){return s==='verde'?G:s==='amarelo'?'#ca8a04':'#dc2626';}
  function statusBg(s){return s==='verde'?'rgba(22,163,74,0.07)':s==='amarelo'?'rgba(202,138,4,0.07)':'rgba(220,38,38,0.07)';}
  function statusLabel(s){return s==='verde'?'✓ OK':s==='amarelo'?'⚠ Atenção':'✗ Risco';}

  function ProntidaoPage(props){
    var EUR=props.EUR||FALLBACK_EUR;
    var commentCount=props.commentCount||0;
    var onOpenComments=props.onOpenComments||function(){};
    var onOpenGlossario=props.onOpenGlossario||null;
    var onOpenProcesso=props.onOpenProcesso||null;
    var eur6m=(EUR['6m']&&EUR['6m'].valor)||FALLBACK_EUR['6m'].valor;

    var _rend=useState(1800);var rendimento=_rend[0];var setRendimento=_rend[1];
    var _tipo=useState('efetivo');var tipo=_tipo[0];var setTipo=_tipo[1];
    var _anos=useState(3);var anosEmprego=_anos[0];var setAnosEmprego=_anos[1];
    var _debt=useState(0);var outrosEncargos=_debt[0];var setOutrosEncargos=_debt[1];
    var _hist=useState('limpo');var historico=_hist[0];var setHistorico=_hist[1];
    var _poupa=useState(40000);var poupanca=_poupa[0];var setPoupanca=_poupa[1];
    var _val=useState(250000);var valorImovel=_val[0];var setValorImovel=_val[1];
    var _ltv=useState(80);var ltv=_ltv[0];var setLtv=_ltv[1];
    var _idade=useState(30);var idade=_idade[0];var setIdade=_idade[1];
    var _capital=useState(200000);var capital=_capital[0];var setCapital=_capital[1];
    var _prazo=useState(30);var prazo=_prazo[0];var setPrazo=_prazo[1];
    var _tan=useState(parseFloat((eur6m+1.0).toFixed(3)));var tan=_tan[0];var setTan=_tan[1];
    var _cj=useState(false);var creditoJovem=_cj[0];var setCreditoJovem=_cj[1];
    var _jltv=useState(0.9);var jovemLTV=_jltv[0];var setJovemLTV=_jltv[1];
    var _mob=useState(typeof window!=='undefined'&&window.innerWidth<640);var isMobile=_mob[0];var setIsMobile=_mob[1];

    useEffect(function(){
      function onR(){setIsMobile(window.innerWidth<640);}
      window.addEventListener('resize',onR,{passive:true});
      return function(){window.removeEventListener('resize',onR);};
    },[]);

    var calc=useMemo(function(){
      var tanN=typeof tan==='number'?tan:parseFloat(tan)||0;
      var cf=CONTRATO_FACTOR[tipo]||1;
      var rendConsiderado=Math.round(rendimento*cf);
      var prestacaoHabitacao=Math.round(calcP(capital,tanN,prazo));
      var totalEncargos=outrosEncargos+prestacaoHabitacao;
      var dstiComCredito=rendConsiderado>0?totalEncargos/rendConsiderado*100:0;
      var prestacaoMaxima=Math.max(0,rendConsiderado*0.35-outrosEncargos);

      // 1 — DSTI
      var dsti_status=dstiComCredito<=35?'verde':dstiComCredito<=40?'amarelo':'vermelho';
      var dsti_desc='Com este crédito, o teu DSTI seria '+dstiComCredito.toFixed(0)+'% (BdP recomenda ≤35%). Rendimento considerado pelo banco: '+fE(rendConsiderado)+'/mês.';
      var dsti_acao=dsti_status==='vermelho'?'Reduz a prestação (capital menor ou prazo maior) ou liquida outros créditos antes de pedir habitação.':
                    dsti_status==='amarelo'?'Estás no limite. O banco pode aprovar, mas considera reduzir o capital pedido.':null;

      // 2 — Estabilidade laboral
      var emp_status;
      if(tipo==='recibo'&&anosEmprego<2) emp_status='vermelho';
      else if(tipo==='recibo') emp_status='amarelo';
      else if(tipo==='pensao') emp_status='verde';
      else if(anosEmprego<1) emp_status='amarelo';
      else emp_status='verde';
      var emp_desc=tipo==='recibo'&&anosEmprego<2?'Recibo verde com '+anosEmprego+' ano(s) — os bancos habitualmente exigem ≥2 anos de historial sólido.':
                   tipo==='recibo'?'Recibo verde ≥2 anos: crédito possível, mas o banco aplica penalização no rendimento (×70%).':
                   tipo==='pensao'?'Pensionista — rendimento estável, perfil geralmente bem aceite.':
                   anosEmprego<1?'Menos de 1 ano no emprego actual — alguns bancos exigem 1 a 2 anos de antiguidade.':
                   'Vínculo '+tipo+' com '+anosEmprego+' ano(s) — boa estabilidade laboral.';
      var emp_acao=emp_status==='vermelho'?'Aguarda mais tempo no emprego actual ou consolida 2+ anos de recibos consistentes.':
                   emp_status==='amarelo'?'Considera esperar mais alguns meses para reforçar o historial laboral.':null;

      // 3 — Historial de crédito
      var hist_status=historico==='limpo'?'verde':historico==='atrasos'?'amarelo':'vermelho';
      var hist_desc=historico==='limpo'?'Sem incidentes de crédito — excelente. Os bancos valorizam muito um historial limpo.':
                    historico==='atrasos'?'Atrasos pontuais resolvidos: a aprovação é possível, mas o banco pode ser mais cauteloso.':
                    'Incidentes activos registados no Banco de Portugal — aprovação muito improvável enquanto houver incumprimentos.';
      var hist_acao=historico==='incidentes'?'Regulariza todos os incumprimentos antes de pedir crédito. Consulta o teu Mapa de Responsabilidades de Crédito no BdP.':
                    historico==='atrasos'?'Garante que todos os atrasos estão resolvidos. Espera alguns meses para o historial reflectir a melhoria.':null;

      // 4 — Poupança disponível
      var isJovem=creditoJovem&&idade<=35;
      var ltvEfetivo=isJovem?Math.round(jovemLTV*100):ltv;
      var entrada=valorImovel*(1-ltvEfetivo/100);
      var custos=Math.round(valorImovel*0.05);
      var poupancaNecessaria=entrada+custos;
      var poupa_status=poupanca>=poupancaNecessaria?'verde':poupanca>=entrada?'amarelo':'vermelho';
      var jovemBadge=isJovem?'🎓 Crédito Jovem (LTV '+ltvEfetivo+'%'+(ltvEfetivo===100?' — D.L. Jovem':'')+') — ':'';
      var imtNota=isJovem?' (IMT isento em 1.ª habitação para jovens ≤35a)':'';
      var poupa_desc=jovemBadge+'Entrada necessária: '+fE(Math.round(entrada))+'. Custos estimados (IMT+IS+escritura ~5%'+imtNota+'): '+fE(custos)+'. Total recomendado: '+fE(Math.round(poupancaNecessaria))+'. Tens: '+fE(poupanca)+'.';
      var poupa_acao=poupa_status==='vermelho'?(
        isJovem?(jovemLTV<1?'Faltam ~'+fE(Math.round(poupancaNecessaria-poupanca))+'. Experimenta o LTV 100% (D.L. Jovem — sem entrada) no toggle acima.':'Faltam ~'+fE(Math.round(poupancaNecessaria-poupanca))+' mesmo com LTV 100%. Aumenta a poupança ou reduz o valor do imóvel.')
               :'Faltam ~'+fE(Math.round(poupancaNecessaria-poupanca))+'. Poupa mais antes de avançar ou activa o modo Crédito Jovem acima (se tens ≤35 anos) para reduzir a entrada.'
      ):poupa_status==='amarelo'?'Tens a entrada, mas os custos de transacção (~5%) podem deixar pouca margem. Recomenda-se uma reserva adicional.':null;

      // 5 — Idade e prazo BdP
      var prazoMaxBdP=idade<=30?40:idade<=35?37:35;
      var idadeNoFim=idade+prazo;
      var age_status=(idadeNoFim<=75&&prazo<=prazoMaxBdP)?'verde':(idadeNoFim<=80)?'amarelo':'vermelho';
      var age_desc='Com '+idade+' anos e crédito a '+prazo+' anos, terminas com '+idadeNoFim+' anos. BdP (Aviso 4/2022): prazo máx. '+prazoMaxBdP+' anos para a tua faixa etária.';
      var age_acao=age_status==='vermelho'?'Reduz o prazo pedido ou o capital para cumprir os limites regulatórios do Banco de Portugal.':
                   age_status==='amarelo'?'Estás no limite. O banco pode aceitar, mas há risco de recusa ou condições mais restritivas.':null;

      var dimensoes=[
        {key:'dsti',   icon:'💰',label:'Taxa de Esforço (DSTI)',   status:dsti_status, desc:dsti_desc, acao:dsti_acao},
        {key:'emp',    icon:'💼',label:'Estabilidade Laboral',     status:emp_status,  desc:emp_desc,  acao:emp_acao},
        {key:'hist',   icon:'📋',label:'Historial de Crédito',     status:hist_status, desc:hist_desc, acao:hist_acao},
        {key:'poupa',  icon:'💵',label:'Poupança Disponível',      status:poupa_status,desc:poupa_desc,acao:poupa_acao},
        {key:'idade',  icon:'📅',label:'Idade e Prazo (BdP)',      status:age_status,  desc:age_desc,  acao:age_acao}
      ];

      var nVermelhos=dimensoes.filter(function(d){return d.status==='vermelho';}).length;
      var nAmarelos=dimensoes.filter(function(d){return d.status==='amarelo';}).length;
      var veredicto=nVermelhos===0&&nAmarelos<=1?'ok':nVermelhos<=1?'atencao':'nao';

      return{rendConsiderado:rendConsiderado,prestacaoHabitacao:prestacaoHabitacao,dstiComCredito:dstiComCredito,prestacaoMaxima:prestacaoMaxima,dimensoes:dimensoes,nVermelhos:nVermelhos,nAmarelos:nAmarelos,veredicto:veredicto,entrada:entrada,custos:custos,poupancaNecessaria:poupancaNecessaria,isJovem:isJovem,ltvEfetivo:ltvEfetivo};
    },[rendimento,tipo,anosEmprego,outrosEncargos,historico,poupanca,valorImovel,ltv,idade,capital,prazo,tan,creditoJovem,jovemLTV]);

    var card={background:'#fff',borderRadius:11,padding:isMobile?'14px 12px':'18px 20px',marginBottom:12};
    var secTitleS={fontSize:11,letterSpacing:3,color:Au,fontFamily:'monospace',marginBottom:12,textTransform:'uppercase'};
    var lbl={fontSize:11,color:'#374151',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:6};
    var fieldS={marginBottom:14};

    var VEREDICTOS={
      ok:{color:G,bg:'rgba(22,163,74,0.08)',border:'rgba(22,163,74,0.35)',icon:'✅',
          title:'Podes avançar com a candidatura',
          desc:'O teu perfil está alinhado com os critérios habituais dos bancos. Compara propostas de vários bancos no Simulador Principal antes de decidir.'},
      atencao:{color:'#ca8a04',bg:'rgba(202,138,4,0.08)',border:'rgba(202,138,4,0.35)',icon:'⚠️',
               title:'Perfil com pontos a melhorar',
               desc:'É possível avançar, mas há factores que podem dificultar a aprovação ou resultar em condições menos favoráveis. Analisa as sugestões abaixo.'},
      nao:{color:R,bg:'rgba(220,38,38,0.06)',border:'rgba(220,38,38,0.3)',icon:'⛔',
           title:'Não recomendado avançar agora',
           desc:'Vários factores indicam que a aprovação é improvável ou as condições serão muito desfavoráveis. Resolve os pontos assinalados com ✗ antes de avançar.'}
    };
    var vc=VEREDICTOS[calc.veredicto];

    return h('div',{style:{background:N,minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif",color:'#111827'}},
      h(window.PageHeader,{
        EUR:EUR,activePage:'prontidao',commentCount:commentCount,
        onOpenComments:onOpenComments,onOpenGlossario:onOpenGlossario,onOpenProcesso:onOpenProcesso,
        subtitle:'Avalia se o teu perfil está pronto para pedir crédito habitação · 5 dimensões · Análise orientativa'
      }),
      window.NoticeBanner&&h(window.NoticeBanner,null),
      h('main',{style:{maxWidth:960,margin:'0 auto',padding:isMobile?'12px 10px 40px':'18px 16px 48px'}},

        // ── MODO: NORMAL vs CRÉDITO JOVEM ──────────────────────────────────
        h('div',{style:{display:'flex',borderRadius:9,overflow:'hidden',border:'1px solid rgba(0,0,0,0.07)',marginBottom:8}},
          [{id:false,icon:'🏦',label:'Crédito Normal (LTV ≤80%)',c:Au},{id:true,icon:'🎓',label:'Crédito Jovem ≤35a',c:G}].map(function(o){
            return h('button',{key:String(o.id),onClick:function(){setCreditoJovem(o.id);if(o.id)setJovemLTV(0.9);},
              style:{flex:1,padding:isMobile?'8px 6px':'9px',border:'none',background:creditoJovem===o.id?'rgba(37,99,235,0.05)':'#fff',borderBottom:'2px solid '+(creditoJovem===o.id?o.c:'transparent'),color:creditoJovem===o.id?o.c:'#374151',fontSize:isMobile?12:13,fontFamily:'sans-serif',cursor:'pointer',fontWeight:600}},
              o.icon+' '+o.label);
          })
        ),
        creditoJovem&&idade>35&&h('div',{style:{background:'rgba(220,38,38,0.06)',border:'1px solid rgba(220,38,38,0.25)',borderRadius:8,padding:'8px 14px',marginBottom:8,fontSize:12,color:'#dc2626',fontWeight:600}},
          '⚠️ Crédito Jovem não disponível — o titular tem '+idade+' anos (limite máximo: 35 anos).'
        ),
        creditoJovem&&idade<=35&&h('div',{style:{display:'flex',borderRadius:9,overflow:'hidden',border:'1px solid rgba(22,163,74,0.25)',marginBottom:8}},
          [{ltv:0.9,label:'Entrada 10% (LTV 90%)'},{ltv:1.0,label:'Entrada 0% (LTV 100%) — D.L. Jovem'}].map(function(o){
            return h('button',{key:o.ltv,onClick:function(){setJovemLTV(o.ltv);},
              style:{flex:1,padding:'8px',border:'none',background:jovemLTV===o.ltv?'rgba(22,163,74,0.10)':'#fff',borderBottom:'2px solid '+(jovemLTV===o.ltv?G:'transparent'),color:jovemLTV===o.ltv?G:'#374151',fontSize:isMobile?11:12,fontFamily:'sans-serif',cursor:'pointer',fontWeight:jovemLTV===o.ltv?700:400}},
              o.label);
          })
        ),

        // ── INPUTS ─────────────────────────────────────────────────────────
        h('div',{style:{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fit,minmax(260px,1fr))',gap:10,marginBottom:10}},

          // Rendimento & encargos
          h('div',{style:card},
            h('div',{style:secTitleS},'Rendimento & Encargos'),
            h('div',{style:fieldS},
              h('span',{style:lbl},'Rendimento líquido / mês'),
              h(SliderInput,{min:500,max:10000,step:100,value:rendimento,onChange:setRendimento,color:Au,suffix:'€/mês',ariaLabel:'Rendimento',formatFn:function(v){return v.toLocaleString('pt-PT');}})
            ),
            h('div',{style:fieldS},
              h('span',{style:lbl},'Tipo de contrato'),
              h('select',{value:tipo,onChange:function(e){setTipo(e.target.value);},
                style:{width:'100%',background:'#fff',border:'1px solid rgba(37,99,235,0.3)',color:'#111827',borderRadius:6,padding:'6px 8px',fontSize:12,cursor:'pointer'}},
                TIPO_OPTS.map(function(o){return h('option',{key:o[0],value:o[0]},o[1]);})
              ),
              (CONTRATO_FACTOR[tipo]||1)<1&&h('div',{style:{fontSize:11,color:Au,marginTop:4}},
                'Banco considera '+Math.round((CONTRATO_FACTOR[tipo]||1)*100)+'% = '+fE(calc.rendConsiderado)+'/mês'
              )
            ),
            h('div',{style:fieldS},
              h('span',{style:lbl},'Anos no emprego actual'),
              h(SliderInput,{min:0,max:20,step:1,value:anosEmprego,onChange:setAnosEmprego,color:'#059669',suffix:' anos',ariaLabel:'Anos emprego',formatFn:function(v){return String(v);}})
            ),
            h('div',{style:fieldS},
              h('span',{style:lbl},'Outros encargos mensais'),
              h(SliderInput,{min:0,max:3000,step:50,value:outrosEncargos,onChange:setOutrosEncargos,color:'#f97316',suffix:'€/mês',ariaLabel:'Outros encargos',formatFn:function(v){return v.toLocaleString('pt-PT');}}),
              h('div',{style:{fontSize:11,color:'#6b7280',marginTop:3}},'Outros créditos, renda actual, pensão de alimentos…')
            )
          ),

          // Crédito pretendido
          h('div',{style:card},
            h('div',{style:secTitleS},'Crédito Pretendido'),
            h('div',{style:fieldS},
              h('span',{style:lbl},'Capital a pedir'),
              h(SliderInput,{min:20000,max:600000,step:5000,value:capital,onChange:setCapital,color:Au,prefix:'€',ariaLabel:'Capital',formatFn:function(v){return Math.round(v).toLocaleString('pt-PT');}})
            ),
            h('div',{style:fieldS},
              h('span',{style:lbl},'Prazo (anos)'),
              h(SliderInput,{min:5,max:40,step:1,value:prazo,onChange:setPrazo,color:'#059669',suffix:' anos',ariaLabel:'Prazo',formatFn:function(v){return String(v);}})
            ),
            h('div',{style:fieldS},
              h('span',{style:lbl},'TAN estimada (%)'),
              h('div',{style:{display:'flex',alignItems:'center',gap:8}},
                h('input',{type:'number',step:'0.001',min:'0',max:'15',className:'val-compact',
                  value:typeof tan==='number'?tan.toFixed(3):tan,
                  onChange:function(e){var v=parseFloat(e.target.value);if(!isNaN(v)&&v>=0)setTan(v);},
                  style:{width:90,padding:'6px 8px',border:'1px solid rgba(37,99,235,0.3)',borderRadius:6,fontSize:13}}),
                h('span',{style:{fontSize:11,color:'#6b7280'}},'Euribor 6m + spread ~1%')
              )
            ),
            h('div',{style:{padding:'8px 12px',background:'rgba(37,99,235,0.05)',borderRadius:8,fontSize:12,color:'#374151',marginTop:4}},
              'Prestação estimada: ',h('strong',{style:{color:Au}},fE(calc.prestacaoHabitacao)),'/mês',
              h('br',null),
              'DSTI com este crédito: ',h('strong',{style:{color:calc.dstiComCredito<=35?G:calc.dstiComCredito<=40?'#ca8a04':R}},calc.dstiComCredito.toFixed(0)+'%'),
              h('span',{style:{fontSize:11,color:'#6b7280'}}, ' (prestação máx. possível: '+fE(calc.prestacaoMaxima)+'/mês)')
            )
          ),

          // Imóvel & poupança
          h('div',{style:card},
            h('div',{style:secTitleS},'Imóvel & Poupança'),
            h('div',{style:fieldS},
              h('span',{style:lbl},'Valor do imóvel pretendido'),
              h(SliderInput,{min:50000,max:800000,step:5000,value:valorImovel,onChange:setValorImovel,color:Au,prefix:'€',ariaLabel:'Valor imóvel',formatFn:function(v){return Math.round(v).toLocaleString('pt-PT');}})
            ),
            !calc.isJovem&&h('div',{style:fieldS},
              h('span',{style:lbl},'LTV — financiamento (%)'),
              h(SliderInput,{min:50,max:90,step:5,value:ltv,onChange:setLtv,color:'#7c3aed',suffix:'%',ariaLabel:'LTV',formatFn:function(v){return String(v);}})
            ),
            calc.isJovem&&h('div',{style:fieldS},
              h('span',{style:lbl},'LTV — Crédito Jovem'),
              h('div',{style:{fontSize:13,color:G,fontWeight:700,padding:'6px 0'}},
                calc.ltvEfetivo+'% '+( calc.ltvEfetivo===100?'(D.L. Jovem — sem entrada necessária)':'(entrada mínima de 10%)')
              )
            ),
            h('div',{style:fieldS},
              h('span',{style:lbl},'Poupança disponível'),
              h(SliderInput,{min:0,max:200000,step:1000,value:poupanca,onChange:setPoupanca,color:G,prefix:'€',ariaLabel:'Poupança',formatFn:function(v){return Math.round(v).toLocaleString('pt-PT');}})
            ),
            h('div',{style:fieldS},
              h('span',{style:lbl},'Idade do titular principal'),
              h(SliderInput,{min:18,max:65,step:1,value:idade,onChange:setIdade,color:'#f97316',suffix:' anos',ariaLabel:'Idade',formatFn:function(v){return String(v);}})
            ),
            h('div',{style:fieldS},
              h('span',{style:lbl},'Historial de crédito'),
              h('div',{style:{display:'flex',flexDirection:'column',gap:8}},
                [['limpo','✅ Sem incidentes'],['atrasos','⚠️ Atrasos pontuais (já resolvidos)'],['incidentes','⛔ Incidentes activos']].map(function(o){
                  return h('label',{key:o[0],style:{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:13,color:historico===o[0]?'#111827':'#374151',fontWeight:historico===o[0]?600:400}},
                    h('input',{type:'radio',name:'historico',value:o[0],checked:historico===o[0],onChange:function(){setHistorico(o[0]);},style:{flexShrink:0}}),
                    o[1]
                  );
                })
              )
            )
          )
        ),

        // ── VEREDICTO ───────────────────────────────────────────────────────
        h('div',{style:{background:vc.bg,border:'1px solid '+vc.border,borderRadius:11,padding:'14px 18px',marginBottom:12}},
          h('div',{style:{fontSize:isMobile?17:21,fontWeight:800,color:vc.color,marginBottom:6}},vc.icon+' '+vc.title),
          h('div',{style:{fontSize:13,color:'#374151',lineHeight:1.6}},vc.desc)
        ),

        // ── CHECKLIST ───────────────────────────────────────────────────────
        h('div',{style:card},
          h('div',{style:secTitleS},'Avaliação por Dimensão'),
          h('div',{style:{display:'flex',flexDirection:'column'}},
            calc.dimensoes.map(function(d,i){
              return h('div',{key:d.key,style:{padding:'12px 0',borderBottom:i<calc.dimensoes.length-1?'1px solid #f3f4f6':'none'}},
                h('div',{style:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:isMobile?'wrap':'nowrap'}},
                  h('div',{style:{flex:1,minWidth:0}},
                    h('div',{style:{display:'flex',alignItems:'center',gap:6,marginBottom:4}},
                      h('span',{style:{fontSize:15,flexShrink:0}},d.icon),
                      h('span',{style:{fontSize:13,fontWeight:700,color:'#111827'}},d.label)
                    ),
                    h('div',{style:{fontSize:12,color:'#4b5563',lineHeight:1.65}},d.desc),
                    d.acao&&h('div',{style:{fontSize:12,color:'#7c3aed',marginTop:5,fontWeight:600,lineHeight:1.5}},'→ '+d.acao)
                  ),
                  h('div',{style:{flexShrink:0,marginTop:isMobile?6:0}},
                    h('span',{style:{display:'inline-flex',alignItems:'center',padding:'4px 10px',borderRadius:20,background:statusBg(d.status),color:statusColor(d.status),fontWeight:700,fontSize:12,fontFamily:'sans-serif',whiteSpace:'nowrap',border:'1px solid '+statusColor(d.status)+'44'}},
                      statusLabel(d.status)
                    )
                  )
                )
              );
            })
          )
        ),

        // ── CTA ─────────────────────────────────────────────────────────────
        calc.veredicto==='ok'&&h('div',{style:{background:'rgba(37,99,235,0.06)',border:'1px solid rgba(37,99,235,0.2)',borderRadius:11,padding:'14px 18px',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}},
          h('div',null,
            h('div',{style:{fontWeight:700,color:Au,marginBottom:3}},'Pronto para comparar os bancos?'),
            h('div',{style:{fontSize:12,color:'#374151'}},'Usa o Simulador Principal para ver as propostas de 13 bancos com o teu capital e prazo.')
          ),
          h('a',{href:'/?c='+capital+'&p='+prazo,style:{display:'inline-block',padding:'9px 18px',background:Au,border:'none',borderRadius:8,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'sans-serif',whiteSpace:'nowrap',textDecoration:'none'}},'Abrir Simulador →')
        ),

        h('p',{style:{fontSize:11,color:'#6b7280',textAlign:'center',padding:'4px 10px 20px',fontFamily:'sans-serif',lineHeight:1.65}},
          '⚠️ Avaliação orientativa baseada em parâmetros típicos do Banco de Portugal. Cada banco tem critérios próprios de análise de risco. Esta ferramenta não substitui uma pré-análise bancária oficial.'
        ),

        h(window.PageFooter,null)
      ),
      window.CookieBanner&&h(window.CookieBanner,null)
    );
  }

  window.ProntidaoPage=ProntidaoPage;
})();
