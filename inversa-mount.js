;(function () {
  "use strict";
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  if (!React || !ReactDOM || !window._SIM || !window.ReverseCalcPage) {
    var root = document.getElementById("root");
    if (root) {
      root.innerHTML =
        '<div style="padding:40px;font-family:sans-serif;color:#b91c1c"><h2>Erro ao carregar</h2><p>Falta um script necessário (React ou calculadora inversa).</p></div>';
    }
    return;
  }

  var useState = React.useState;
  var useEffect = React.useEffect;

  function buildSimUrl(cap, params) {
    var p = params || {};
    var youngMode = p.youngMode;
    var selectedLTV = p.selectedLTV;
    var numTit = p.numTit;
    var pz = p.prazo;
    var r1 = p.r1;
    var c1 = p.c1;
    var r2 = p.r2;
    var c2 = p.c2;
    var dep = p.dep;
    var out = p.out;
    var tt = p.tt;
    var eRef = p.eRef;
    var ltv = youngMode ? selectedLTV || 0.9 : 0.8;
    var sp = new URLSearchParams();
    sp.set("v", String(Math.round(cap / ltv)));
    sp.set("p", String(Math.round(ltv * 100)));
    sp.set("pr", String(pz));
    sp.set("t", tt === "fixa" ? "fixa" : "variável");
    if (youngMode) sp.set("j", "1");
    sp.set("t2", String(numTit));
    sp.set("i1", "30");
    sp.set("r1", String(r1));
    if (c1 && c1 !== "efetivo") sp.set("c1", c1);
    if (numTit === 2) {
      sp.set("i2", "30");
      sp.set("r2", String(r2));
      if (c2 && c2 !== "efetivo") sp.set("c2", c2);
    }
    if (dep) sp.set("dep", String(dep));
    if (out) sp.set("out", String(out));
    if (tt !== "fixa" && eRef && ["3m", "6m", "12m"].indexOf(eRef) >= 0) sp.set("euf", eRef);
    return "/?" + sp.toString();
  }

  function mergeEurFromApi(raw) {
    var fe = window._SIM.FALLBACK_EUR;
    var e = (raw.euribor && raw.euribor.eur) || {};
    var label = (raw.euribor && raw.euribor.eurLabel) || "";
    return {
      "3m": { valor: e["3m"] || fe["3m"].valor, data: label || fe["3m"].data },
      "6m": { valor: e["6m"] || fe["6m"].valor, data: label || fe["6m"].data },
      "12m": { valor: e["12m"] || fe["12m"].valor, data: label || fe["12m"].data },
    };
  }

  function InversaRoot() {
    var fe = window._SIM.FALLBACK_EUR;
    var _u = useState({
      "3m": { valor: fe["3m"].valor, data: fe["3m"].data },
      "6m": { valor: fe["6m"].valor, data: fe["6m"].data },
      "12m": { valor: fe["12m"].valor, data: fe["12m"].data },
    });
    var EUR = _u[0];
    var setEUR = _u[1];

    useEffect(function () {
      var alive = true;
      fetch("/api/banks")
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (raw) {
          if (!alive || !raw) return;
          try {
            setEUR(mergeEurFromApi(raw));
          } catch (_) {}
        })
        .catch(function () {});
      return function () {
        alive = false;
      };
    }, []);

    return React.createElement(window.ReverseCalcPage, {
      EUR: EUR,
      onBack: function () {
        window.location.href = "/";
      },
      onOpenComments: function () {
        window.location.href = "/?comments=1";
      },
      onSimulate: function (cap, params) {
        window.location.href = buildSimUrl(cap, params);
      },
    });
  }

  var el = document.getElementById("root");
  if (!el) return;
  var root = ReactDOM.createRoot(el);
  root.render(React.createElement(InversaRoot, null));
})();
