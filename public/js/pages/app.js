;(function(){
if(!window.React||!window.Recharts||!window._SIM)return;try{
const { useState, useEffect, useMemo, useCallback } = React;
const { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } = Recharts;

// ── Partilhado: cálculos, constantes, estilos e componentes ──────────────
// (js/core/calc.js, js/core/constants.js, js/core/styles.js,
//  js/components/slider-input.js, inversa-bootstrap.js)
const {
  fE,fE2,fP,fP1,margemVsOficial,
  calcP,calcTAEG,calcMTIC,isJurosMedioMensal,sTot,calcIMT,simA,amChart,prestacaoCarencia,getLTVAddon,
  FINALIDADE_ADDON,FINALIDADE_MAX_LTV,NAV,
  ecC,ecL,thS,thSC,tdB,tdBC,tdG,tdGC,tdR,tdRC,rbg,
  SliderInput,CONTRATO_FACTOR,FALLBACK_EUR,EUR_COLORS,
  G,R,Au,N,Sky,BANK_DOMAINS,
} = window._SIM;

const CACHE_KEY   = "credito_cache_v14";
const CACHE_H     = 8;
const HIST_KEY    = 'simulador-hist-v1';
const HIST_MAX  = 5;

// Vista compacta da Comparação só em dispositivos móveis reais (user-agent)
const IS_MOBILE=!!(window._SIM_SHARED&&window._SIM_SHARED.isMobileDevice);



// ── Dados dos bancos via API local (SQLite) ───────────────────────────────
async function fetchBanks() {
  const resp = await fetch("/api/banks");
  if(!resp.ok){
    const errText = await resp.text().catch(()=>"");
    const errJson = (() => { try { return JSON.parse(errText); } catch(_) { return {}; } })();
    throw new Error(errJson.error || "HTTP "+resp.status);
  }
  return resp.json(); // {banks: [...], euribor: {...}}
}

/** Garante sCom = spread normal (fora da promo) e promoSpread = spread da campanha (mais baixo). */
function normalizeCampaignSpreadRow(d){
  if(!d||typeof d!=="object")return d;
  const o={...d};
  const pp=Number(o.promoPeriodo)||0;
  if(pp<=0)return o;
  if(typeof o.promoSpread!=="number"||!Number.isFinite(o.promoSpread))return o;
  if(typeof o.sCom!=="number"||!Number.isFinite(o.sCom))return o;
  const hi=Math.max(o.sCom,o.promoSpread),lo=Math.min(o.sCom,o.promoSpread);
  o.sCom=hi;o.promoSpread=lo;return o;
}

const _Q=new URLSearchParams(location.search);
const _qi=(k,d)=>{const n=parseInt(_Q.get(k),10);return Number.isFinite(n)?n:d;};
const _qb=(k)=>_Q.get(k)==='1';
const _qs=(k,d,o)=>{const v=_Q.get(k);return o.includes(v)?v:d;};


function App(props){
  // Euribor / spreads
  const[EUR,setEUR]=useState(props.initialEUR||FALLBACK_EUR);
  const[bankData,setBankData]=useState(props.initialBankData||null);
  const[status,setStatus]=useState("idle");
  const[msg,setMsg]=useState("");
  const[ts,setTs]=useState(null);

  // Parâmetros base
  const[valorImovel,setValorImovel]=useState(()=>Math.max(50000,_qi('v',200000)));
  const[valorAvaliacao,setValorAvaliacao]=useState(()=>Math.max(0,_qi('va',0)));
  const[pct,setPct]=useState(()=>Math.min(100,Math.max(10,_qi('p',80))));
  const[prazo,setPrazo]=useState(()=>Math.min(40,Math.max(10,_qi('pr',30))));
  const[tipoTaxa,setTipoTaxa]=useState(()=>_qs('t',"variável",["variável","mista","fixa"]));
  const[modoJovem,setModoJovem]=useState(()=>_qb('j'));
  const[finalidade,setFinalidade]=useState(()=>_qs('f',"hpp",["hpp","hab2","arrendamento"]));
  const[certA,setCertA]=useState(()=>_qb('ca'));

  // Titulares
  const[titulares,setTitulares]=useState(()=>_qi('t2',1)===2?2:1);
  const[idade1,setIdade1]=useState(()=>Math.min(75,Math.max(18,_qi('i1',30))));
  const[rend1,setRend1]=useState(()=>Math.max(500,_qi('r1',1000)));
  const[tipoC1,setTipoC1]=useState(()=>_qs('c1',"efetivo",["efetivo","termo","parcial","recibo","pensao"]));
  const[idade2,setIdade2]=useState(()=>Math.min(75,Math.max(18,_qi('i2',30))));
  const[rend2,setRend2]=useState(()=>Math.max(500,_qi('r2',1000)));
  const[tipoC2,setTipoC2]=useState(()=>_qs('c2',"efetivo",["efetivo","termo","parcial","recibo","pensao"]));

  // DSTI extras
  const[dependentes,setDependentes]=useState(()=>Math.min(10,Math.max(0,_qi('dep',0))));
  const[outros,setOutros]=useState(()=>Math.max(0,_qi('out',0)));

  // Opções de crédito
  const[carencia,setCarencia]=useState(()=>Math.min(24,Math.max(0,_qi('car',0))));
  const[segProtecao,setSegProtecao]=useState(()=>_qb('sp'));

  // Amortização
  const[amortExtra,setAmortExtra]=useState(()=>Math.max(0,_qi('ae',0)));
  const[sortBy,setSortBy]=useState(()=>_qs('s',"prestTotal",["prestTotal","prestTotalSem","comProd","semProd","taeg","mtic","poupanca","spread","esforco","seguros"]));
  const[filtroEuribor,setFiltroEuribor]=useState(()=>_qs('euf',"all",["all","3m","6m","12m"]));
  const[nav,setNav]=useState("comp");
  const[shared,setShared]=useState(false);
  const[saved,setSaved]=useState(false);
  const[histSaved,setHistSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem(HIST_KEY)||'[]');}catch(_){return[];}});
  const[showHist,setShowHist]=useState(false);
  const[showComments,setShowComments]=useState(false);
  const[showGlossario,setShowGlossario]=useState(false);
  const[showProcesso,setShowProcesso]=useState(false);
  // Acordeão dos parâmetros: em mobile começa fechado; em desktop está sempre aberto
  const[paramsOpen,setParamsOpen]=useState(!IS_MOBILE);
  const showParams=!IS_MOBILE||paramsOpen;
  const[titularesOpen,setTitularesOpen]=useState(!IS_MOBILE);
  const showTitulares=!IS_MOBILE||titularesOpen;
  const[comments,setComments]=useState([]);
  const[bancoCustos,setBancoCustos]=useState("");
  const[bancoAmort,setBancoAmort]=useState("");
  const[bancoCen,setBancoCen]=useState("");
  const[detalheBanco,setDetalheBanco]=useState(null);
  
  // ── Load rates ──────────────────────────────────────────────────────────
  const loadRates=useCallback(async(force)=>{
    if(!force){
      try{
        const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");
        if(cached&&cached.ts&&cached.ts<=Date.now()&&(Date.now()-cached.ts)/3600000<CACHE_H){
          setEUR(cached.eur);
          const cbd=cached.bd||{};
          const normBd={};
          Object.keys(cbd).forEach(k=>{
            normBd[k]=normalizeCampaignSpreadRow(cbd[k]);
          });
          setBankData(normBd); setTs(new Date(cached.ts));
          setStatus("cached"); setMsg("Cache válida · há "+Math.round((Date.now()-cached.ts)/3600000)+"h"); return;
        }
      }catch(_){}
    }
  setStatus("loading"); setMsg("A carregar dados dos bancos...");
  try{
    const raw=await fetchBanks();
    const e=(raw.euribor&&raw.euribor.eur)||{};
    const label=(raw.euribor&&raw.euribor.eurLabel)||"";
    const newEUR={"3m":{valor:e["3m"]||FALLBACK_EUR["3m"].valor,data:label||FALLBACK_EUR["3m"].data},"6m":{valor:e["6m"]||FALLBACK_EUR["6m"].valor,data:label||FALLBACK_EUR["6m"].data},"12m":{valor:e["12m"]||FALLBACK_EUR["12m"].valor,data:label||FALLBACK_EUR["12m"].data}};
    setEUR(newEUR); setTs(new Date()); setStatus("ok");
    let statusMsg=label?"Euribor BCE · "+label:"Dados: actualizados";
    const newBD={};
    let nSpr=0;
    const fn=(v,lo,hi)=>{const n=Number(v);return Number.isFinite(n)&&n>=lo&&n<hi?n:null;};
    // Converter array de bancos em mapa de spreads {código: {...}}
    const spreadsMap={};
    (raw.banks||[]).forEach(b=>{if(b.code&&b.spreads)spreadsMap[b.code]=b.spreads;});
    (raw.banks||[]).forEach(b=>{
      const rv=spreadsMap[b.code]||{};
      if(!rv||typeof rv!=="object"||Object.keys(rv).length===0)return;
      const upd={};
      const tryN=(key,lo,hi)=>{const v=fn(rv[key],lo,hi);if(v!==null)upd[key]=v;};
      const sc=fn(rv.sCom,0,5);if(sc!==null){upd.sCom=sc;nSpr++;}
      tryN('sSem',0,5);tryN('mCom',0,10);tryN('mSem',0,10);tryN('fCom',0,10);tryN('fSem',0,10);
      tryN('jsCom',0,5);tryN('jsSem',0,5);
      tryN('jmCom',0,10);tryN('jmSem',0,10);tryN('jfCom',0,10);tryN('jfSem',0,10);
      tryN('dossier',0,2000);tryN('avaliacao',0,2000);tryN('contaMes',0,100);
      tryN('capMin',0,5000000);tryN('capMax',0,50000000);
      tryN('vRef',0,500);tryN('mAno',0,5000);tryN('vCap',0,5000000);tryN('vAge',0,120);tryN('pRef',0,5000000);
      tryN('promoPeriodo',0,360);tryN('minutas',0,2000);
      const ps=rv.promoSpread;if(ps===null||(typeof ps==='number'&&Number.isFinite(ps)&&ps>=0&&ps<10))upd.promoSpread=ps;
      const ji=rv.jovemIsenta;if(typeof ji==='boolean')upd.jovemIsenta=ji;
      const js=rv.jovemSameSpread;if(typeof js==='boolean')upd.jovemSameSpread=js;
      const jia=rv.jovemIsentaAval;if(typeof jia==='boolean')upd.jovemIsentaAval=jia;
      const fs=(v)=>typeof v==='string'&&v.length>0&&v.length<100?v.trim():null;
      const iv=fs(rv.insV);if(iv!==null)upd.insV=iv;
      const im=fs(rv.insM);if(im!==null)upd.insM=im;
      const cn=fs(rv.contaNota);if(cn!==null)upd.contaNota=cn;
      newBD[b.code]=normalizeCampaignSpreadRow({...upd,
        name:b.name||b.code,s:b.code,color:b.color||'#666666',
        refs:Array.isArray(b.refs)?b.refs:['12m'],
        jOk:!!b.jOk,carenciaMax:b.carenciaMax||0,
        tipos:Array.isArray(b.tipos)?b.tipos:['variável'],
        promos:Array.isArray(b.promos)?b.promos:[],
        prod:b.prod||'',jProd:b.jProd||'',
        sortOrder:b.sort_order??999,
        updated:sc!==null});
    });
    // Actualizar LTV_BRACKETS em-lugar com dados da API (fallback permanece em window._SIM.LTV_BRACKETS)
    (raw.banks||[]).forEach(b=>{if(b.ltvBrackets&&Array.isArray(b.ltvBrackets))window._SIM.LTV_BRACKETS[b.code]=b.ltvBrackets;});
    setBankData(newBD);
    if(Object.keys(spreadsMap).length>0) statusMsg+=" · "+nSpr+"/"+Object.keys(newBD).length+" actualizado ✓";
    try{localStorage.setItem(CACHE_KEY,JSON.stringify({eur:newEUR,bd:newBD,ts:Date.now()}));}catch(_){}
    setMsg(statusMsg);
  }catch(err){setStatus("error");setMsg("Erro: "+err.message.slice(0,80));}
  },[]);
  useEffect(()=>{
    loadRates(false);
    const revalidateId=setTimeout(()=>loadRates(true),1200);
    return()=>clearTimeout(revalidateId);
  },[loadRates]);
  useEffect(()=>{const id=setInterval(()=>loadRates(true),CACHE_H*3600*1000);return()=>clearInterval(id);},[loadRates]);
  useEffect(()=>{try{const sp=new URLSearchParams(window.location.search);if(sp.get("comments")==="1"){setShowComments(true);sp.delete("comments");const q=sp.toString();const nu=q?"?"+q:"";window.history.replaceState({},"",window.location.pathname+nu+(window.location.hash||""));}}catch(_){}},[]);
  
  // ── Derivados ────────────────────────────────────────────────────────────
  const is2=titulares===2;
  const maxPctFin=modoJovem&&finalidade==="hpp"?100:FINALIDADE_MAX_LTV[finalidade]||90;
  const pctR=Math.min(pct,maxPctFin);
  // Valor de referência para LTV = min(aquisição, avaliação) — se avaliação definida
  const valorRef=valorAvaliacao>0?Math.min(valorImovel,valorAvaliacao):valorImovel;
  const valorLim=Math.min(valorRef,modoJovem?450000:valorRef);
  const capital=Math.round(valorLim*pctR/100);
  const entrada=valorImovel-capital; // entrada em relação ao preço de compra
  // LTV real = capital / valorRef (pode diferir do pct se avaliação < aquisição)
  const ltvReal=valorRef>0?Math.round(capital/valorRef*100):pctR;
  const ltv=ltvReal;
  const certB=certA?0.15:0;
  // Aviso se avaliação abaixo do valor de aquisição
  const avalAbaixo=valorAvaliacao>0&&valorAvaliacao<valorImovel;

  // Rendimento ajustado por tipo de contrato e dependentes
  const rendAdj1=Math.round(rend1*(CONTRATO_FACTOR[tipoC1]||1));
  const rendAdj2=is2?Math.round(rend2*(CONTRATO_FACTOR[tipoC2]||1)):0;
  // Cada dependente reduz a capacidade em ~€400/mês (encargo estimado BdP)
  const rendT=Math.max(0, rendAdj1+rendAdj2-(dependentes*400));

  // Prazo — dupla regra BdP
  const idadeMax=is2?Math.max(idade1,idade2):idade1;
  const prazoMaxBdP = idadeMax<=30 ? 40 : (idadeMax<=35 ? 37 : 35);
  const prazoMax75  = Math.max(10,75-idadeMax);
  const prazoMax    = Math.min(prazoMaxBdP,prazoMax75);
  const prazoR      = Math.min(prazo,prazoMax);
  let prazoLimLabel;
  if (prazoMax75 <= prazoMaxBdP) {
    prazoLimLabel = "Limite 75a: "+idadeMax+"a + "+prazoMax+"a";
  } else if (idadeMax <= 30) {
    prazoLimLabel = "BdP (≤30a): máx. 40a";
  } else if (idadeMax <= 35) {
    prazoLimLabel = "BdP (30-35a): máx. 37a";
  } else {
    prazoLimLabel = "BdP (>35a): máx. 35a";
  }

  // Seguro de protecção ao crédito (opcional): ~€12/mês p/ €100k
  const segProtMensal=segProtecao?Math.round(capital*0.00012):0;

  // ── Banks com spread dinâmico + LTV + finalidade ─────────────────────────
  const BANKS=useMemo(()=>{
    if(!bankData) return [];
    return Object.values(bankData).filter(b=>b.s).sort((a,x)=>a.sortOrder-x.sortOrder).map(b=>{
      const basesCom=b.sCom??1;
      const basesSem=b.sSem??1.5;
      const ltvAddonRaw=getLTVAddon(b.s,ltv);
      const ltvAddon=(b.s==="CGD"&&modoJovem&&finalidade==="hpp")?0:ltvAddonRaw;
      const finalAddon=FINALIDADE_ADDON[finalidade]||0;
      let jsc=b.jsCom??basesCom;
      let jss=b.jsSem??basesSem;
      // CGD Medida Jovem (simulador oficial): spreads por patamar de LTV sobre valor de referência
      if(b.s==="CGD"&&modoJovem&&finalidade==="hpp"&&valorRef>0){
        const acima90=capital/valorRef>0.9;
        jsc=acima90?1.65:0.65;
        jss=acima90?2.35:1.35;
      } else if(modoJovem&&b.jOk&&!b.jovemSameSpread){
        if(Math.abs(jsc-basesCom)<1e-6) jsc=Math.max(0.12,Math.round((basesCom-0.10)*100)/100);
        if(Math.abs(jss-basesSem)<1e-6) jss=Math.max(0.12,Math.round((basesSem-0.10)*100)/100);
      }
      const jovMF=(x)=>!x||x<=0?x:Math.max(0.15,Math.round((x-0.12)*100)/100);
      let mC=b.mCom??0,mS=b.mSem??0,fC=b.fCom??0,fS=b.fSem??0;
      if(modoJovem&&b.jOk){
        if(b.s==="CGD"&&finalidade==="hpp"&&valorRef>0){
          const acima90=capital/valorRef>0.9;
          mC=acima90&&b.jmCom!=null?b.jmCom:mC;
          mS=acima90&&b.jmSem!=null?b.jmSem:mS;
          fC=acima90&&b.jfCom!=null?b.jfCom:fC;
          fS=acima90&&b.jfSem!=null?b.jfSem:fS;
        } else {
          mC=b.jmCom!=null?b.jmCom:jovMF(mC);
          mS=b.jmSem!=null?b.jmSem:jovMF(mS);
          fC=b.jfCom!=null?b.jfCom:jovMF(fC);
          fS=b.jfSem!=null?b.jfSem:jovMF(fS);
        }
      }
      return{
        ...b,
        sCom:Math.max(0,(modoJovem?jsc:basesCom)-certB+ltvAddon+finalAddon),
        sComBase:modoJovem?jsc:basesCom,
        sSem:(modoJovem?jss:basesSem)+ltvAddon+finalAddon,
        ltvAddon,finalAddon,
        spreadUpdated:b.updated??false,
        capitalOk:capital>=(b.capMin??0)&&capital<=(b.capMax??9999999),
        capitalMin:b.capMin??0,
        capitalMax:b.capMax??9999999,
        promoPeriodo:b.promoPeriodo??0,
        promoSpread:b.promoSpread??null,
        mCom:mC,
        mSem:mS,
        fCom:fC,
        fSem:fS,
        jsCom:jsc,
        jsSem:jss,
        insV:b.insV,
        insM:b.insM,
        contaNota:b.contaNota,
      };
    });
  },[bankData,certB,ltv,finalidade,modoJovem,capital,valorRef]);

  // ── Resultados ────────────────────────────────────────────────────────────
  const resultados=useMemo(()=>{
    const rows=[];
    const filtroAtivo=filtroEuribor!=="all";
    BANKS.forEach(b=>{
      if(modoJovem&&!b.jOk)return;
      if(!b.tipos.includes(tipoTaxa))return;
      if(filtroAtivo&&!b.refs.includes(filtroEuribor))return;
      const refsU=tipoTaxa==="variável"
        ?(filtroAtivo?[filtroEuribor]:b.refs)
        :(filtroAtivo?[filtroEuribor]:[b.refs.includes("12m")?"12m":b.refs[0]]);
      refsU.forEach(ref=>{
        const ev=(EUR[ref]||FALLBACK_EUR[ref]).valor;
        let tanC,tanS;
        if(tipoTaxa==="variável"){tanC=ev+b.sCom;tanS=ev+b.sSem;}
        else if(tipoTaxa==="mista"){tanC=b.mCom;tanS=b.mSem;}
        else{tanC=b.fCom;tanS=b.fSem;}

        const prazoEfetivo=prazoR-carencia/12;
        const prazoCalc=prazoEfetivo>0?prazoEfetivo:prazoR;
        const pC=calcP(capital,tanC,prazoCalc);
        const pS=calcP(capital,tanS,prazoCalc);

        // Prestação durante carência (só juros)
        const pCarenciaC=carencia>0?prestacaoCarencia(capital,tanC):null;
        const pCarenciaS=carencia>0?prestacaoCarencia(capital,tanS):null;

        // Seguros sobre capital médio em dívida (mais preciso)
        const seg=sTot(bankData[b.s]||{},idade1,idade2,is2,capital,valorImovel,prazoR);

        // IS sobre juros médio mensal (decrescente para arrendamento; 0 para HPP)
        const isM=isJurosMedioMensal(capital,tanC,prazoCalc,finalidade);

        // Comissão mensal de conta do banco
        const contaM=bankData[b.s]?.contaMes??0;

        const ptC=pC+seg.tot+isM+segProtMensal+contaM;
        const ptS=pS+seg.tot+isM+segProtMensal+contaM;

        // DSTI
        const efC=rendT>0?(ptC+outros)/rendT*100:0;
        const pSt=calcP(capital,tanC+1.5,prazoCalc);
        const efSt=rendT>0?((pSt+seg.tot+isM+segProtMensal+contaM)+outros)/rendT*100:0;

        // TAEG e MTIC — encargo mensal TAEG inclui prestação + seguros + IS + conta
        // Custos iniciais TAEG = dossier + avaliação + minutas + DPA + IS crédito
        const bd2=bankData[b.s]||{};
        const comB2={dossier:bd2.dossier??300,avaliacao:bd2.avaliacao??230,minutas:bd2.minutas??0,jovemIsenta:bd2.jovemIsenta??false,jovemIsentaAval:bd2.jovemIsentaAval??false};
        const comD2=modoJovem&&comB2.jovemIsenta?0:comB2.dossier;
        const comA2=modoJovem&&comB2.jovemIsentaAval?0:(comB2.avaliacao||0);
        const isCredTAEG=Math.round(capital*0.006);
        const regHTAEG=(modoJovem&&finalidade==="hpp")?0:Math.round(capital*0.0008+150);
        const comInic=comD2+comA2+(comB2.minutas||0)+200+isCredTAEG+regHTAEG;
        const encargoTAEG=pC+seg.tot+isM+segProtMensal+contaM;
        const taeg=calcTAEG(capital,comInic,encargoTAEG,prazoCalc*12);
        let mtic;
        if(carencia>0){
          const encCar=(pCarenciaC||0)+seg.tot+isM+segProtMensal+contaM;
          mtic=Math.round(comInic+encCar*carencia+encargoTAEG*prazoCalc*12);
        } else {
          mtic=calcMTIC(comInic,encargoTAEG,prazoCalc*12);
        }

        rows.push({
          ...b,ref,ev,tanC,tanS,pC,pS,seg,isM,contaM,ptC,ptS,
          pCarenciaC,pCarenciaS,
          taeg,mtic,comInic,encargoTAEG,
          diff:pS-pC,diffTot:(pS-pC)*prazoR*12,efC,efSt,pSt,
          isMulti:b.refs.length>1&&tipoTaxa==="variável"&&filtroEuribor==="all",
          rowKey:b.s+"-"+ref,
        });
      });
    });
    // Pre-computar representante de cada banco (primeira linha de cada banco)
    const bankRep = {};
    rows.forEach(r => { if (!bankRep[r.s]) bankRep[r.s] = r; });

    return rows.sort((a,bk)=>{
      if(sortBy==="prestTotal")  return a.ptC-bk.ptC || a.s.localeCompare(bk.s);
      if(sortBy==="prestTotalSem")return a.ptS-bk.ptS || a.s.localeCompare(bk.s);
      if(sortBy==="comProd")     return a.pC-bk.pC   || a.s.localeCompare(bk.s);
      if(sortBy==="semProd")     return a.pS-bk.pS   || a.s.localeCompare(bk.s);
      if(sortBy==="taeg")        return a.taeg-bk.taeg || a.s.localeCompare(bk.s);
      if(sortBy==="mtic")        return a.mtic-bk.mtic || a.s.localeCompare(bk.s);
      if(sortBy==="poupanca")    return bk.diff-a.diff || a.s.localeCompare(bk.s);
      if(sortBy==="spread")      return a.sCom-bk.sCom || a.s.localeCompare(bk.s);
      if(sortBy==="esforco")     return a.efC-bk.efC  || a.s.localeCompare(bk.s);
      if(sortBy==="seguros")     return a.seg.tot-bk.seg.tot || a.s.localeCompare(bk.s);
      return 0;
    });
  },[BANKS,bankData,modoJovem,finalidade,tipoTaxa,filtroEuribor,EUR,capital,prazoR,carencia,idade1,idade2,is2,valorImovel,rendT,outros,sortBy,segProtMensal]);

  const melhor=resultados[0];

  // Custos detalhados: derivados dentro de ViewCustos (js/views/view-custos.js)

  // Cenários Euribor
  const cenarios=useMemo(()=>{
    if(!melhor||tipoTaxa!=="variável")return[];
    const cRow=resultados.find(r=>r.s===(bancoCen||(melhor?.s)||""))||melhor;
    return[-0.5,0,0.5,1.0,1.5,2.0].map(d=>{
      const e2=cRow.ev+d,t2=e2+cRow.sCom;
      const p2=calcP(capital,t2,prazoR),pt2=p2+cRow.seg.tot+isJurosMedioMensal(capital,t2,prazoR,finalidade)+segProtMensal;
      const ef=rendT>0?(pt2+outros)/rendT*100:0;
      const st=calcP(capital,t2+1.5,prazoR)+cRow.seg.tot+isJurosMedioMensal(capital,t2+1.5,prazoR,finalidade)+segProtMensal;
      return{label:d===0?"Atual":d>0?("+"+d+"%"):(d+"%"),delta:d,eur:e2,tan:t2,p:Math.round(p2),pt:Math.round(pt2),ef,st:Math.round(st),efSt:rendT>0?(st+outros)/rendT*100:0};
    });
  },[melhor,resultados,bancoCen,capital,prazoR,rendT,outros,tipoTaxa,segProtMensal]);

  const bancoCenS=bancoCen||(melhor?.s)||"";
  const bancoCenRow=resultados.find(r=>r.s===bancoCenS)||melhor;
  const fixaB=bancoCenRow?.tipos?.includes("fixa")?bancoCenRow:null;
  const brkEur=fixaB?(fixaB.fCom-fixaB.sCom):null;
  // Banco seleccionado para amortização
  const bancoAmortS = bancoAmort || (melhor?.s) || "";
  const bancoAmortRow = resultados.find(r=>r.s===bancoAmortS) || melhor;
  const tanBest=bancoAmortRow?.tanC||3.5;
  const bancoAmortNome=bancoAmortRow?.name||"—";
  const bancoAmortRef=bancoAmortRow?.ref||"12m";
  const amSem=simA(capital,tanBest,prazoR,0);
  const amCom=amortExtra>0?simA(capital,tanBest,prazoR,amortExtra):null;
  const amCh=amortExtra>0?amChart(capital,tanBest,prazoR,amortExtra):[];

  const segChart=useMemo(()=>{
    const seen=new Set();
    return resultados.filter(r=>{if(seen.has(r.s))return false;seen.add(r.s);return true;})
      .sort((a,b)=>a.seg.tot-b.seg.tot)
      .map(r=>({name:r.s,"Vida T1":Math.round(r.seg.v1),"Vida T2":Math.round(r.seg.v2),"Multirriscos":Math.round(r.seg.m)}));
  },[resultados]);

  // Comentários — o formulário/respostas vivem em comments-modal.js;
  // o App só mantém a lista (para o contador no header) actualizada.
  const loadComments=useCallback(async()=>{
    try{const r=await fetch("/api/comments");if(r.ok)setComments(await r.json());}catch(_){}
  },[]);
  useEffect(()=>{loadComments();},[loadComments]);
  useEffect(()=>{if(showComments)loadComments();},[showComments,loadComments]);
  useEffect(()=>{const id=setInterval(()=>loadComments(),60000);return()=>clearInterval(id);},[loadComments]);
  const commentTotal=useMemo(()=>comments.reduce((total,c)=>total+1+((c.replies||[]).length),0),[comments]);

  // Partilha por URL — parâmetros comuns a partilhar/guardar
  function buildShareUrl(){
    const _p=new URLSearchParams();
    _p.set('v',valorImovel);_p.set('p',pct);_p.set('pr',prazo);_p.set('t',tipoTaxa);
    if(modoJovem)_p.set('j','1');
    if(finalidade!=='hpp')_p.set('f',finalidade);
    if(certA)_p.set('ca','1');
    _p.set('t2',titulares);_p.set('i1',idade1);_p.set('r1',rend1);
    if(tipoC1!=='efetivo')_p.set('c1',tipoC1);
    if(titulares===2){_p.set('i2',idade2);_p.set('r2',rend2);if(tipoC2!=='efetivo')_p.set('c2',tipoC2);}
    if(dependentes)_p.set('dep',dependentes);
    if(outros)_p.set('out',outros);
    if(carencia)_p.set('car',carencia);
    if(segProtecao)_p.set('sp','1');
    if(valorAvaliacao>0)_p.set('va',valorAvaliacao);
    if(amortExtra)_p.set('ae',amortExtra);
    if(sortBy!=='prestTotal')_p.set('s',sortBy);
    if(filtroEuribor!=='all')_p.set('euf',filtroEuribor);
    return location.origin+location.pathname+'?'+_p.toString();
  }

  function handleShare(){
    const url=buildShareUrl();
    function confirm(){setShared(true);setTimeout(()=>setShared(false),2000);}
    if(navigator.share){navigator.share({title:'Simulação Crédito Habitação',url}).then(confirm).catch(()=>{});}
    else{navigator.clipboard.writeText(url).then(confirm,()=>prompt('Copia este link:',url));}
  }

  function handleSave(){
    const entry={
      ts:Date.now(),
      label:fE(valorImovel)+" · "+prazoR+"a · "+tipoTaxa+(filtroEuribor!=="all"?" · Eur."+filtroEuribor:"")+" · melhor: "+(melhor?melhor.name+" ("+fP(melhor.tanC)+")":"—"),
      url:buildShareUrl()
    };
    const next=[entry,...histSaved].slice(0,HIST_MAX);
    try{localStorage.setItem(HIST_KEY,JSON.stringify(next));}catch(_){}
    setHistSaved(next);
    setSaved(true);setTimeout(()=>setSaved(false),2000);
  }



  if(!bankData) return React.createElement("main",{style:{maxWidth:560,margin:"0 auto",padding:"28px 20px",fontFamily:"sans-serif",color:"#111827",textAlign:"center"}},React.createElement("p",{style:{fontSize:13,color:"#4b5563"}},"A carregar dados dos bancos…"));

  return React.createElement(React.Fragment,null,
    React.createElement("div", {style: {fontFamily:"'Inter',system-ui,sans-serif",background:N,minHeight:"100vh",color:"#111827"}}, window.HeaderBar&&React.createElement(window.HeaderBar,{EUR,status,msg,ts,shared,saved,histSaved,showHist,setShowHist,setShowComments,setShowGlossario,setShowProcesso,loadRates,commentTotal,handleShare,handleSave}),window.NoticeBanner&&React.createElement(window.NoticeBanner,null), React.createElement("div", {style: {maxWidth:1440,margin:"0 auto",padding:"10px 14px"}}, React.createElement("div", {style: {display:"flex",borderRadius:9,overflow:"hidden",border:"1px solid rgba(0,0,0,0.07)",marginBottom:10}}, [{id:false,icon:"🏦",label:"Crédito Normal",c:Au},{id:true,icon:"🎓",label:"Crédito Jovem ≤35 anos",c:G}].map(({id,icon,label,c})=>(
            React.createElement("button", {key: String(id), onClick: ()=>{setModoJovem(id);if(!id)setPct(Math.min(pct,90));}, style: {flex:1,padding:"10px 9px",border:"none",background:modoJovem===id?c:"rgba(255,255,255,1)",borderBottom:"3px solid "+(modoJovem===id?c:"transparent"),color:modoJovem===id?"#fff":"#374151",fontSize:13,fontFamily:"sans-serif",cursor:modoJovem===id?"default":"pointer",fontWeight:modoJovem===id?700:600,transition:"background 0.15s,color 0.15s"}}, icon+" "+label)
          ))), window.ParamsPanel&&React.createElement(window.ParamsPanel,{valorImovel,setValorImovel,valorAvaliacao,setValorAvaliacao,setPct,prazo,setPrazo,tipoTaxa,setTipoTaxa,modoJovem,finalidade,setFinalidade,certA,setCertA,titulares,setTitulares,idade1,setIdade1,rend1,setRend1,tipoC1,setTipoC1,idade2,setIdade2,rend2,setRend2,tipoC2,setTipoC2,dependentes,setDependentes,outros,setOutros,carencia,setCarencia,segProtecao,setSegProtecao,paramsOpen,setParamsOpen,showParams,titularesOpen,setTitularesOpen,showTitulares,is2,maxPctFin,pctR,capital,entrada,ltvReal,avalAbaixo,rendT,prazoMax,prazoR,prazoLimLabel}), showHist&&histSaved.length>0&&window.HistModal&&React.createElement(window.HistModal,{histSaved,onClose:()=>setShowHist(false),onDelete:(i)=>{const n=histSaved.filter((_,j)=>j!==i);setHistSaved(n);try{localStorage.setItem(HIST_KEY,JSON.stringify(n));}catch(_){}}}),

          React.createElement("div", {style: {marginBottom:10}}, React.createElement("div", {style: {display:"flex",flexWrap:"wrap",borderRadius:9,overflow:"hidden",border:"1px solid rgba(0,0,0,0.07)",background:IS_MOBILE?"rgba(0,0,0,0.06)":"rgba(255,255,255,1)",rowGap:IS_MOBILE?1:0}}, NAV.map(({id,icon,label})=>(
            React.createElement("button", {key: id, className:"tab-compact", onClick: nav===id?undefined:()=>setNav(id), style: {flex:IS_MOBILE?"1 1 33%":1,padding:IS_MOBILE?"5px 3px":"6px",border:"none",background:nav===id?"rgba(37,99,235,0.08)":"rgba(255,255,255,1)",borderBottom:"2px solid "+(nav===id?Au:"transparent"),color:nav===id?Au:"#374151",fontSize:IS_MOBILE?11:12,fontFamily:"sans-serif",cursor:nav===id?"default":"pointer",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}, icon+" "+label)
          )))), nav==="comp"&&window.ViewComp&&React.createElement(window.ViewComp,{tipoTaxa,modoJovem,carencia,segProtecao,filtroEuribor,setFiltroEuribor,sortBy,setSortBy,setDetalheBanco,is2,pctR,capital,rendT,segProtMensal,resultados}), nav==="seg"&&window.ViewSeguros&&React.createElement(window.ViewSeguros,{segChart,resultados,bankData,is2,idade1,idade2,titulares,capital,segProtecao,segProtMensal}), nav==="cust"&&window.ViewCustos&&React.createElement(window.ViewCustos,{bancoCustos,setBancoCustos,melhor,bankData,BANKS,modoJovem,finalidade,valorImovel,capital,pctR,entrada}), nav==="viab"&&window.ViewViabilidade&&React.createElement(window.ViewViabilidade,{idadeMax,prazoMaxBdP,prazoMax75,prazoR,prazoLimLabel,is2,rendT,rendAdj1,rendAdj2,tipoC1,tipoC2,dependentes,resultados,capital}), nav==="cen"&&window.ViewCenarios&&React.createElement(window.ViewCenarios,{tipoTaxa,finalidade,segProtecao,setBancoCen,capital,rendT,prazoR,segProtMensal,resultados,melhor,cenarios,bancoCenS,bancoCenRow,fixaB,brkEur}), nav==="amort"&&window.ViewAmortizacao&&React.createElement(window.ViewAmortizacao,{carencia,amortExtra,setAmortExtra,setBancoAmort,capital,prazoR,resultados,melhor,bancoAmortS,bancoAmortRow,tanBest,bancoAmortNome,bancoAmortRef,amSem,amCom,amCh}), React.createElement("div", {style: {marginTop:14,padding:"10px 14px",background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:9,fontFamily:"sans-serif"}}, React.createElement("div", {style: {fontSize:12,fontWeight:700,color:Au,marginBottom:4}}, "⚠️ Simulação indicativa — não substitui a FINE"), React.createElement("div", {style: {fontSize:11,color:"#4b5563",lineHeight:1.7}}, "Os valores apresentados são estimativas com base em spreads e comissões publicadas. As condições efectivas dependem da análise de risco de cada banco. Consulte sempre a Ficha de Informação Normalizada Europeia (FINE) antes de contratar.")), React.createElement("div", {style: {marginTop:6,padding:"10px 14px",background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:9,fontFamily:"sans-serif"}}, React.createElement("div", {style: {fontSize:11,color:"#374151",lineHeight:1.7}}, "🔄 Euribor via BCE · Cache 8h. 📊 Spread: LTV + finalidade + cert. energético. 🧮 TAEG: Directiva 2014/17/UE. 💰 MTIC = total pago. 🛡️ Seg. vida sobre capital médio. 🏠 IS HPP: €0 (art. 7º CIS). 📅 Prazo: BdP Aviso 4/2022."))))
  ,showComments&&window.CommentsModal&&React.createElement(window.CommentsModal,{comments,setComments,onClose:()=>setShowComments(false)}
  ),detalheBanco&&window.BankDetailModal&&React.createElement(window.BankDetailModal,{row:detalheBanco,ctx:{carencia,segProtecao,segProtMensal,is2,rendT,modoJovem,capital,margem:margemVsOficial(detalheBanco.ptC)},onClose:()=>setDetalheBanco(null)}),showGlossario&&window.GlossarioModal&&React.createElement(window.GlossarioModal,{onClose:()=>setShowGlossario(false)}),showProcesso&&window.ProcessoModal&&React.createElement(window.ProcessoModal,{onClose:()=>setShowProcesso(false)}),window.PageFooter&&React.createElement(window.PageFooter,null),window.CookieBanner&&React.createElement(window.CookieBanner,null));
}
window._App=App;
}catch(e){
var _d=document.getElementById('root');if(_d){_d.style.cssText='color:#f87171;padding:40px;background:#e5e7eb;min-height:100vh';var _h=document.createElement('h2');_h.textContent='Erro ao iniciar';var _p=document.createElement('p');_p.textContent=e.message;_d.appendChild(_h);_d.appendChild(_p);}
}
})();
