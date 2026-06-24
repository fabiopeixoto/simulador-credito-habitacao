;(function(){
  'use strict';
  var React=window.React;
  var ReactDOM=window.ReactDOM;
  if(!React||!ReactDOM||!window._SIM||!window.StressEuriborPage){
    var root=document.getElementById("root");
    if(root)root.innerHTML='<div style="padding:40px;font-family:sans-serif;color:#b91c1c"><h2>Erro ao carregar</h2><p>Falta um script necessário.</p></div>';
    return;
  }
  var useState=React.useState;
  var useEffect=React.useEffect;
  var h=React.createElement;
  var CommentsModal=window.CommentsModal||function(){return null;};
  var GlossarioModal=window.GlossarioModal||null;
  var ProcessoModal=window.ProcessoModal||null;

  function mergeEurFromApi(raw){
    var fe=window._SIM.FALLBACK_EUR;
    var e=(raw.euribor&&raw.euribor.eur)||{};
    var label=(raw.euribor&&raw.euribor.eurLabel)||"";
    return {
      "3m":{valor:e["3m"]||fe["3m"].valor,data:label||fe["3m"].data},
      "6m":{valor:e["6m"]||fe["6m"].valor,data:label||fe["6m"].data},
      "12m":{valor:e["12m"]||fe["12m"].valor,data:label||fe["12m"].data},
    };
  }

  function StressEuriborRoot(props){
    var fe=window._SIM.FALLBACK_EUR;
    var _u=useState(props.initialEUR||{"3m":{valor:fe["3m"].valor,data:fe["3m"].data},"6m":{valor:fe["6m"].valor,data:fe["6m"].data},"12m":{valor:fe["12m"].valor,data:fe["12m"].data}});
    var EUR=_u[0];
    var _sc=useState(false);
    var showComments=_sc[0];var setShowComments=_sc[1];
    var _sg=useState(false);
    var showGlossario=_sg[0];var setShowGlossario=_sg[1];
    var _sp=useState(false);
    var showProcesso=_sp[0];var setShowProcesso=_sp[1];
    var _scom=useState([]);
    var comments=_scom[0];var setComments=_scom[1];

    var commentTotal=comments.reduce(function(t,c){return t+1+((c.replies||[]).length);},0);

    useEffect(function(){
      var alive=true;
      fetch("/api/comments")
        .then(function(r){return r.ok?r.json():[];})
        .then(function(data){if(!alive)return;setComments(function(prev){return prev.length>0?prev:data;});})
        .catch(function(){});
      return function(){alive=false;};
    },[]);

    return h(React.Fragment,null,
      h(window.StressEuriborPage,{
        EUR:EUR,
        commentCount:commentTotal,
        onOpenComments:function(){setShowComments(true);},
        onOpenGlossario:function(){setShowGlossario(true);},
        onOpenProcesso:function(){setShowProcesso(true);},
      }),
      showComments&&h(CommentsModal,{
        onClose:function(){setShowComments(false);},
        comments:comments,
        setComments:setComments,
      }),
      showGlossario&&GlossarioModal&&h(GlossarioModal,{
        onClose:function(){setShowGlossario(false);},
      }),
      showProcesso&&ProcessoModal&&h(ProcessoModal,{
        onClose:function(){setShowProcesso(false);},
      })
    );
  }

  var el=document.getElementById("root");
  if(!el)return;

  fetch("/api/banks")
    .then(function(r){return r.ok?r.json():null;})
    .then(function(raw){
      var initialEUR=raw?mergeEurFromApi(raw):null;
      ReactDOM.createRoot(el).render(h(StressEuriborRoot,{initialEUR:initialEUR}));
    })
    .catch(function(){
      ReactDOM.createRoot(el).render(h(StressEuriborRoot,{initialEUR:null}));
    });
})();
