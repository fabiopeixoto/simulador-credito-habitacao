;(function(){
  'use strict';
  if(!window.React||!window._SIM)return;
  var React=window.React;
  var h=React.createElement;
  var useMemo=React.useMemo;
  var Au=window._SIM.Au;
  var N=window._SIM.N;
  var Sky=window._SIM.Sky;
  var FALLBACK_EUR=window._SIM.FALLBACK_EUR;
  var EUR_COLORS=window._SIM.EUR_COLORS;

  var PT_MONTHS=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  function fmtYearMonth(d){
    if(!d)return"";
    var parts=d.slice(0,7).split("-");
    var m=parseInt(parts[1],10)-1;
    return PT_MONTHS[m]+". "+parts[0];
  }

  var EUR_SERIES=[
    {key:"3m",  label:"Euribor 3m",  color:"#f97316"},
    {key:"6m",  label:"Euribor 6m",  color:Sky},
    {key:"12m", label:"Euribor 12m", color:Au},
  ];
  var SPR_SERIES=[
    {key:"sCom", label:"Spread c/ produtos", color:Au},
    {key:"sSem", label:"Spread s/ produtos", color:"#9ca3af"},
  ];

  function mergeEur(data){
    if(!data)return[];
    var map={};
    EUR_SERIES.forEach(function(s){
      (data[s.key]||[]).forEach(function(pt){
        if(!map[pt.date])map[pt.date]={date:pt.date};
        map[pt.date][s.key]=pt.value;
      });
    });
    return Object.keys(map).sort().map(function(k){return map[k];});
  }

  function buildSVG(data,series,W,H,margin,xLabelFn){
    var innerW=W-margin.left-margin.right;
    var innerH=H-margin.top-margin.bottom;
    var n=data.length;
    if(n<2)return null;

    var allVals=[];
    data.forEach(function(d){series.forEach(function(s){if(d[s.key]!=null)allVals.push(+d[s.key]);});});
    var rawMin=Math.min.apply(null,allVals);
    var rawMax=Math.max.apply(null,allVals);
    var pad=Math.max(0.15,(rawMax-rawMin)*0.08);
    var yMin=Math.floor((rawMin-pad)*4)/4;
    var yMax=Math.ceil((rawMax+pad)*4)/4;
    if(yMax<=yMin)yMax=yMin+1;

    function toX(i){return margin.left+i/(n-1)*innerW;}
    function toY(v){return margin.top+innerH-(v-yMin)/(yMax-yMin)*innerH;}

    var p=[];

    // y axis label
    p.push('<text x="4" y="'+(margin.top-4)+'" font-size="8" fill="#d1d5db" font-family="monospace">%</text>');

    // grid + y labels
    for(var g=0;g<=4;g++){
      var gv=yMin+(yMax-yMin)*g/4;
      var gy=toY(gv).toFixed(1);
      p.push('<line x1="'+margin.left+'" y1="'+gy+'" x2="'+(margin.left+innerW)+'" y2="'+gy+'" stroke="rgba(0,0,0,0.05)" stroke-width="0.5"/>');
      p.push('<text x="'+(margin.left-3)+'" y="'+(+gy+4)+'" text-anchor="end" font-size="9" fill="#9ca3af" font-family="monospace">'+gv.toFixed(2).replace(".",",")+'</text>');
    }

    // zero line when range straddles zero
    if(yMin<0&&yMax>0){
      var zy=toY(0).toFixed(1);
      p.push('<line x1="'+margin.left+'" y1="'+zy+'" x2="'+(margin.left+innerW)+'" y2="'+zy+'" stroke="rgba(0,0,0,0.18)" stroke-width="1" stroke-dasharray="4,3"/>');
      p.push('<text x="'+(margin.left-3)+'" y="'+(+zy+4)+'" text-anchor="end" font-size="9" fill="#6b7280" font-family="monospace" font-weight="bold">0,00</text>');
    }

    // x-axis labels
    var prevLbl="";
    data.forEach(function(d,i){
      var lbl=xLabelFn?xLabelFn(d,i):"";
      if(!lbl||lbl===prevLbl)return;
      prevLbl=lbl;
      var lx=toX(i).toFixed(1);
      p.push('<line x1="'+lx+'" y1="'+margin.top+'" x2="'+lx+'" y2="'+(margin.top+innerH)+'" stroke="rgba(0,0,0,0.04)" stroke-width="0.5"/>');
      p.push('<text x="'+lx+'" y="'+(H-3)+'" text-anchor="middle" font-size="9" fill="#9ca3af" font-family="monospace">'+lbl+'</text>');
    });

    // lines
    series.forEach(function(s){
      var pts=[];
      data.forEach(function(d,i){if(d[s.key]!=null)pts.push(toX(i).toFixed(1)+","+toY(+d[s.key]).toFixed(1));});
      if(pts.length<2)return;
      p.push('<polyline points="'+pts.join(" ")+'" fill="none" stroke="'+s.color+'" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>');
      var last=data[data.length-1];
      if(last&&last[s.key]!=null){
        var lx=(toX(n-1)+5).toFixed(1);
        var ly=(toY(+last[s.key])+3).toFixed(1);
        p.push('<text x="'+lx+'" y="'+ly+'" font-size="9" fill="'+s.color+'" font-family="monospace" font-weight="bold">'+Number(last[s.key]).toFixed(3).replace(".",",")+'</text>');
      }
    });

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;overflow:visible">'+p.join("")+'</svg>';
  }

  function LegendRow(props){
    return h("div",{style:{display:"flex",gap:14,flexWrap:"wrap",marginBottom:10}},
      props.series.map(function(s){
        return h("div",{key:s.key,style:{display:"flex",alignItems:"center",gap:5}},
          h("div",{style:{width:20,height:3,background:s.color,borderRadius:2,flexShrink:0}}),
          h("span",{style:{fontSize:12,fontFamily:"monospace",color:"#6b7280"}},s.label),
          props.latest&&props.latest[s.key]!=null&&
            h("span",{style:{fontSize:12,fontFamily:"monospace",fontWeight:700,color:s.color}},
              Number(props.latest[s.key]).toFixed(3).replace(".",",")+"%")
        );
      })
    );
  }

  function HistoricoPage(props){
    var euriborData=props.euriborData;
    var spreadsData=props.spreadsData||[];
    var banks=props.banks||[];
    var selectedBank=props.selectedBank;
    var onSelectBank=props.onSelectBank;
    var loading=props.loading;
    var commentCount=props.commentCount||0;
    var onOpenComments=props.onOpenComments||function(){};
    var onOpenGlossario=props.onOpenGlossario||null;

    var pageEUR=useMemo(function(){
      return ["3m","6m","12m"].reduce(function(acc,k){
        var arr=euriborData&&euriborData[k]||[];
        var last=arr.length?arr[arr.length-1]:null;
        acc[k]=last?{valor:last.value,data:fmtYearMonth(last.date)}:FALLBACK_EUR[k];
        return acc;
      },{});
    },[euriborData]);


    var mergedEur=useMemo(function(){return mergeEur(euriborData);},[euriborData]);

    var eurSvg=useMemo(function(){
      if(!mergedEur.length)return null;
      var step=Math.max(1,Math.ceil(mergedEur.length/8));
      return buildSVG(mergedEur,EUR_SERIES,600,210,{top:20,right:48,bottom:20,left:40},function(d,i){
        return i%step===0?fmtYearMonth(d.date):"";
      });
    },[mergedEur]);

    var sprData=useMemo(function(){
      return spreadsData.map(function(r){
        return {date:new Date(r.fetched_at).toISOString().slice(0,10),sCom:r.sCom,sSem:r.sSem};
      });
    },[spreadsData]);

    var sprSvg=useMemo(function(){
      if(sprData.length<2)return null;
      var step=Math.max(1,Math.ceil(sprData.length/6));
      return buildSVG(sprData,SPR_SERIES,600,180,{top:20,right:48,bottom:20,left:40},function(d,i){
        return i%step===0?fmtYearMonth(d.date):"";
      });
    },[sprData]);

    var eurLatest=euriborData&&Object.keys(euriborData).length?
      EUR_SERIES.reduce(function(acc,s){
        var arr=euriborData[s.key]||[];
        acc[s.key]=arr.length?arr[arr.length-1].value:null;
        return acc;
      },{}):null;

    var sprLatest=spreadsData.length?spreadsData[spreadsData.length-1]:null;

    var cardS={background:"#fff",borderRadius:11,padding:"16px 18px",marginBottom:16,border:"1px solid rgba(0,0,0,0.07)"};
    var titleS={fontSize:11,letterSpacing:3,color:Au,fontFamily:"monospace",marginBottom:10};

    return h("div",{style:{fontFamily:"'Inter',system-ui,sans-serif",background:N,minHeight:"100vh",color:"#111827"}},
      h(window.PageHeader||function(){return null;},{EUR:pageEUR,activePage:"historico",commentCount:commentCount,onOpenComments:onOpenComments,onOpenGlossario:onOpenGlossario,subtitle:"Dados de mercado e contexto · Euribor BCE e evolução de spreads bancários"}),
      window.NoticeBanner&&h(window.NoticeBanner,null),
      h("div",{style:{maxWidth:840,margin:"0 auto",padding:"16px 14px"}},
        h("div",{style:cardS},
          h("div",{style:titleS},"EURIBOR — HISTÓRICO BCE"),
          h(LegendRow,{series:EUR_SERIES,latest:eurLatest}),
          loading?
            h("div",{style:{height:210,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ca3af",fontSize:13}},"A carregar dados BCE…"):
          eurSvg?
            h("div",{style:{overflow:"visible"},dangerouslySetInnerHTML:{__html:eurSvg}}):
            h("div",{style:{height:210,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ca3af",fontSize:13}},"Dados indisponíveis")
        ),
        h("div",{style:cardS},
          h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:10}},
            h("div",{style:titleS},"SPREADS — HISTÓRICO POR BANCO"),
            banks.length>0&&h("select",{
              value:selectedBank||"",
              onChange:function(e){onSelectBank(e.target.value);},
              style:{fontSize:13,padding:"4px 8px",borderRadius:6,border:"1px solid rgba(37,99,235,0.3)",color:"#111827",background:"#fff",cursor:"pointer",fontFamily:"sans-serif"}
            },banks.map(function(b){return h("option",{key:b.code,value:b.code},b.name);}))
          ),
          h(LegendRow,{series:SPR_SERIES,latest:sprLatest}),
          loading&&!sprData.length?
            h("div",{style:{height:180,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ca3af",fontSize:13}},"A carregar…"):
          sprSvg?
            h("div",{style:{overflow:"visible"},dangerouslySetInnerHTML:{__html:sprSvg}}):
            h("div",{style:{height:180,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ca3af",fontSize:13,textAlign:"center",padding:"0 20px"}},
              spreadsData.length===0?"Sem histórico de spreads — os dados ficam registados a cada atualização":"Histórico insuficiente para gráfico (mínimo 2 registos)"
            )
        )
      ),window.PageFooter&&h(window.PageFooter,null),window.CookieBanner&&h(window.CookieBanner,null)
    );
  }

  window.HistoricoPage=HistoricoPage;
})();
