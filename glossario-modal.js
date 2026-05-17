;(function(){
  'use strict';
  if(!window.React||!window._SIM)return;
  var React=window.React,h=React.createElement,useState=React.useState;
  var Au=window._SIM.Au;

  var TERMOS=[
    {t:"TAN",         d:"Taxa Anual Nominal. Taxa de juro base do crédito. Para taxa variável: TAN = Euribor + Spread."},
    {t:"TAEG",        d:"Taxa Anual Efetiva Global. Inclui TAN + comissões + seguros obrigatórios. Permite comparar o custo real entre propostas de diferentes bancos."},
    {t:"MTIC",        d:"Montante Total Imputado ao Consumidor. Soma de todas as prestações ao longo do prazo, revelando o custo total do crédito."},
    {t:"DSTI",        d:"Debt Service-to-Income. Rácio entre encargos mensais com créditos e o rendimento líquido. Banco de Portugal limita a 50% em geral."},
    {t:"LTV",         d:"Loan-to-Value. Percentagem do valor do imóvel financiada pelo banco. Ex: LTV 80% = banco financia 80%, cliente entra com 20%."},
    {t:"Euribor",     d:"Euro Interbank Offered Rate. Taxa de referência interbancária europeia (BCE). Usada como indexante nos créditos variáveis e mistos."},
    {t:"Spread",      d:"Margem do banco sobre a Euribor. TAN = Euribor + Spread. Pode ser mais baixo se o cliente contratar produtos associados (seguro, domiciliação)."},
    {t:"FINE",        d:"Ficha de Informação Normalizada Europeia. Documento pré-contratual obrigatório com todos os detalhes da proposta do banco. Deve ser analisada antes de contratar."},
    {t:"Carência",    d:"Período inicial em que o cliente paga apenas juros, sem amortizar capital. Reduz a prestação no início mas aumenta o custo total do crédito."},
    {t:"Indexante",   d:"Taxa de referência à qual o spread é somado para calcular a TAN. Em Portugal, habitualmente Euribor 3m, 6m ou 12m."},
    {t:"Prestação",   d:"Valor mensal pago ao banco. Composta por amortização de capital e juros. Diminui o capital em dívida ao longo do tempo."},
    {t:"Amortização", d:"Parte da prestação que reduz o capital em dívida. No início do crédito é menor (mais juros); cresce ao longo do tempo."},
    {t:"BdP",         d:"Banco de Portugal. Entidade reguladora do sistema financeiro português. Publica recomendações sobre rácios máximos de DSTI e LTV."},
    {t:"BCE",         d:"Banco Central Europeu. Define a política monetária da zona euro e influencia diretamente as taxas Euribor."},
    {t:"IS",          d:"Imposto de Selo. Taxa aplicada sobre o valor do crédito e sobre os juros. Para HPP é isento sobre o capital (art. 7.º CIS)."},
    {t:"Taxa Fixa",   d:"A TAN mantém-se constante durante todo o prazo. Protege de subidas de Euribor, mas a taxa inicial é geralmente mais elevada. Penalização de reembolso antecipado: 2%."},
    {t:"Taxa Variável",d:"A TAN varia com a Euribor na revisão periódica (3m, 6m ou 12m). A prestação sobe ou desce conforme o mercado. Penalização de reembolso antecipado: 0,5%."},
    {t:"Taxa Mista",  d:"Período inicial a taxa fixa (geralmente 2–10 anos), seguido de período variável indexado à Euribor. Penalização de reembolso antecipado: 2%."},
    {t:"Ponto de Equilíbrio",d:"Número de meses necessários para que a poupança mensal com a nova taxa compense os custos de transferência do crédito (penalização + comissões)."},
    {t:"Domiciliação",d:"Transferência do salário/ordenado para o banco credor como condição contratual. Muitos bancos oferecem spread mais baixo em troca desta condição."},
    {t:"Dossier",     d:"Comissão cobrada pelo banco para análise e instrução do processo de crédito. Geralmente entre €300 e €700."},
    {t:"Avaliação",   d:"Peritagem obrigatória ao imóvel para determinar o seu valor de mercado. Custo tipicamente entre €200 e €300."},
    {t:"Minutas",     d:"Encargos notariais e de registo do contrato de crédito e hipoteca. Habitualmente entre €400 e €700."},
    {t:"Penalização Antecipada",d:"Custo por reembolso antecipado parcial ou total. Taxa variável ou mista em período variável: 0,5% do capital reembolsado. Taxa fixa ou mista em período fixo: 2%."},
    {t:"Capital em Dívida",d:"Montante de capital ainda por pagar ao banco num determinado momento do crédito. Diminui a cada prestação paga."},
    {t:"HPP",         d:"Habitação Própria Permanente. Imóvel destinado a residência principal do proprietário. LTV máximo de 90% recomendado pelo BdP."},
  ];

  function GlossarioModal(props){
    var onClose=props.onClose||function(){};
    var _q=useState("");
    var q=_q[0]; var setQ=_q[1];
    var filtered=q.trim()?TERMOS.filter(function(x){
      var s=q.toLowerCase();
      return x.t.toLowerCase().indexOf(s)>=0||x.d.toLowerCase().indexOf(s)>=0;
    }):TERMOS;

    return h("div",{
      onClick:function(e){if(e.target===e.currentTarget)onClose();},
      style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}
    },
      h("div",{style:{background:"#fff",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",width:"100%",maxWidth:560,maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden"}},
        h("div",{style:{padding:"16px 20px 12px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}},
          h("div",null,
            h("div",{style:{fontSize:11,letterSpacing:3,color:Au,fontFamily:"monospace",marginBottom:2}},"GLOSSÁRIO"),
            h("div",{style:{fontSize:13,color:"#6b7280",fontFamily:"sans-serif"}},"Termos e siglas técnicas do simulador")
          ),
          h("button",{onClick:onClose,style:{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#6b7280",padding:"4px 8px",borderRadius:6,lineHeight:1}},"×")
        ),
        h("div",{style:{padding:"10px 20px",borderBottom:"1px solid rgba(0,0,0,0.06)",flexShrink:0}},
          h("input",{type:"text",placeholder:"Pesquisar termo…",value:q,
            onChange:function(e){setQ(e.target.value);},
            style:{width:"100%",padding:"8px 12px",borderRadius:7,border:"1px solid rgba(0,0,0,0.15)",fontSize:13,fontFamily:"sans-serif",outline:"none",boxSizing:"border-box"}
          })
        ),
        h("div",{style:{overflowY:"auto",padding:"8px 20px 16px",flex:1}},
          filtered.length===0?
            h("div",{style:{padding:"24px 0",textAlign:"center",color:"#9ca3af",fontSize:13}},"Nenhum termo encontrado"):
          filtered.map(function(x){
            return h("div",{key:x.t,style:{padding:"10px 0",borderBottom:"1px solid rgba(0,0,0,0.05)"}},
              h("div",{style:{fontWeight:700,fontSize:13,color:Au,fontFamily:"monospace",marginBottom:3}},x.t),
              h("div",{style:{fontSize:13,color:"#374151",fontFamily:"sans-serif",lineHeight:1.5}},x.d)
            );
          })
        )
      )
    );
  }

  window.GlossarioModal=GlossarioModal;
})();
