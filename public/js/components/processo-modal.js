;(function(){
'use strict';
if(!window.React||!window._SIM)return;
var React=window.React;
var h=React.createElement;
var useState=React.useState;
var useEffect=React.useEffect;
var Au=window._SIM.Au;
var Sky=window._SIM.Sky;
var G=window._SIM.G;

var PASSOS=[
  {n:1,icone:"📋",titulo:"Preparação",duracao:"2–4 semanas",cor:"#7c3aed",corBg:"rgba(124,58,237,0.08)",
   descricao:"Reúne os documentos necessários, faz simulações em vários bancos e verifica se o teu DSTI está dentro dos limites regulatórios (máx. 40% do rendimento).",
   itens:["Simula em vários bancos para comparar spreads e TAEG","Verifica o teu historial de crédito (Banco de Portugal)","Recolhe documentos base (recibos, IRS, extractos)","Confirma o teu DSTI com as obrigações actuais"]},
  {n:2,icone:"📄",titulo:"Pedido ao Banco / FINE",duracao:"1–2 semanas",cor:Au,corBg:"rgba(37,99,235,0.08)",
   descricao:"Submete o pedido formal de crédito ao banco escolhido. O banco é obrigado a entregar-te a Ficha de Informação Normalizada Europeia (FINE) com todas as condições.",
   itens:["Submete o processo com todos os documentos","Recebe e analisa a FINE (compara entre bancos)","A FINE tem validade mínima de 30 dias","Não assines nada antes de ler a FINE com atenção"]},
  {n:3,icone:"🏠",titulo:"Escolha do Imóvel + CPCV",duracao:"Variável",cor:"#0284c7",corBg:"rgba(2,132,199,0.08)",
   descricao:"Após identificar o imóvel, assina o Contrato de Promessa de Compra e Venda (CPCV) e paga o sinal. O banco precisa de conhecer o imóvel antes da aprovação definitiva.",
   itens:["Negoceia o preço e condições com o vendedor","Assina o CPCV com advogado ou solicitador","Sinal típico: 10–20% do valor de compra","Comunica ao banco o imóvel escolhido"]},
  {n:4,icone:"🔍",titulo:"Avaliação do Imóvel",duracao:"1–2 semanas",cor:"#d97706",corBg:"rgba(217,119,6,0.08)",
   descricao:"O banco envia um perito avaliador ao imóvel. O valor de avaliação pode diferir do preço de compra e afecta o LTV máximo financiável.",
   itens:["Perito nomeado pelo banco (custo: €150–€300)","Se a avaliação for inferior ao preço, financiam o mínimo","LTV calcula-se sobre o menor valor (compra vs avaliação)","Podes pedir 2ª avaliação se discordares (mediante novo custo)"]},
  {n:5,icone:"✅",titulo:"Aprovação Definitiva",duracao:"2–4 semanas",cor:G,corBg:"rgba(22,163,74,0.08)",
   descricao:"O banco analisa toda a documentação, avaliação e o teu perfil de risco. Se aprovado, emite a carta de aprovação e prepara o contrato de mútuo.",
   itens:["Análise de risco pelo departamento de crédito","Possível pedido de documentos adicionais","Carta de aprovação com condições definitivas","Lê o contrato de mútuo antes de assinar"]},
  {n:6,icone:"✍️",titulo:"Escritura",duracao:"1–2 semanas após aprovação",cor:"#0f766e",corBg:"rgba(15,118,110,0.08)",
   descricao:"A escritura é o acto notarial onde se formaliza a compra e o crédito habitação. Pagas o IMT, Imposto de Selo e as restantes despesas iniciais.",
   itens:["Agenda com o cartório/notário (banco sugere ou escolhes tu)","Pagas IMT + IS na Autoridade Tributária antes da escritura","Custo total de entrada: tipicamente 5–9% do valor do imóvel","Registo na Conservatória após a escritura (incluído nas custas)"]},
  {n:7,icone:"🏦",titulo:"Início das Prestações",duracao:"Mês seguinte à escritura",cor:"#374151",corBg:"rgba(55,65,81,0.06)",
   descricao:"Após a escritura, o banco liberta o capital. As prestações começam no mês seguinte (ou após o período de carência, se tiveres negociado um).",
   itens:["Activa o débito directo na conta indicada ao banco","1ª prestação no mês seguinte à escritura","Pede extrato inicial com quadro de amortização","Guarda todos os documentos do crédito em local seguro"]},
];

var TIPOS_MUTUARIO=[
  {id:"permanente",label:"Assalariado (Efectivo)"},
  {id:"temporario",label:"Assalariado (A Prazo)"},
  {id:"independente",label:"Trabalhador Independente"},
  {id:"pensionista",label:"Pensionista"},
];

var DOCS_COMUNS=[
  {id:"cc",texto:"Cartão de Cidadão ou Passaporte (válido)"},
  {id:"nif",texto:"NIF — Número de Identificação Fiscal"},
  {id:"morada",texto:"Comprovativo de morada (fatura recente, ≤3 meses)"},
  {id:"extrato",texto:"Extractos bancários dos últimos 3 meses"},
  {id:"irs2",texto:"Declarações de IRS dos últimos 2 anos + Nota de Liquidação"},
  {id:"creditos",texto:"Documentos de créditos activos (extractos / cartas de aprovação)"},
];

var DOCS_POR_TIPO={
  permanente:[
    {id:"recibos3",texto:"Últimos 3 recibos de vencimento"},
    {id:"declaracao_emp",texto:"Declaração de vínculo laboral emitida pelo empregador"},
    {id:"info_rem",texto:"Informação remuneratória AT (Modelo 10 ou IRS pré-preenchido)"},
  ],
  temporario:[
    {id:"recibos6",texto:"Últimos 6 recibos de vencimento"},
    {id:"contrato_prazo",texto:"Contrato de trabalho a prazo (com data de início e fim)"},
    {id:"declaracao_emp2",texto:"Declaração do empregador com previsão de renovação"},
  ],
  independente:[
    {id:"recibos_verdes",texto:"Recibos verdes emitidos nos últimos 12 meses"},
    {id:"irs_b",texto:"Últimas 2 declarações de IRS com rendimentos Categoria B"},
    {id:"inicio_atividade",texto:"Declaração de início de actividade (portal AT)"},
    {id:"contabilidade",texto:"Mapa de contabilidade / TOC (se volume > €200k/ano)"},
    {id:"extrato12",texto:"Extractos bancários dos últimos 6–12 meses"},
  ],
  pensionista:[
    {id:"comp_pensao",texto:"Comprovativo de pensão (declaração SS / ADSE / CGA)"},
    {id:"boletim",texto:"Boletins de pensão dos últimos 3 meses"},
    {id:"decl_pensao",texto:"Declaração do valor anual bruto de pensão"},
  ],
};

var DOCS_IMOVEL=[
  {id:"caderneta",texto:"Caderneta predial urbana (emitida pela AT, válida 1 ano)"},
  {id:"certidao",texto:"Certidão de teor do Registo Predial (Conservatória)"},
  {id:"licenca",texto:"Licença de utilização / habitação (Câmara Municipal)"},
  {id:"seguro_multi",texto:"Seguro multirriscos habitação (obrigatório antes da escritura)"},
  {id:"hab_prop_frac",texto:"Regulamento de condomínio (se fracção autónoma)"},
];

var ALERTAS=[
  {icone:"⚠️",texto:"Se a avaliação for inferior ao preço de compra, o banco financia sobre o valor mais baixo — precisas de mais capital próprio."},
  {icone:"⏰",texto:"A FINE tem validade mínima de 30 dias. Usa esse tempo para comparar propostas entre bancos sem pressão."},
  {icone:"💡",texto:"Podes negociar spread, comissões, seguros e período de carência. A primeira proposta raramente é a melhor."},
  {icone:"🔒",texto:"O CPCV compromete-te. Se desistires por culpa tua, perdes o sinal. Se o vendedor desistir, devolve em dobro."},
];

function ProcessoModal(props){
  var onClose=props.onClose||function(){};
  var _tab=useState("processo");
  var tab=_tab[0];var setTab=_tab[1];
  var _tipo=useState("permanente");
  var tipo=_tipo[0];var setTipo=_tipo[1];
  var _checked=useState(function(){
    try{var s=localStorage.getItem("processo_checked");return s?JSON.parse(s):{};} catch(_){return {};}
  });
  var checked=_checked[0];var setChecked=_checked[1];

  useEffect(function(){
    try{localStorage.setItem("processo_checked",JSON.stringify(checked));}catch(_){}
  },[checked]);

  function toggleCheck(id){
    setChecked(function(prev){var next=Object.assign({},prev);next[id]=!prev[id];return next;});
  }

  function tabBtn(id,label){
    var active=tab===id;
    return h("button",{
      onClick:function(){setTab(id);},
      className:"btn-mini",
      style:{flex:1,padding:"8px 4px",border:"none",background:active?"rgba(37,99,235,0.1)":"transparent",borderBottom:active?"2px solid "+Au:"2px solid transparent",color:active?Au:"#374151",fontSize:12,fontFamily:"'Inter',system-ui,sans-serif",cursor:active?"default":"pointer",fontWeight:active?700:500,transition:"all 0.15s"}
    },label);
  }

  function passoItem(p){
    return h("div",{key:p.n,style:{display:"flex",gap:12,marginBottom:16,alignItems:"flex-start"}},
      h("div",{style:{flexShrink:0,width:36,height:36,borderRadius:"50%",background:p.corBg,border:"2px solid "+p.cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}},p.icone),
      h("div",{style:{flex:1}},
        h("div",{style:{display:"flex",alignItems:"baseline",gap:8,marginBottom:3,flexWrap:"wrap"}},
          h("span",{style:{fontWeight:700,fontSize:13,color:"#111827",fontFamily:"'Inter',system-ui,sans-serif"}},"Passo "+p.n+" · "+p.titulo),
          h("span",{style:{fontSize:11,color:p.cor,fontWeight:600,background:p.corBg,padding:"1px 7px",borderRadius:20}},p.duracao)
        ),
        h("p",{style:{fontSize:12,color:"#374151",marginBottom:6,lineHeight:1.5,fontFamily:"'Inter',system-ui,sans-serif"}},p.descricao),
        h("ul",{style:{margin:0,paddingLeft:14}},
          p.itens.map(function(it,i){
            return h("li",{key:i,style:{fontSize:11,color:"#4b5563",marginBottom:2,lineHeight:1.5,fontFamily:"'Inter',system-ui,sans-serif"}},it);
          })
        )
      )
    );
  }

  function docItem(doc,secao){
    var id=secao+"_"+doc.id;
    var isChecked=!!checked[id];
    return h("div",{key:doc.id,style:{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.04)"}},
      h("input",{type:"checkbox",checked:isChecked,onChange:function(){toggleCheck(id);},
        style:{width:16,height:16,minHeight:16,minWidth:16,accentColor:Au,cursor:"pointer",flexShrink:0}}),
      h("span",{style:{fontSize:12,color:isChecked?"#9ca3af":"#111827",textDecoration:isChecked?"line-through":"none",lineHeight:1.4,fontFamily:"'Inter',system-ui,sans-serif",transition:"all 0.15s"}},doc.texto)
    );
  }

  var totalChecked=Object.values(checked).filter(Boolean).length;

  return h("div",{
    onClick:function(e){if(e.target===e.currentTarget)onClose();},
    style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}
  },
    h("div",{style:{background:"#fff",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",width:"100%",maxWidth:580,maxHeight:"88vh",display:"flex",flexDirection:"column",overflow:"hidden"}},
      h("div",{style:{padding:"14px 20px 10px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}},
        h("div",null,
          h("div",{style:{fontSize:11,letterSpacing:3,color:Au,fontFamily:"monospace",marginBottom:2}},"GUIA DO PROCESSO"),
          h("div",{style:{fontSize:12,color:"#4b5563",fontFamily:"sans-serif"}},"Da preparação à escritura — documentos e dicas")
        ),
        h("button",{onClick:onClose,"aria-label":"Fechar guia do processo",style:{background:"none",border:"none",fontSize:28,fontWeight:800,cursor:"pointer",color:"#dc2626",padding:"4px 8px",borderRadius:6,lineHeight:1,flexShrink:0}},"×")
      ),
      h("div",{style:{display:"flex",borderBottom:"1px solid rgba(0,0,0,0.07)",flexShrink:0}},
        tabBtn("processo","📋 Processo"),
        tabBtn("documentos","📁 Documentos"),
        tabBtn("dicas","⚠️ Dicas")
      ),
      h("div",{style:{overflowY:"auto",padding:"14px 20px 20px",flex:1}},

        tab==="processo"&&h("div",null,PASSOS.map(passoItem)),

        tab==="documentos"&&h("div",null,
          h("div",{style:{marginBottom:12}},
            h("p",{style:{fontSize:12,color:"#4b5563",marginBottom:10,fontFamily:"sans-serif"}},"Selecciona o teu tipo de vínculo:"),
            h("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}},
              TIPOS_MUTUARIO.map(function(t){
                var active=tipo===t.id;
                return h("button",{key:t.id,onClick:function(){setTipo(t.id);},className:"btn-mini",
                  style:{padding:"5px 10px",border:"1px solid "+(active?Au:"rgba(0,0,0,0.12)"),borderRadius:16,background:active?"rgba(37,99,235,0.1)":"#fff",color:active?Au:"#374151",fontSize:11,fontFamily:"sans-serif",cursor:"pointer",fontWeight:active?700:500}
                },t.label);
              })
            ),
            totalChecked>0&&h("div",{style:{fontSize:11,color:G,fontWeight:600}},"✓ "+totalChecked+" documentos marcados")
          ),
          h("div",{style:{fontSize:11,fontWeight:700,color:"#374151",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}},"Documentos Pessoais"),
          DOCS_COMUNS.map(function(d){return docItem(d,"comum");}),
          h("div",{style:{fontSize:11,fontWeight:700,color:"#374151",margin:"14px 0 8px",textTransform:"uppercase",letterSpacing:0.5}},"Rendimento — "+TIPOS_MUTUARIO.find(function(t){return t.id===tipo;}).label),
          (DOCS_POR_TIPO[tipo]||[]).map(function(d){return docItem(d,tipo);}),
          h("div",{style:{fontSize:11,fontWeight:700,color:"#374151",margin:"14px 0 8px",textTransform:"uppercase",letterSpacing:0.5}},"Documentos do Imóvel"),
          DOCS_IMOVEL.map(function(d){return docItem(d,"imovel");}),
          h("div",{style:{marginTop:12,padding:"8px 10px",background:"rgba(37,99,235,0.05)",borderRadius:7,fontSize:11,color:"#374151",fontFamily:"sans-serif"}},"📌 Os requisitos variam ligeiramente por banco. Confirma sempre com o gestor de crédito.")
        ),

        tab==="dicas"&&h("div",null,
          ALERTAS.map(function(a,i){
            return h("div",{key:i,style:{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 0",borderBottom:i<ALERTAS.length-1?"1px solid rgba(0,0,0,0.05)":"none"}},
              h("span",{style:{fontSize:20,flexShrink:0,lineHeight:1.2}},a.icone),
              h("span",{style:{fontSize:12,color:"#374151",lineHeight:1.55,fontFamily:"sans-serif"}},a.texto)
            );
          }),
          h("div",{style:{marginTop:14,padding:"10px 12px",background:"rgba(37,99,235,0.06)",borderRadius:8,border:"1px solid rgba(37,99,235,0.15)"}},
            h("p",{style:{fontSize:12,color:Au,fontWeight:600,marginBottom:3,fontFamily:"sans-serif"}},"💡 Custos de entrada típicos"),
            [
              ["IMT","0% a 8% do valor (progressivo)"],
              ["IS Compra","0,8% do valor do imóvel"],
              ["IS Crédito","0,6% do capital financiado"],
              ["Avaliação + Dossier","€150 a €800"],
              ["Escritura + Registos","€700 a €1.500"],
            ].map(function(r,i){
              return h("div",{key:i,style:{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(37,99,235,0.08)"}},
                h("span",{style:{fontSize:11,color:"#374151",fontFamily:"sans-serif"}},r[0]),
                h("span",{style:{fontSize:11,fontWeight:700,color:Au,fontFamily:"monospace"}},r[1])
              );
            }),
            h("div",{style:{fontSize:11,color:"#166534",marginTop:8,fontFamily:"sans-serif"}},"✓ Jovens ≤35 anos: isenção de IMT para VPT ≤ €316.772 (1ª habitação).")
          )
        )
      )
    )
  );
}

window.ProcessoModal=ProcessoModal;
})();
