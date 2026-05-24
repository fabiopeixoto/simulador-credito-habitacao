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
  if('serviceWorker' in navigator){
    var _swRefreshing=false;
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(_swRefreshing)return;
      _swRefreshing=true;
      window.location.reload();
    });
    navigator.serviceWorker.register('/sw.js');
  }
})();
