;(function(){
'use strict';
if(!window.React||!window._SIM)return;
var React=window.React;
var h=React.createElement;
var useState=React.useState;
var useEffect=React.useEffect;
var useRef=React.useRef;
var Au=window._SIM.Au;
var Sky=window._SIM.Sky;
var G=window._SIM.G;
var R=window._SIM.R;

// Todos os 308 municípios portugueses — taxas IMI 2026 (prédios urbanos habitacionais)
// Fonte: deliberações camarárias 2025/2026 publicadas no DR. 0,30% é o mínimo legal.
// Municípios sem deliberação conhecida acima do mínimo usam 0,30%. Verificar em portaldasfinancas.gov.pt.
var MUNICIPIOS=[
  {label:"Abrantes",taxa:0.003},
  {label:"Aguiar da Beira",taxa:0.003},
  {label:"Alandroal",taxa:0.003},
  {label:"Albergaria-a-Velha",taxa:0.003},
  {label:"Albufeira",taxa:0.003},
  {label:"Alcanena",taxa:0.003},
  {label:"Alcácer do Sal",taxa:0.003},
  {label:"Alcochete",taxa:0.003},
  {label:"Alcobaça",taxa:0.003},
  {label:"Alenquer",taxa:0.003},
  {label:"Alfândega da Fé",taxa:0.003},
  {label:"Aljezur",taxa:0.003},
  {label:"Aljustrel",taxa:0.003},
  {label:"Almada",taxa:0.0035},
  {label:"Almeida",taxa:0.003},
  {label:"Almeirim",taxa:0.003},
  {label:"Almodôvar",taxa:0.003},
  {label:"Alpiarça",taxa:0.003},
  {label:"Alter do Chão",taxa:0.003},
  {label:"Alvaiázere",taxa:0.003},
  {label:"Alvito",taxa:0.003},
  {label:"Amadora",taxa:0.003},
  {label:"Amarante",taxa:0.003},
  {label:"Amares",taxa:0.003},
  {label:"Anadia",taxa:0.003},
  {label:"Angra do Heroísmo",taxa:0.003},
  {label:"Ansião",taxa:0.003},
  {label:"Arcos de Valdevez",taxa:0.003},
  {label:"Arganil",taxa:0.003},
  {label:"Armamar",taxa:0.003},
  {label:"Arraiolos",taxa:0.003},
  {label:"Arronches",taxa:0.003},
  {label:"Arruda dos Vinhos",taxa:0.003},
  {label:"Avis",taxa:0.003},
  {label:"Aveiro",taxa:0.003},
  {label:"Azambuja",taxa:0.003},
  {label:"Baião",taxa:0.003},
  {label:"Barcelos",taxa:0.003},
  {label:"Barrancos",taxa:0.003},
  {label:"Barreiro",taxa:0.003},
  {label:"Batalha",taxa:0.003},
  {label:"Beja",taxa:0.003},
  {label:"Belmonte",taxa:0.003},
  {label:"Benavente",taxa:0.003},
  {label:"Bombarral",taxa:0.003},
  {label:"Borba",taxa:0.003},
  {label:"Boticas",taxa:0.003},
  {label:"Braga",taxa:0.0032},
  {label:"Bragança",taxa:0.003},
  {label:"Cabeceiras de Basto",taxa:0.003},
  {label:"Cadaval",taxa:0.003},
  {label:"Caldas da Rainha",taxa:0.003},
  {label:"Calheta (Açores)",taxa:0.003},
  {label:"Calheta (Madeira)",taxa:0.003},
  {label:"Câmara de Lobos",taxa:0.003},
  {label:"Caminha",taxa:0.003},
  {label:"Campo Maior",taxa:0.003},
  {label:"Cantanhede",taxa:0.003},
  {label:"Carregal do Sal",taxa:0.003},
  {label:"Cartaxo",taxa:0.0045},
  {label:"Carrazeda de Ansiães",taxa:0.003},
  {label:"Cascais",taxa:0.0035},
  {label:"Castanheira de Pêra",taxa:0.003},
  {label:"Castelo Branco",taxa:0.003},
  {label:"Castelo de Paiva",taxa:0.003},
  {label:"Castelo de Vide",taxa:0.003},
  {label:"Castro Daire",taxa:0.003},
  {label:"Castro Marim",taxa:0.003},
  {label:"Castro Verde",taxa:0.003},
  {label:"Celorico da Beira",taxa:0.0035},
  {label:"Celorico de Basto",taxa:0.003},
  {label:"Chamusca",taxa:0.003},
  {label:"Chaves",taxa:0.003},
  {label:"Cinfães",taxa:0.003},
  {label:"Coimbra",taxa:0.003},
  {label:"Condeixa-a-Nova",taxa:0.003},
  {label:"Constância",taxa:0.003},
  {label:"Corvo",taxa:0.003},
  {label:"Coruche",taxa:0.003},
  {label:"Covilhã",taxa:0.003},
  {label:"Crato",taxa:0.003},
  {label:"Cuba",taxa:0.003},
  {label:"Elvas",taxa:0.0035},
  {label:"Entroncamento",taxa:0.003},
  {label:"Esposende",taxa:0.003},
  {label:"Espinho",taxa:0.003},
  {label:"Estarreja",taxa:0.003},
  {label:"Estremoz",taxa:0.003},
  {label:"Évora",taxa:0.003},
  {label:"Fafe",taxa:0.003},
  {label:"Faro",taxa:0.003},
  {label:"Felgueiras",taxa:0.003},
  {label:"Ferreira do Alentejo",taxa:0.003},
  {label:"Ferreira do Zêzere",taxa:0.003},
  {label:"Figueira da Foz",taxa:0.003},
  {label:"Figueira de Castelo Rodrigo",taxa:0.003},
  {label:"Figueiró dos Vinhos",taxa:0.003},
  {label:"Fornos de Algodres",taxa:0.003},
  {label:"Freixo de Espada à Cinta",taxa:0.003},
  {label:"Fronteira",taxa:0.003},
  {label:"Funchal",taxa:0.003},
  {label:"Fundão",taxa:0.003},
  {label:"Gavião",taxa:0.003},
  {label:"Golegã",taxa:0.003},
  {label:"Gondomar",taxa:0.003},
  {label:"Góis",taxa:0.003},
  {label:"Gouveia",taxa:0.003},
  {label:"Grândola",taxa:0.003},
  {label:"Guarda",taxa:0.003},
  {label:"Guimarães",taxa:0.003},
  {label:"Horta",taxa:0.003},
  {label:"Idanha-a-Nova",taxa:0.003},
  {label:"Ílhavo",taxa:0.003},
  {label:"Lagoa (Açores)",taxa:0.003},
  {label:"Lagoa (Faro)",taxa:0.003},
  {label:"Lagos",taxa:0.003},
  {label:"Lamego",taxa:0.003},
  {label:"Lajes das Flores",taxa:0.003},
  {label:"Lajes do Pico",taxa:0.003},
  {label:"Leiria",taxa:0.003},
  {label:"Lisboa",taxa:0.003},
  {label:"Loulé",taxa:0.003},
  {label:"Loures",taxa:0.00361},
  {label:"Lourinhã",taxa:0.003},
  {label:"Lousã",taxa:0.003},
  {label:"Lousada",taxa:0.003},
  {label:"Mação",taxa:0.003},
  {label:"Machico",taxa:0.003},
  {label:"Macedo de Cavaleiros",taxa:0.003},
  {label:"Madalena",taxa:0.003},
  {label:"Mafra",taxa:0.003},
  {label:"Maia",taxa:0.003},
  {label:"Mangualde",taxa:0.003},
  {label:"Manteigas",taxa:0.003},
  {label:"Marco de Canaveses",taxa:0.003},
  {label:"Marinha Grande",taxa:0.003},
  {label:"Marvão",taxa:0.003},
  {label:"Matosinhos",taxa:0.003},
  {label:"Mealhada",taxa:0.003},
  {label:"Melgaço",taxa:0.003},
  {label:"Mértola",taxa:0.003},
  {label:"Mesão Frio",taxa:0.003},
  {label:"Mêda",taxa:0.003},
  {label:"Mira",taxa:0.003},
  {label:"Miranda do Corvo",taxa:0.003},
  {label:"Miranda do Douro",taxa:0.003},
  {label:"Mirandela",taxa:0.003},
  {label:"Mogadouro",taxa:0.003},
  {label:"Moita",taxa:0.003},
  {label:"Moimenta da Beira",taxa:0.003},
  {label:"Monção",taxa:0.003},
  {label:"Monchique",taxa:0.003},
  {label:"Mondim de Basto",taxa:0.003},
  {label:"Monforte",taxa:0.003},
  {label:"Montalegre",taxa:0.003},
  {label:"Montemor-o-Novo",taxa:0.003},
  {label:"Montemor-o-Velho",taxa:0.003},
  {label:"Montijo",taxa:0.003},
  {label:"Mora",taxa:0.003},
  {label:"Mortágua",taxa:0.003},
  {label:"Moura",taxa:0.003},
  {label:"Mourão",taxa:0.003},
  {label:"Murça",taxa:0.003},
  {label:"Murtosa",taxa:0.003},
  {label:"Nazaré",taxa:0.0045},
  {label:"Nelas",taxa:0.003},
  {label:"Nisa",taxa:0.003},
  {label:"Nordeste",taxa:0.003},
  {label:"Óbidos",taxa:0.003},
  {label:"Odivelas",taxa:0.003},
  {label:"Odemira",taxa:0.003},
  {label:"Oeiras",taxa:0.0045},
  {label:"Oleiros",taxa:0.003},
  {label:"Olhão",taxa:0.003},
  {label:"Oliveira de Azeméis",taxa:0.003},
  {label:"Oliveira de Frades",taxa:0.003},
  {label:"Oliveira do Bairro",taxa:0.003},
  {label:"Oliveira do Hospital",taxa:0.003},
  {label:"Ourém",taxa:0.00325},
  {label:"Ourique",taxa:0.003},
  {label:"Ovar",taxa:0.003},
  {label:"Paços de Ferreira",taxa:0.003},
  {label:"Palmela",taxa:0.003},
  {label:"Pampilhosa da Serra",taxa:0.003},
  {label:"Paredes",taxa:0.003},
  {label:"Paredes de Coura",taxa:0.003},
  {label:"Pedrógão Grande",taxa:0.003},
  {label:"Penacova",taxa:0.003},
  {label:"Penafiel",taxa:0.003},
  {label:"Penalva do Castelo",taxa:0.003},
  {label:"Penamacor",taxa:0.003},
  {label:"Penedono",taxa:0.003},
  {label:"Penela",taxa:0.003},
  {label:"Peniche",taxa:0.003},
  {label:"Peso da Régua",taxa:0.003},
  {label:"Pinhel",taxa:0.003},
  {label:"Pombal",taxa:0.003},
  {label:"Ponta Delgada",taxa:0.003},
  {label:"Ponta do Sol",taxa:0.003},
  {label:"Ponte da Barca",taxa:0.003},
  {label:"Ponte de Lima",taxa:0.003},
  {label:"Ponte de Sor",taxa:0.003},
  {label:"Portalegre",taxa:0.003},
  {label:"Portimão",taxa:0.003},
  {label:"Porto",taxa:0.00324},
  {label:"Porto de Mós",taxa:0.003},
  {label:"Porto Moniz",taxa:0.003},
  {label:"Porto Santo",taxa:0.003},
  {label:"Póvoa de Lanhoso",taxa:0.0034},
  {label:"Póvoa de Varzim",taxa:0.003},
  {label:"Povoação",taxa:0.003},
  {label:"Praia da Vitória",taxa:0.003},
  {label:"Proença-a-Nova",taxa:0.003},
  {label:"Redondo",taxa:0.003},
  {label:"Reguengos de Monsaraz",taxa:0.003},
  {label:"Resende",taxa:0.003},
  {label:"Ribeira Brava",taxa:0.003},
  {label:"Ribeira de Pena",taxa:0.003},
  {label:"Ribeira Grande",taxa:0.003},
  {label:"Rio Maior",taxa:0.003},
  {label:"Sabugal",taxa:0.003},
  {label:"Sabrosa",taxa:0.003},
  {label:"Salvaterra de Magos",taxa:0.003},
  {label:"Santa Comba Dão",taxa:0.003},
  {label:"Santa Cruz (Madeira)",taxa:0.003},
  {label:"Santa Cruz da Graciosa",taxa:0.003},
  {label:"Santa Cruz das Flores",taxa:0.003},
  {label:"Santa Maria da Feira",taxa:0.003},
  {label:"Santa Marta de Penaguião",taxa:0.003},
  {label:"Santana (Madeira)",taxa:0.003},
  {label:"Santarém",taxa:0.003},
  {label:"Santiago do Cacém",taxa:0.003},
  {label:"Santo Tirso",taxa:0.003},
  {label:"São Brás de Alportel",taxa:0.003},
  {label:"São João da Madeira",taxa:0.003},
  {label:"São João da Pesqueira",taxa:0.003},
  {label:"São Pedro do Sul",taxa:0.003},
  {label:"São Roque do Pico",taxa:0.003},
  {label:"São Vicente (Madeira)",taxa:0.003},
  {label:"Sardoal",taxa:0.003},
  {label:"Sátão",taxa:0.003},
  {label:"Seia",taxa:0.003},
  {label:"Seixal",taxa:0.00325},
  {label:"Serpa",taxa:0.003},
  {label:"Sernancelhe",taxa:0.003},
  {label:"Sertã",taxa:0.003},
  {label:"Sesimbra",taxa:0.003},
  {label:"Setúbal",taxa:0.003},
  {label:"Sever do Vouga",taxa:0.003},
  {label:"Silves",taxa:0.003},
  {label:"Sines",taxa:0.003},
  {label:"Sintra",taxa:0.003},
  {label:"Sobral de Monte Agraço",taxa:0.003},
  {label:"Soure",taxa:0.003},
  {label:"Sousel",taxa:0.003},
  {label:"Tabuaço",taxa:0.003},
  {label:"Tábua",taxa:0.003},
  {label:"Tarouca",taxa:0.003},
  {label:"Tavira",taxa:0.003},
  {label:"Terras de Bouro",taxa:0.003},
  {label:"Tomar",taxa:0.003},
  {label:"Tondela",taxa:0.003},
  {label:"Torre de Moncorvo",taxa:0.003},
  {label:"Torres Novas",taxa:0.003},
  {label:"Torres Vedras",taxa:0.003},
  {label:"Trancoso",taxa:0.003},
  {label:"Trofa",taxa:0.003},
  {label:"Vagos",taxa:0.004},
  {label:"Vale de Cambra",taxa:0.003},
  {label:"Valença",taxa:0.003},
  {label:"Valongo",taxa:0.003},
  {label:"Valpaços",taxa:0.003},
  {label:"Velas",taxa:0.003},
  {label:"Vendas Novas",taxa:0.003},
  {label:"Viana do Alentejo",taxa:0.003},
  {label:"Viana do Castelo",taxa:0.003},
  {label:"Vidigueira",taxa:0.003},
  {label:"Vieira do Minho",taxa:0.003},
  {label:"Vila de Rei",taxa:0.003},
  {label:"Vila do Bispo",taxa:0.003},
  {label:"Vila do Conde",taxa:0.003},
  {label:"Vila do Porto",taxa:0.003},
  {label:"Vila Flor",taxa:0.003},
  {label:"Vila Franca de Xira",taxa:0.003},
  {label:"Vila Franca do Campo",taxa:0.003},
  {label:"Vila Nova da Barquinha",taxa:0.003},
  {label:"Vila Nova de Famalicão",taxa:0.003},
  {label:"Vila Nova de Foz Côa",taxa:0.003},
  {label:"Vila Nova de Gaia",taxa:0.003},
  {label:"Vila Nova de Paiva",taxa:0.003},
  {label:"Vila Nova de Poiares",taxa:0.0039},
  {label:"Vila Pouca de Aguiar",taxa:0.003},
  {label:"Vila Real",taxa:0.003},
  {label:"Vila Real de Santo António",taxa:0.0045},
  {label:"Vila Velha de Ródão",taxa:0.003},
  {label:"Vila Verde",taxa:0.003},
  {label:"Vimioso",taxa:0.003},
  {label:"Vinhais",taxa:0.003},
  {label:"Viseu",taxa:0.003},
  {label:"Vizela",taxa:0.003},
  {label:"Vouzela",taxa:0.003},
  {label:"Outro município (taxa manual)",taxa:null},
];

var MUN_DEFAULT=MUNICIPIOS.filter(function(m){return m.label==="Lisboa";})[0]||MUNICIPIOS[0];

var IAS_2026=537.13;
var LIMIAR_ISENCAO_PERMANENTE_VPT=IAS_2026*14*10; // 75.198,20€ — Art. 46/48 EBF: 10×14×IAS
var LIMIAR_ISENCAO_PERMANENTE_REND=IAS_2026*14*2.3;

function calcIMI(vpt, tipo, finalidade, taxaMunicipal, rendimento, nDep, anosPosse){
  var taxa=tipo==="rustico"?0.008:taxaMunicipal;
  var imiBase=vpt*taxa;

  if(tipo==="rustico"||finalidade!=="hpp"){
    return {imi:imiBase,isencao:"nenhuma",duracao:0,motivo:""};
  }

  if(vpt<=LIMIAR_ISENCAO_PERMANENTE_VPT&&rendimento<=LIMIAR_ISENCAO_PERMANENTE_REND){
    return {imi:0,isencao:"permanente",duracao:0,motivo:"VPT ≤ "+fE(LIMIAR_ISENCAO_PERMANENTE_VPT)+" e rendimento ≤ "+fE(Math.round(LIMIAR_ISENCAO_PERMANENTE_REND))};
  }

  if(vpt<=125000){
    var dur=nDep>=3?6:3;
    if(anosPosse<=dur){
      return {imi:0,isencao:"temporaria",duracao:dur,motivo:"VPT ≤ €125.000 · Isenção por "+dur+" anos"+(nDep>=3?" (≥3 dependentes)":"")};
    }
    return {imi:imiBase,isencao:"expirada",duracao:dur,motivo:"Isenção temporária expirou (durou "+dur+" anos)"};
  }

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
function fP(v){if(!isFinite(v))return"—";var s=(v*100).toFixed(3);if(s.endsWith("0"))s=s.slice(0,-1);return s.replace(".",",")+"%";}
function norm(s){return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");}

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

function MunicipioSearch(props){
  var municipios=props.municipios;
  var selected=props.selected;
  var onSelect=props.onSelect;
  var _open=useState(false);var open=_open[0];var setOpen=_open[1];
  var _q=useState("");var q=_q[0];var setQ=_q[1];
  var ref=useRef(null);

  useEffect(function(){
    if(!open)return;
    function handler(e){if(ref.current&&!ref.current.contains(e.target)){setOpen(false);setQ("");}}
    document.addEventListener("mousedown",handler);
    return function(){document.removeEventListener("mousedown",handler);};
  },[open]);

  var filtered=q.trim()
    ?municipios.filter(function(m){return norm(m.label).indexOf(norm(q))>=0;})
    :municipios;

  function pick(m){onSelect(m);setOpen(false);setQ("");}

  return h("div",{ref:ref,style:{position:"relative"}},
    h("button",{
      onClick:function(){setOpen(function(o){return !o;});},
      style:{width:"100%",padding:"8px 12px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:7,fontSize:13,fontFamily:"'Inter',system-ui,sans-serif",background:"#fff",color:"#111827",textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:0}
    },
      h("span",null,selected.label+(selected.taxa!==null?" ("+fP(selected.taxa)+")":"")),
      h("span",{style:{color:"#9ca3af",fontSize:10,marginLeft:8,flexShrink:0}},open?"▲":"▼")
    ),
    open&&h("div",{style:{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:300,background:"#fff",border:"1px solid rgba(0,0,0,0.15)",borderRadius:9,boxShadow:"0 8px 24px rgba(0,0,0,0.15)",overflow:"hidden"}},
      h("div",{style:{padding:"8px 8px 4px"}},
        h("input",{
          autoFocus:true,
          type:"text",
          placeholder:"Escreve para filtrar município…",
          value:q,
          onChange:function(e){setQ(e.target.value);},
          style:{width:"100%",padding:"7px 10px",border:"1px solid rgba(37,99,235,0.35)",borderRadius:6,fontSize:13,fontFamily:"'Inter',system-ui,sans-serif",outline:"none",boxSizing:"border-box",color:"#111827"}
        })
      ),
      h("div",{style:{maxHeight:240,overflowY:"auto",paddingBottom:4}},
        filtered.length===0
          ?h("div",{style:{padding:"14px 16px",fontSize:13,color:"#6b7280",textAlign:"center",fontFamily:"'Inter',system-ui,sans-serif"}},"Nenhum município encontrado")
          :filtered.map(function(m){
            var active=m.label===selected.label;
            return h("div",{
              key:m.label,
              onClick:function(){pick(m);},
              style:{
                padding:"8px 14px",cursor:"pointer",
                background:active?"rgba(37,99,235,0.08)":"transparent",
                display:"flex",justifyContent:"space-between",alignItems:"center",
                borderBottom:"1px solid rgba(0,0,0,0.04)"
              },
              onMouseEnter:function(e){if(!active)e.currentTarget.style.background="rgba(0,0,0,0.03)";},
              onMouseLeave:function(e){if(!active)e.currentTarget.style.background="transparent";}
            },
              h("span",{style:{fontSize:13,color:active?Au:"#111827",fontWeight:active?700:400,fontFamily:"'Inter',system-ui,sans-serif"}},m.label),
              m.taxa!==null&&h("span",{style:{fontSize:11,color:active?Au:"#9ca3af",fontFamily:"monospace",flexShrink:0,marginLeft:8}},fP(m.taxa))
            );
          })
      )
    )
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
  var _munSel=useState(MUN_DEFAULT);var munSel=_munSel[0];var setMunSel=_munSel[1];
  var _taxaManual=useState(0.003);var taxaManual=_taxaManual[0];var setTaxaManual=_taxaManual[1];
  var _rend=useState(25000);var rend=_rend[0];var setRend=_rend[1];
  var _ndep=useState(0);var nDep=_ndep[0];var setNDep=_ndep[1];
  var _anos=useState(1);var anosPosse=_anos[0];var setAnosPosse=_anos[1];

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
      subtitle:"Calcula o IMI anual do teu imóvel com isenções actualizadas 2026"
    }),
    window.NoticeBanner&&h(window.NoticeBanner,null),
    h("div",{style:{maxWidth:860,margin:"0 auto",padding:isMobile?"12px 10px 40px":"20px 16px 60px"}},
      h("div",{style:{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}},

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
                h(MunicipioSearch,{municipios:MUNICIPIOS,selected:munSel,onSelect:setMunSel})
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
              h("div",{style:{padding:"8px 12px",background:"rgba(37,99,235,0.04)",borderRadius:7,fontSize:11,color:"#374151",fontFamily:"'Inter',system-ui,sans-serif"}},"O rendimento é usado para verificar a isenção permanente (Art. 48 EBF). Limiar 2026: "+fE(Math.round(LIMIAR_ISENCAO_PERMANENTE_REND))+".")
            )
          )
        ),

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
                {titulo:"Jovens ≤35 anos — IMT (compra)",desc:"Isenção de IMT na compra (não no IMI anual) até €330.539 (2026). O IMI anual segue as regras normais.",cor:"#7c3aed"},
              ].map(function(item,i){
                return h("div",{key:i,style:{padding:"9px 0",borderBottom:i<3?"1px solid rgba(0,0,0,0.05)":"none"}},
                  h("div",{style:{fontSize:12,fontWeight:700,color:item.cor,marginBottom:2,fontFamily:"'Inter',system-ui,sans-serif"}},item.titulo),
                  h("div",{style:{fontSize:11,color:"#4b5563",lineHeight:1.5,fontFamily:"'Inter',system-ui,sans-serif"}},item.desc)
                );
              }),
              h("div",{style:{marginTop:10,padding:"8px 10px",background:"rgba(37,99,235,0.04)",borderRadius:7,fontSize:11,color:"#374151",fontFamily:"'Inter',system-ui,sans-serif"}},"⚠️ Taxas de 2026. A maioria dos municípios aplica 0,30% (mínimo legal). Verifica a taxa exacta do teu município no Portal das Finanças (AT).")
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
