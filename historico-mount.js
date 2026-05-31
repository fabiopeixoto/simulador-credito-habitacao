;(function(){
  'use strict';
  if(!window.React||!window.ReactDOM)return;
  var React=window.React;
  var ReactDOM=window.ReactDOM;
  var h=React.createElement;
  var useState=React.useState;
  var useEffect=React.useEffect;

  function HistoricoRoot(){
    var _eur=useState(null);
    var euriborData=_eur[0]; var setEuriborData=_eur[1];
    var _banks=useState([]);
    var banks=_banks[0]; var setBanks=_banks[1];
    var _sel=useState(null);
    var selectedBank=_sel[0]; var setSelectedBank=_sel[1];
    var _spr=useState({});
    var spreadsCache=_spr[0]; var setSpreadsCache=_spr[1];
    var _ld=useState(true);
    var loading=_ld[0]; var setLoading=_ld[1];
    var _sc=useState(false);
    var showComments=_sc[0]; var setShowComments=_sc[1];
    var _sg=useState(false);
    var showGlossario=_sg[0]; var setShowGlossario=_sg[1];
    var _scom=useState([]);
    var comments=_scom[0]; var setComments=_scom[1];

    var commentTotal=comments.reduce(function(t,c){return t+1+((c.replies||[]).length);},0);

    useEffect(function(){
      var alive=true;
      Promise.all([
        fetch('/api/euribor-history').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
        fetch('/api/banks').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      ]).then(function(res){
        if(!alive)return;
        if(res[0])setEuriborData(res[0]);
        if(res[1]&&res[1].banks&&res[1].banks.length){
          setBanks(res[1].banks);
          setSelectedBank(res[1].banks[0].code);
        }
        setLoading(false);
      });
      return function(){alive=false;};
    },[]);

    useEffect(function(){
      var alive=true;
      fetch('/api/comments')
        .then(function(r){return r.ok?r.json():[];})
        .then(function(data){
          if(!alive)return;
          setComments(function(prev){return prev.length>0?prev:data;});
        }).catch(function(){});
      return function(){alive=false;};
    },[]);

    useEffect(function(){
      if(!selectedBank)return;
      if(spreadsCache[selectedBank]!==undefined)return;
      var alive=true;
      fetch('/api/banks?history='+selectedBank+'&limit=200')
        .then(function(r){return r.ok?r.json():null;})
        .then(function(data){
          if(!alive)return;
          setSpreadsCache(function(prev){
            var next=Object.assign({},prev);
            next[selectedBank]=(data&&data.history?data.history:[]).slice().reverse();
            return next;
          });
        }).catch(function(){
          setSpreadsCache(function(prev){var n=Object.assign({},prev);n[selectedBank]=[];return n;});
        });
      return function(){alive=false;};
    },[selectedBank]);

    var CommentsModal=window.CommentsModal||function(){return null;};
    var GlossarioModal=window.GlossarioModal||null;
    if(!window.HistoricoPage)return h("div",null,"A carregar…");
    return h(React.Fragment,null,
      h(window.HistoricoPage,{
        euriborData:euriborData,
        spreadsData:spreadsCache[selectedBank]||[],
        banks:banks,
        selectedBank:selectedBank,
        onSelectBank:setSelectedBank,
        loading:loading,
        commentCount:commentTotal,
        onOpenComments:function(){setShowComments(true);},
        onOpenGlossario:function(){setShowGlossario(true);},
      }),
      showComments&&h(CommentsModal,{
        onClose:function(){setShowComments(false);},
        comments:comments,
        setComments:setComments,
      }),
      showGlossario&&GlossarioModal&&h(GlossarioModal,{
        onClose:function(){setShowGlossario(false);},
      })
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(HistoricoRoot,null));
})();
