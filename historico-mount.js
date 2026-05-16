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
      if(!selectedBank)return;
      if(spreadsCache[selectedBank]!==undefined)return;
      var alive=true;
      fetch('/api/banks?history='+selectedBank+'&limit=200')
        .then(function(r){return r.ok?r.json():null;})
        .then(function(data){
          if(!alive)return;
          setSpreadsCache(function(prev){
            var next=Object.assign({},prev);
            // reverse to ASC order (API returns DESC)
            next[selectedBank]=(data&&data.history?data.history:[]).slice().reverse();
            return next;
          });
        }).catch(function(){
          setSpreadsCache(function(prev){var n=Object.assign({},prev);n[selectedBank]=[];return n;});
        });
      return function(){alive=false;};
    },[selectedBank]);

    if(!window.HistoricoPage)return h("div",null,"A carregar…");
    return h(window.HistoricoPage,{
      euriborData:euriborData,
      spreadsData:spreadsCache[selectedBank]||[],
      banks:banks,
      selectedBank:selectedBank,
      onSelectBank:setSelectedBank,
      loading:loading,
    });
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(HistoricoRoot,null));
})();
