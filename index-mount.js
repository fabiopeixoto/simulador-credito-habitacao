;(function(){
  'use strict';
  if(!window.React||!window.ReactDOM||!window._App)return;
  var initialProps=null;
  try{
    var _c=localStorage.getItem("credito_cache_v14");
    if(_c){var _p=JSON.parse(_c);if(_p&&_p.bd&&_p.ts&&_p.ts<=Date.now()&&(Date.now()-_p.ts)/3600000<8)initialProps={initialBankData:_p.bd,initialEUR:_p.eur};}
  }catch(_){}
  window.ReactDOM.createRoot(document.getElementById('root')).render(
    window.React.createElement(window._App,initialProps)
  );
  // Sem reload em controllerchange: a estratégia do SW é network-first e os
  // assets são versionados (?v=), pelo que o SW novo pode assumir o controlo
  // sem recarregar a página (evita o "abre e volta a recarregar").
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js');
  }
})();
