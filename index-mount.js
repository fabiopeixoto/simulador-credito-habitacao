;(function(){
  'use strict';
  if(!window.React||!window.ReactDOM||!window._App)return;
  window.ReactDOM.createRoot(document.getElementById('root')).render(window.React.createElement(window._App,null));
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
})();
