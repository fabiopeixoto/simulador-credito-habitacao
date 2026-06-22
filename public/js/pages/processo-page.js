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
  {
    n:1,icone:"📋",titulo:"Preparação",duracao:"2–4 semanas",cor:"#7c3aed",corBg:"rgba(124,58,237,0.08)",
    descricao:"Reúne os documentos necessários, faz simulações em vários bancos e verifica se o teu DSTI está dentro dos limites regulatórios (máx. 40% do rendimento).",
    itens:["Simula em vários bancos para comparar spreads e TAEG","Verifica o teu historial de crédito (Banco de Portugal)","Recolhe documentos base (recibos, IRS, extractos)","Confirma o teu DSTI com as obrigações actuais"]
  },
  {
    n:2,icone:"📄",titulo:"Pedido ao Banco / FINE",duracao:"1–2 semanas",cor:Au,corBg:"rgba(37,99,235,0.08)",
    descricao:"Submete o pedido formal de crédito ao banco escolhido. O banco é obrigado a entregar-te a Ficha de Informação Normalizada Europeia (FINE) com todas as condições.",
    itens:["Submete o processo com todos os documentos","Recebe e analisa a FINE (compara entre bancos)","A FINE tem validade mínima de 30 dias","Não assines nada antes de ler a FINE com atenção"]
  },
  {
    n:3,icone:"🏠",titulo:"Escolha do Imóvel + CPCV",duracao:"Variável",cor:"#0284c7",corBg:"rgba(2,132,199,0.08)",
    descricao:"Após identificar o imóvel, assina o Contrato de Promessa de Compra e Venda (CPCV) e paga o sinal. O banco precisa de conhecer o imóvel antes da aprovação definitiva.",
    itens:["Negoceia o preço e condições com o vendedor","Assina o CPCV com advogado ou solicitador","Sinal típico: 10–20% do valor de compra","Comunica ao banco o imóvel escolhido"]
  },
  {
    n:4,icone:"🔍",titulo:"Avaliação do Imóvel",duracao:"1–2 semanas",cor:"#d97706",corBg:"rgba(217,119,6,0.08)",
    descricao:"O banco envia um perito avaliador ao imóvel. O valor de avaliação pode diferir do preço de compra e afecta o LTV máximo financiável.",
    itens:["Perito nomeado pelo banco (custo: €150–€300)","Se a avaliação for inferior ao preço, financiam o mínimo","LTV calcula-se sobre o menor valor (compra vs avaliação)","Podes pedir 2ª avaliação se discordares (mediante novo custo)"]
  },
  {
    n:5,icone:"✅",titulo:"Aprovação Definitiva",duracao:"2–4 semanas",cor:G,corBg:"rgba(22,163,74,0.08)",
    descricao:"O banco analisa toda a documentação, avaliação e o teu perfil de risco. Se aprovado, emite a carta de aprovação e prepara o contrato de mútuo.",
    itens:["Análise de risco pelo departamento de crédito","Possível pedido de documentos adicionais","Carta de aprovação com condições definitivas","Lê o contrato de mútuo antes de assinar"]
  },
  {
    n:6,icone:"✍️",titulo:"Escritura",duracao:"1–2 semanas após aprovação",cor:"#0f766e",corBg:"rgba(15,118,110,0.08)",
    descricao:"A escritura é o acto notarial onde se formaliza a compra e o crédito habitação. Pagas o IMT, Imposto de Selo e as restantes despesas iniciais.",
    itens:["Agenda com o cartório/notário (banco sugere ou escolhes tu)","Pagas IMT + IS na Autoridade Tributária antes da escritura","Custo total de entrada: tipicamente 5–9% do valor do imóvel","Registo na Conservatória após a escritura (incluído nas custas)"]
  },
  {
    n:7,icone:"🏦",titulo:"Início das Prestações",duracao:"Mês seguinte à escritura",cor:"#374151",corBg:"rgba(55,65,81,0.06)",
    descricao:"Após a escritura, o banco liberta o capital. As prestações começam no mês seguinte (ou após o período de carência, se tiveres negociado um).",
    itens:["Activa o débito directo na conta indicada ao banco","1ª prestação no mês seguinte à escritura","Pede extrato inicial com quadro de amortização","Guarda todos os documentos do crédito em local seguro"]
  }
];

var TIPOS_MUTUARIO=[
  {id:"permanente",label:"Assalariado (Efectivo)"},
  {id:"temporario",label:"Assalariado (A Prazo / Temporário)"},
  {id:"independente",label:"Trabalhador Independente"},
  {id:"pensionista",label:"Pensionista"},
];

var DOCS_COMUNS=[
  {id:"cc",texto:"Cartão de Cidadão ou Passaporte (válido)",todos:true},
  {id:"nif",texto:"NIF — Número de Identificação Fiscal",todos:true},
  {id:"morada",texto:"Comprovativo de morada (fatura recente, ≤3 meses)",todos:true},
  {id:"extrato",texto:"Extractos bancários dos últimos 3 meses",todos:true},
  {id:"irs2",texto:"Declarações de IRS dos últimos 2 anos + Nota de Liquidação",todos:true},
  {id:"creditos",texto:"Documentos de créditos activos (extractos / cartas de aprovação)",todos:true},
];

var DOCS_POR_TIPO={
  permanente:[
    {id:"recibos3",texto:"Últimos 3 recibos de vencimento"},
    {id:"declaracao_emp",texto:"Declaração de vínculo laboral emitida pelo empregador"},
    {id:"info_rem",texto:"Informação remuneratória AT (Modelo 10 ou IRS pré-preenchido)"},
  ],
  temporario:[
    {id:"recibos6",texto:"Últimos 6 recibos de vencimento (em vez de 3)"},
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
  {icone:"⚠️",cor:"#d97706",texto:"Se a avaliação for inferior ao preço de compra, o banco financia sobre o valor mais baixo — precisas de mais capital próprio."},
  {icone:"⏰",cor:Au,texto:"A FINE tem validade mínima de 30 dias. Usa esse tempo para comparar propostas entre bancos sem pressão."},
  {icone:"💡",cor:G,texto:"Podes negociar spread, comissões, seguros e período de carência. A primeira proposta raramente é a melhor."},
  {icone:"🔒",cor:"#7c3aed",texto:"O CPCV compromete-te. Se desistires por culpa tua, perdes o sinal. Se o vendedor desistir, devolve em dobro."},
];

function ProcessoPage(props){
  var EUR=props.EUR||{};
  var commentCount=props.commentCount||0;
  var onOpenComments=props.onOpenComments||function(){};
  var onOpenGlossario=props.onOpenGlossario||null;

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
    setChecked(function(prev){
      var next=Object.assign({},prev);
      next[id]=!prev[id];
      return next;
    });
  }

  var isMobile=typeof window!=='undefined'&&window.innerWidth<640;

  function card(children,extra){
    return h("div",{style:Object.assign({background:"#fff",borderRadius:11,padding:"18px 20px",marginBottom:14},extra||{})},children);
  }

  function tabBtn(id,label){
    var active=tab===id;
    return h("button",{
      onClick:function(){setTab(id);},
      style:{
        flex:1,padding:"9px 6px",border:"none",
        background:active?"rgba(37,99,235,0.1)":"rgba(0,0,0,0.04)",
        borderBottom:active?"2px solid "+Au:"2px solid transparent",
        color:active?Au:"#374151",fontSize:13,fontFamily:"'Inter',system-ui,sans-serif",
        cursor:active?"default":"pointer",fontWeight:active?700:500,transition:"all 0.15s"
      }
    },label);
  }

  function passoCard(p){
    return h("div",{key:p.n,style:{display:"flex",gap:14,marginBottom:20,alignItems:"flex-start"}},
      h("div",{style:{flexShrink:0,width:44,height:44,borderRadius:"50%",background:p.corBg,border:"2px solid "+p.cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}},p.icone),
      h("div",{style:{flex:1}},
        h("div",{style:{display:"flex",alignItems:"baseline",gap:10,marginBottom:4,flexWrap:"wrap"}},
          h("span",{style:{fontWeight:700,fontSize:15,color:"#111827",fontFamily:"'Inter',system-ui,sans-serif"}},"Passo "+p.n+" · "+p.titulo),
          h("span",{style:{fontSize:12,color:p.cor,fontWeight:600,background:p.corBg,padding:"2px 8px",borderRadius:20}},p.duracao)
        ),
        h("p",{style:{fontSize:13,color:"#374151",marginBottom:8,lineHeight:1.55,fontFamily:"'Inter',system-ui,sans-serif"}},p.descricao),
        h("ul",{style:{margin:0,paddingLeft:16}},
          p.itens.map(function(it,i){
            return h("li",{key:i,style:{fontSize:12,color:"#4b5563",marginBottom:3,lineHeight:1.5,fontFamily:"'Inter',system-ui,sans-serif"}},it);
          })
        )
      )
    );
  }

  function docItem(doc,secao){
    var id=secao+"_"+doc.id;
    var isChecked=!!checked[id];
    return h("div",{key:doc.id,style:{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(0,0,0,0.04)"}},
      h("input",{
        type:"checkbox",checked:isChecked,
        onChange:function(){toggleCheck(id);},
        style:{width:18,height:18,minHeight:18,minWidth:18,accentColor:Au,cursor:"pointer",flexShrink:0}
      }),
      h("span",{style:{fontSize:13,color:isChecked?"#6b7280":"#111827",textDecoration:isChecked?"line-through":"none",lineHeight:1.4,fontFamily:"'Inter',system-ui,sans-serif",transition:"all 0.15s"}},doc.texto)
    );
  }

  var totalDocs=DOCS_COMUNS.length+(DOCS_POR_TIPO[tipo]||[]).length+DOCS_IMOVEL.length;
  var totalChecked=Object.values(checked).filter(Boolean).length;

  return h(React.Fragment,null,
    h(window.PageHeader,{
      EUR:EUR,activePage:"processo",
      commentCount:commentCount,onOpenComments:onOpenComments,
      onOpenGlossario:onOpenGlossario,
      subtitle:"Guia do processo de crédito habitação — da preparação à escritura"
    }),
    window.NoticeBanner&&h(window.NoticeBanner,null),
    h("div",{style:{maxWidth:860,margin:"0 auto",padding:isMobile?"12px 10px 40px":"20px 16px 60px"}},
      h("div",{style:{display:"flex",borderRadius:9,overflow:"hidden",border:"1px solid rgba(0,0,0,0.08)",marginBottom:20,background:"#fff"}},
        tabBtn("processo","📋 Processo"),
        tabBtn("documentos","📁 Documentos"),
        tabBtn("alertas","⚠️ Dicas")
      ),

      tab==="processo"&&h("div",null,
        card(
          h("div",null,
            h("h2",{style:{fontSize:16,fontWeight:700,color:"#111827",marginBottom:6,fontFamily:"'Inter',system-ui,sans-serif"}},"Da preparação à escritura"),
            h("p",{style:{fontSize:13,color:"#4b5563",lineHeight:1.55,fontFamily:"'Inter',system-ui,sans-serif"}},"O processo de obtenção de crédito habitação em Portugal demora tipicamente ",h("strong",null,"2 a 4 meses")," desde o primeiro contacto com o banco até à escritura. Cada passo tem os seus requisitos e armadilhas — conhecê-los antecipadamente poupa tempo e dinheiro.")
          )
        ),
        card(h("div",null,PASSOS.map(passoCard)))
      ),

      tab==="documentos"&&h("div",null,
        card(
          h("div",null,
            h("h2",{style:{fontSize:16,fontWeight:700,color:"#111827",marginBottom:10,fontFamily:"'Inter',system-ui,sans-serif"}},"Checklist de Documentos"),
            h("p",{style:{fontSize:13,color:"#4b5563",marginBottom:14,fontFamily:"'Inter',system-ui,sans-serif"}},"Selecciona o teu tipo de vínculo laboral para ver a lista personalizada. Podes marcar os documentos já recolhidos."),
            h("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}},
              TIPOS_MUTUARIO.map(function(t){
                var active=tipo===t.id;
                return h("button",{
                  key:t.id,onClick:function(){setTipo(t.id);},
                  className:"btn-mini",
                  style:{padding:"6px 12px",border:"1px solid "+(active?Au:"rgba(0,0,0,0.12)"),borderRadius:20,background:active?"rgba(37,99,235,0.1)":"#fff",color:active?Au:"#374151",fontSize:12,fontFamily:"'Inter',system-ui,sans-serif",cursor:"pointer",fontWeight:active?700:500}
                },t.label);
              })
            ),
            totalChecked>0&&h("div",{style:{fontSize:12,color:G,marginTop:6,fontWeight:600}},"✓ "+totalChecked+" de "+totalDocs+" documentos marcados")
          )
        ),
        card(
          h("div",null,
            h("div",{style:{fontSize:12,fontWeight:700,color:"#374151",marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}},"Documentos Pessoais (Todos os Mutuários)"),
            DOCS_COMUNS.map(function(d){return docItem(d,"comum");}),
            h("div",{style:{fontSize:12,fontWeight:700,color:"#374151",margin:"16px 0 10px",textTransform:"uppercase",letterSpacing:0.5}},"Documentos de Rendimento — "+TIPOS_MUTUARIO.find(function(t){return t.id===tipo;}).label),
            (DOCS_POR_TIPO[tipo]||[]).map(function(d){return docItem(d,tipo);}),
            h("div",{style:{fontSize:12,fontWeight:700,color:"#374151",margin:"16px 0 10px",textTransform:"uppercase",letterSpacing:0.5}},"Documentos do Imóvel"),
            DOCS_IMOVEL.map(function(d){return docItem(d,"imovel");}),
            h("div",{style:{marginTop:14,padding:"10px 12px",background:"rgba(37,99,235,0.05)",borderRadius:8,fontSize:12,color:"#374151",fontFamily:"'Inter',system-ui,sans-serif"}},"📌 Os requisitos variam ligeiramente por banco. Confirma sempre com o gestor de crédito antes de submeter o processo.")
          )
        )
      ),

      tab==="alertas"&&h("div",null,
        card(
          h("div",null,
            h("h2",{style:{fontSize:16,fontWeight:700,color:"#111827",marginBottom:14,fontFamily:"'Inter',system-ui,sans-serif"}},"Dicas e Pontos de Atenção"),
            ALERTAS.map(function(a,i){
              return h("div",{key:i,style:{display:"flex",gap:12,alignItems:"flex-start",padding:"12px 0",borderBottom:i<ALERTAS.length-1?"1px solid rgba(0,0,0,0.05)":"none"}},
                h("span",{style:{fontSize:22,flexShrink:0,lineHeight:1.2}},a.icone),
                h("span",{style:{fontSize:13,color:"#374151",lineHeight:1.6,fontFamily:"'Inter',system-ui,sans-serif"}},a.texto)
              );
            }),
            h("div",{style:{marginTop:16,padding:"12px 14px",background:"rgba(37,99,235,0.06)",borderRadius:9,border:"1px solid rgba(37,99,235,0.15)"}},
              h("p",{style:{fontSize:13,color:Au,fontWeight:600,marginBottom:4,fontFamily:"'Inter',system-ui,sans-serif"}},"💡 Antes de te comprometeres"),
              h("p",{style:{fontSize:12,color:"#374151",lineHeight:1.55,fontFamily:"'Inter',system-ui,sans-serif"}},"Usa o simulador para comparar as prestações, TAEG e MTIC de 13 bancos — ",
                h("a",{href:"/",style:{color:Au,fontWeight:600,textDecoration:"none"}},"abrir simulador →")
              )
            )
          )
        ),
        card(
          h("div",null,
            h("h3",{style:{fontSize:14,fontWeight:700,color:"#111827",marginBottom:12,fontFamily:"'Inter',system-ui,sans-serif"}},"Custos de Entrada Típicos"),
            h("p",{style:{fontSize:12,color:"#4b5563",marginBottom:12,fontFamily:"'Inter',system-ui,sans-serif"}},"Para uma casa de €250.000 de 1ª habitação:"),
            [
              ["IMT","Imposto Municipal sobre Transmissões","~0% a 8% (progressivo)","Pago na AT antes da escritura"],
              ["IS Compra","Imposto de Selo sobre aquisição","0,8% do valor","Pago na AT antes da escritura"],
              ["IS Crédito","Imposto de Selo sobre o capital","0,6% do capital","Incluído na escritura"],
              ["Avaliação","Perito do banco","€150–€300","Pago ao banco"],
              ["Dossier","Comissão de abertura de processo","€0–€500","Variável por banco"],
              ["Escritura","Notário + registos","€700–€1.500","Varia com o valor"],
            ].map(function(r,i){
              return h("div",{key:i,style:{display:"flex",gap:8,padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.04)",flexWrap:"wrap"}},
                h("span",{style:{minWidth:90,fontSize:12,fontWeight:700,color:Au,fontFamily:"monospace"}},"["+r[0]+"]"),
                h("div",{style:{flex:1,minWidth:140}},
                  h("div",{style:{fontSize:12,color:"#111827",fontWeight:600,fontFamily:"'Inter',system-ui,sans-serif"}},r[1]),
                  h("div",{style:{fontSize:11,color:"#6b7280",fontFamily:"'Inter',system-ui,sans-serif"}},r[3])
                ),
                h("span",{style:{fontSize:12,color:"#374151",fontWeight:600,fontFamily:"monospace",whiteSpace:"nowrap"}},r[2])
              );
            }),
            h("div",{style:{marginTop:12,padding:"8px 12px",background:"rgba(22,163,74,0.07)",borderRadius:7,fontSize:12,color:"#166534",fontFamily:"'Inter',system-ui,sans-serif"}},"✓ Jovens ≤35 anos: isenção de IMT até €316.772 de VPT (1ª habitação). Consulta o simulador para o cálculo exacto.")
          )
        )
      )
    ),
    window.PageFooter&&h(window.PageFooter,null),
    window.CookieBanner&&h(window.CookieBanner,null)
  );
}

window.ProcessoPage=ProcessoPage;
})();
