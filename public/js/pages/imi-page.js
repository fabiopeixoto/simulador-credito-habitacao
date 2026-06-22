;(function(){
'use strict';
if(!window.React||!window._SIM)return;
var React=window.React;
var h=React.createElement;
var useState=React.useState;
var Au=window._SIM.Au;
var Sky=window._SIM.Sky;
var G=window._SIM.G;
var R=window._SIM.R;

var MUNICIPIOS=[
  {label:"Lisboa",taxa:0.003},
  {label:"Porto",taxa:0.003},
  {label:"Coimbra",taxa:0.0034},
  {label:"Braga",taxa:0.003},
  {label:"Cascais",taxa:0.003},
  {label:"Sintra",taxa:0.003},
  {label:"Almada",taxa:0.003},
  {label:"Setúbal",taxa:0.003},
  {label:"Loures",taxa:0.003},
  {label:"Amadora",taxa:0.003},
  {label:"Vila Nova de Gaia",taxa:0.003},
  {label:"Matosinhos",taxa:0.003},
  {label:"Guimarães",taxa:0.003},
  {label:"Faro",taxa:0.003},
  {label:"Funchal",taxa:0.003},
  {label:"Ponta Delgada",taxa:0.003},
  {label:"Outro município",taxa:null},
];

var IAS_2025=522.50;
var LIMIAR_ISENCAO_PERMANENTE_VPT=66500;
var LIMIAR_ISENCAO_PERMANENTE_REND=IAS_2025*14*2.3;

function calcIMI(vpt, tipo, finalidade, taxaMunicipal, rendimento, nDep, anosPosse){
  var taxa=tipo==="rustico"?0.008:taxaMunicipal;
  var imiBase=vpt*taxa;

  if(tipo==="rustico"||finalidade!=="hpp"){
    return {imi:imiBase,isencao:"nenhuma",duracao:0,motivo:""};
  }

  // Isenção permanente (Art. 48 EBF): VPT ≤ €66.500 e rendimento baixo
  if(vpt<=LIMIAR_ISENCAO_PERMANENTE_VPT&&rendimento<=LIMIAR_ISENCAO_PERMANENTE_REND){
    return {imi:0,isencao:"permanente",duracao:0,motivo:"VPT ≤ "+fE(LIMIAR_ISENCAO_PERMANENTE_VPT)+" e rendimento ≤ "+fE(Math.round(LIMIAR_ISENCAO_PERMANENTE_REND))};
  }

  // Isenção temporária (Art. 46 EBF): HPP, VPT ≤ €125.000
  if(vpt<=125000){
    var dur=nDep>=3?6:3;
    if(anosPosse<=dur){
      return {imi:0,isencao:"temporaria",duracao:dur,motivo:"VPT ≤ €125.000 · Isenção por "+dur+" anos"+(nDep>=3?" (≥3 dependentes)":"")};
    }
    return {imi:imiBase,isencao:"expirada",duracao:dur,motivo:"Isenção temporária expirou (durou "+dur+" anos)"};
  }

  // VPT 125k–250k: isenção temporária reduzida (só para VPT até €250k, sem dependentes específicos)
  if(vpt<=250000){
    var dur2=nDep>=3?6:3;
    if(anosPosse<=dur2){
      return {imi:0,isencao:"temporaria",duracao:dur2,motivo:"VPT ≤ €250.000 · Isenção por "+dur2+" anos"+(nDep>=3?" (≥3 dependentes)":"")};
    }
    return {imi:imiBase,isencao:"expirada",duracao:dur2,motivo:"Isenção temporária expirou (durou "+dur2+" anos)"};
  }

  return {imi:imiBase,isencao:"nenhuma",duracao:0,motivo:""};
}

function fE(v){return isFinite(v)?Math.round(v).toLocaleString("pt-PT",{style:"currency",currency:"EUR",maximumFractionDigits:0}):"—";}
function fE2(v){return isFinite(v)?v.toLocaleString("pt-PT",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}):"—";}
function fP(v){return isFinite(v)?(v*100).toFixed(2).replace(".",",")+"%":"—";}

function SliderRow(props){
  var label=props.label;var min=props.min;var max=props.max;var step=props.step||1;
  var val=props.val;var set=props.set;var fmt=props.fmt||function(v){return v;};
  return h("div",{style:{marginBottom:14}},
    h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}},
      h("label",{style:{fontSize:12,color:"#374151",fontWeight:600,fontFamily:"'Inter',system-ui,sans-serif"}},label),
      h("span",{style:{fontSize:14,color:Au,fontWeight:700,fontFamily:"monospace"}},fmt(val))
    ),
    h("input",{
      type:"range",min:min,max:max,step:step,value:val,
      onChange:function(e){set(Number(e.target.value));},
      style:{width:"100%",accentColor:Au}
    })
  );
}

function IMIPage(props){
  var EUR=props.EUR||{};
  var commentCount=props.commentCount||0;
  var onOpenComments=props.onOpenComments||function(){};
  var onOpenGlossario=props.onOpenGlossario||null;
  var onOpenProcesso=props.onOpenProcesso||null;

  var _vpt=useState(180000);var vpt=_vpt[0];var setVpt=_vpt[1];
  var _tipo=useState("urbano");var tipo=_tipo[0];var setTipo=_tipo[1];
  var _fin=useState("hpp");var fin=_fin[0];var setFin=_fin[1];
  var _mun=useState(0);var munIdx=_mun[0];var setMunIdx=_mun[1];
  var _taxaManual=useState(0.003);var taxaManual=_taxaManual[0];var setTaxaManual=_taxaManual[1];
  var _rend=useState(25000);var rend=_rend[0];var setRend=_rend[1];
  var _ndep=useState(0);var nDep=_ndep[0];var setNDep=_ndep[1];
  var _anos=useState(1);var anosPosse=_anos[0];var setAnosPosse=_anos[1];

  var munSel=MUNICIPIOS[munIdx];
  var taxaEfetiva=tipo==="rustico"?0.008:(munSel.taxa!==null?munSel.taxa:taxaManual);
  var res=calcIMI(vpt,tipo,fin,taxaEfetiva,rend,nDep,anosPosse);

  var isMobile=typeof window!=='undefined'&&window.innerWidth<640;

  function card(children,extra){
    return h("div",{style:Object.assign({background:"#fff",borderRadius:11,padding:"18px 20px",marginBottom:14},extra||{})},children);
  }

  function selectBtn(val,cur,set,label){
    var active=cur===val;
    return h("button",{
      onClick:function(){set(val);},
      className:"btn-mini",
      style:{flex:1,padding:"7px 6px",border:"1px solid "+(active?Au:"rgba(0,0,0,0.12)"),borderRadius:7,background:active?"rgba(37,99,235,0.1)":"#fff",color:active?Au:"#374151",fontSize:12,fontFamily:"'Inter',system-ui,sans-serif",cursor:"pointer",fontWeight:active?700:500,transition:"all 0.15s"}
    },label);
  }

  var imiAnual=res.imi;
  var imiMensal=imiAnual/12;
  var imiSemIsencao=vpt*taxaEfetiva;

  var isencaoLabel={
    "permanente":"Isenção Permanente",
    "temporaria":"Isenção Temporária",
    "expirada":"Isenção Expirada",
    "nenhuma":"Sem Isenção"
  }[res.isencao];

  var isencaoCor={
    "permanente":G,
    "temporaria":Sky,
    "expirada":"#d97706",
    "nenhuma":"#374151"
  }[res.isencao];

  var isencaoBg={
    "permanente":"rgba(22,163,74,0.08)",
    "temporaria":"rgba(2,132,199,0.08)",
    "expirada":"rgba(217,119,6,0.08)",
    "nenhuma":"rgba(55,65,81,0.06)"
  }[res.isencao];

  return h(React.Fragment,null,
    h(window.PageHeader,{
      EUR:EUR,activePage:"imi",
      commentCount:commentCount,onOpenComments:onOpenComments,
      onOpenGlossario:onOpenGlossario,
      onOpenProcesso:onOpenProcesso,
      subtitle:"Calcula o IMI anual do teu imóvel com isenções actualizadas 2025"
    }),
    window.NoticeBanner&&h(window.NoticeBanner,null),
    h("div",{style:{maxWidth:860,margin:"0 auto",padding:isMobile?"12px 10px 40px":"20px 16px 60px"}},
      h("div",{style:{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}},

        // Painel de inputs
        h("div",{style:{flex:"1 1 320px",minWidth:0}},
          card(
            h("div",null,
              h("h2",{style:{fontSize:15,fontWeight:700,color:"#111827",marginBottom:14,fontFamily:"'Inter',system-ui,sans-serif"}},"Dados do Imóvel"),
              h("div",{style:{marginBottom:14}},
                h("label",{style:{fontSize:12,color:"#374151",fontWeight:600,fontFamily:"'Inter',system-ui,sans-serif",display:"block",marginBottom:6}},"Tipo de imóvel"),
                h("div",{style:{display:"flex",gap:6}},
                  selectBtn("urbano",tipo,setTipo,"🏠 Urbano"),
                  selectBtn("rustico",tipo,setTipo,"🌳 Rústico")
                )
              ),
              h(SliderRow,{
                label:"Valor Patrimonial Tributário (VPT)",
                min:20000,max:1000000,step:1000,val:vpt,set:setVpt,
                fmt:fE
              }),
              h("div",{style:{marginBottom:14,padding:"8px 12px",background:"rgba(37,99,235,0.04)",borderRadius:7,fontSize:11,color:"#374151",fontFamily:"'Inter',system-ui,sans-serif"}},"O VPT consta na caderneta predial urbana ou no Portal das Finanças (AT). Pode ser diferente do valor de mercado."),
              tipo==="urbano"&&h("div",{style:{marginBottom:14}},
                h("label",{style:{fontSize:12,color:"#374151",fontWeight:600,fontFamily:"'Inter',system-ui,sans-serif",display:"block",marginBottom:6}},"Finalidade"),
                h("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                  selectBtn("hpp",fin,setFin,"1ª Habitação"),
                  selectBtn("2hab",fin,setFin,"2ª Habitação"),
                  selectBtn("arrendamento",fin,setFin,"Arrendamento")
                )
              ),
              tipo==="urbano"&&h("div",{style:{marginBottom:14}},
                h("label",{style:{fontSize:12,color:"#374151",fontWeight:600,fontFamily:"'Inter',system-ui,sans-serif",display:"block",marginBottom:6}},"Município"),
                h("select",{
                  value:munIdx,
                  onChange:function(e){setMunIdx(Number(e.target.value));},
                  style:{width:"100%",padding:"8px 10px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:7,fontSize:13,fontFamily:"'Inter',system-ui,sans-serif",background:"#fff",color:"#111827"}
                },
                  MUNICIPIOS.map(function(m,i){return h("option",{key:i,value:i},m.label+(m.taxa!==null?" ("+fP(m.taxa)+")":""));})
                )
              ),
              tipo==="urbano"&&munSel.taxa===null&&h("div",{style:{marginBottom:14}},
                h(SliderRow,{
                  label:"Taxa municipal (0,30% – 0,45%)",
                  min:0.003,max:0.0045,step:0.0001,val:taxaManual,set:setTaxaManual,
                  fmt:fP
                })
              )
            )
          ),
          fin==="hpp"&&tipo==="urbano"&&card(
            h("div",null,
              h("h2",{style:{fontSize:15,fontWeight:700,color:"#111827",marginBottom:14,fontFamily:"'Inter',system-ui,sans-serif"}},"Dados para Isenção"),
              h(SliderRow,{
                label:"Anos de posse do imóvel",
                min:0,max:10,step:1,val:anosPosse,set:setAnosPosse,
                fmt:function(v){return v===0?"Recém adquirido":v+" ano"+(v===1?"":"s");}
              }),
              h(SliderRow,{
                label:"Dependentes no agregado familiar",
                min:0,max:5,step:1,val:nDep,set:setNDep,
                fmt:function(v){return v+" dependente"+(v===1?"":"s");}
              }),
              h(SliderRow,{
                label:"Rendimento bruto anual do agregado (€)",
                min:5000,max:80000,step:500,val:rend,set:setRend,
                fmt:fE
              }),
              h("div",{style:{padding:"8px 12px",background:"rgba(37,99,235,0.04)",borderRadius:7,fontSize:11,color:"#374151",fontFamily:"'Inter',system-ui,sans-serif"}},"O rendimento é usado para verificar a isenção permanente (Art. 48 EBF). Limiar 2025: "+fE(Math.round(LIMIAR_ISENCAO_PERMANENTE_REND))+".")
            )
          )
        ),

        // Painel de resultados
        h("div",{style:{flex:"1 1 300px",minWidth:0}},
          card(
            h("div",null,
              h("h2",{style:{fontSize:15,fontWeight:700,color:"#111827",marginBottom:16,fontFamily:"'Inter',system-ui,sans-serif"}},"Resultado"),
              h("div",{style:{textAlign:"center",padding:"20px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",marginBottom:14}},
                h("div",{style:{fontSize:11,color:"#374151",fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8,fontFamily:"'Inter',system-ui,sans-serif"}},"IMI Anual"),
                h("div",{style:{fontSize:42,fontWeight:800,color:imiAnual===0?G:Au,fontFamily:"'Inter',system-ui,sans-serif",letterSpacing:-1}},
                  imiAnual===0?"€ 0":fE(imiAnual)
                ),
                h("div",{style:{fontSize:13,color:"#4b5563",marginTop:4,fontFamily:"'Inter',system-ui,sans-serif"}},
                  imiAnual===0?"Isento neste momento":"≈ "+fE2(imiMensal)+"/mês"
                )
              ),
              h("div",{style:{padding:"10px 14px",borderRadius:8,background:isencaoBg,border:"1px solid "+isencaoCor+"33",marginBottom:12}},
                h("div",{style:{fontSize:12,fontWeight:700,color:isencaoCor,marginBottom:2,fontFamily:"'Inter',system-ui,sans-serif"}},isencaoLabel),
                res.motivo&&h("div",{style:{fontSize:12,color:"#374151",fontFamily:"'Inter',system-ui,sans-serif"}},res.motivo),
                res.isencao==="temporaria"&&h("div",{style:{fontSize:12,color:"#374151",marginTop:4,fontFamily:"'Inter',system-ui,sans-serif"}},
                  "Fim da isenção: ano "+(Number(anosPosse)+Number(res.duracao-anosPosse)+1)+" de posse. IMI a pagar após isenção: ",
                  h("strong",null,fE(imiSemIsencao)+"/ano")
                )
              ),
              h("div",{style:{display:"flex",flexDirection:"column",gap:6}},
                [
                  ["VPT",fE(vpt),"#374151"],
                  ["Taxa municipal",tipo==="rustico"?"0,80% (rústico)":fP(taxaEfetiva),Au],
                  ["IMI sem isenção",fE(imiSemIsencao),"#374151"],
                  ["Poupança com isenção",imiAnual===0?fE(imiSemIsencao):fE(imiSemIsencao-imiAnual),G],
                ].map(function(r,i){
                  return h("div",{key:i,style:{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(0,0,0,0.04)"}},
                    h("span",{style:{fontSize:12,color:"#374151",fontFamily:"'Inter',system-ui,sans-serif"}},r[0]),
                    h("span",{style:{fontSize:12,fontWeight:700,color:r[2],fontFamily:"monospace"}},r[1])
                  );
                })
              )
            )
          ),
          card(
            h("div",null,
              h("h3",{style:{fontSize:13,fontWeight:700,color:"#111827",marginBottom:10,fontFamily:"'Inter',system-ui,sans-serif"}},"Isenções disponíveis para 1ª habitação"),
              [
                {titulo:"Isenção temporária (Art. 46 EBF)",desc:"VPT ≤ €125.000 · Duração: 3 anos (6 se ≥3 dependentes) · Requer registo de residência fiscal no imóvel",cor:Sky},
                {titulo:"Isenção temporária VPT ≤ €250.000 (Art. 46 EBF)",desc:"VPT entre €125.000 e €250.000 · Duração: 3 anos (6 se ≥3 dependentes)",cor:Sky},
                {titulo:"Isenção permanente (Art. 48 EBF)",desc:"VPT ≤ "+fE(LIMIAR_ISENCAO_PERMANENTE_VPT)+" e rendimento do agregado ≤ "+fE(Math.round(LIMIAR_ISENCAO_PERMANENTE_REND))+" · Soma de todos os imóveis urbanos habitacionais",cor:G},
                {titulo:"Jovens ≤35 anos — IMT (compra)",desc:"Isenção de IMT na compra (não no IMI anual) para VPT ≤ €316.772. O IMI anual segue as regras normais.",cor:"#7c3aed"},
              ].map(function(item,i){
                return h("div",{key:i,style:{padding:"9px 0",borderBottom:i<3?"1px solid rgba(0,0,0,0.05)":"none"}},
                  h("div",{style:{fontSize:12,fontWeight:700,color:item.cor,marginBottom:2,fontFamily:"'Inter',system-ui,sans-serif"}},item.titulo),
                  h("div",{style:{fontSize:11,color:"#4b5563",lineHeight:1.5,fontFamily:"'Inter',system-ui,sans-serif"}},item.desc)
                );
              }),
              h("div",{style:{marginTop:10,padding:"8px 10px",background:"rgba(37,99,235,0.04)",borderRadius:7,fontSize:11,color:"#374151",fontFamily:"'Inter',system-ui,sans-serif"}},"⚠️ Valores e limiares de 2025. Taxas municipais podem variar anualmente — consulta o Portal das Finanças para o teu município específico.")
            )
          )
        )
      )
    ),
    window.PageFooter&&h(window.PageFooter,null),
    window.CookieBanner&&h(window.CookieBanner,null)
  );
}

window.IMIPage=IMIPage;
})();
