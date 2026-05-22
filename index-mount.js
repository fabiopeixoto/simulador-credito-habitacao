;(function(){
  'use strict';
  if(!window.React||!window.ReactDOM||!window._App)return;
  window.ReactDOM.createRoot(document.getElementById('root')).render(window.React.createElement(window._App,null));
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
