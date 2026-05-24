/**
 * Mínimo partilhado com o simulador principal para montar window._SIM
 * antes de carregar reverse-calc-page.js (página dedicada inversa.html).
 */
;(function () {
  "use strict";
  if (typeof window.React === "undefined") return;
  var React = window.React;
  var G = "#16a34a",
    R = "#dc2626",
    Au = "#2563eb",
    N = "#e5e7eb",
    Sky = "#0284c7";
  var shared = window._SIM_SHARED || {};
  var EUR_COLORS = shared.EUR_COLORS || {
    "3m": ["#f97316", "rgba(249,115,22,0.18)"],
    "6m": [Sky, "rgba(2,132,199,0.18)"],
    "12m": [Au, "rgba(37,99,235,0.18)"],
  };
  var FALLBACK_EUR = shared.FALLBACK_EUR || {
    "3m": { valor: 2.209, data: "maio 2026" },
    "6m": { valor: 2.541, data: "maio 2026" },
    "12m": { valor: 2.86, data: "maio 2026" },
  };
  var CONTRATO_FACTOR = shared.CONTRATO_FACTOR || {
    efetivo: 1.0,
    termo: 0.9,
    parcial: 0.8,
    recibo: 0.7,
    pensao: 1.0,
  };
  var fE = function (v) {
    return isFinite(v)
      ? Math.round(v).toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
      : "—";
  };
  var fP = function (v) {
    return isFinite(v) ? v.toFixed(3).replace(".", ",") + "%" : "—";
  };

  function SliderInput(_ref) {
    var min = _ref.min,
      max = _ref.max,
      step = _ref.step,
      value = _ref.value,
      onChange = _ref.onChange,
      color = _ref.color,
      prefix = _ref.prefix,
      suffix = _ref.suffix,
      formatFn = _ref.formatFn,
      ariaLabel = _ref.ariaLabel;
    var _s = React.useState(String(value));
    var inputVal = _s[0];
    var setInputVal = _s[1];
    var _e = React.useState(false);
    var editing = _e[0];
    var setEditing = _e[1];
    React.useEffect(
      function () {
        if (!editing) setInputVal(String(value));
      },
      [value, editing]
    );
    function handleInputChange(e) {
      setInputVal(e.target.value);
    }
    function handleInputBlur() {
      setEditing(false);
      var n = parseInt(String(inputVal).replace(/\D/g, ""), 10);
      if (!isNaN(n)) {
        var clamped = Math.min(max, Math.max(min, Math.round(n / step) * step));
        onChange(clamped);
        setInputVal(String(clamped));
      } else {
        setInputVal(String(value));
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Enter") e.target.blur();
      if (e.key === "Escape") {
        setEditing(false);
        setInputVal(String(value));
        e.target.blur();
      }
    }
    var displayFn = formatFn || function (v) {
      return v.toLocaleString("pt-PT");
    };
    return React.createElement(
      "div",
      null,
      React.createElement("input", {
        type: "range",
        min: min,
        max: max,
        step: step,
        value: value,
        onChange: function (e) {
          return onChange(+e.target.value);
        },
        "aria-label": ariaLabel || suffix || "valor",
        style: { width: "100%", accentColor: color || "#2563eb" },
      }),
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 4, minWidth: 0 } },
        prefix &&
          React.createElement("span", { style: { fontSize: 13, color: "#4b5563", fontFamily: "sans-serif", flexShrink: 0 } }, prefix),
        React.createElement("input", {
          type: "text",
          inputMode: "numeric",
          "aria-label": (ariaLabel || suffix || "valor") + " (editar)",
          value: editing ? inputVal : displayFn(value),
          onFocus: function () {
            setEditing(true);
            setInputVal(String(value));
          },
          onChange: handleInputChange,
          onBlur: handleInputBlur,
          onKeyDown: handleKeyDown,
          style: {
            flex: "0 1 90px",
            minWidth: "40px",
            padding: "4px 8px",
            background: "rgba(37,99,235,0.08)",
            border: "1px solid rgba(37,99,235,0.35)",
            borderRadius: 6,
            color: "#111827",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "sans-serif",
            textAlign: "right",
            outline: "none",
            cursor: "text",
          },
        }),
        suffix && React.createElement("span", { style: { fontSize: 13, color: "#4b5563", fontFamily: "sans-serif" } }, suffix)
      )
    );
  }

  var LTV_BRACKETS = {
    CA:    [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    CTT:   [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    BNKTR: [{max:75,add:0},{max:80,add:0.05},{max:90,add:0.10},{max:100,add:0.15}],
    ABANCA:[{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    BCP:   [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    ACTVO: [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    BPI:   [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    MNTPO: [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    SANTR: [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    NB:    [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    CGD:   [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    UCI:   [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    BNI:   [{max:80,add:0},{max:90,add:0.10}],
    BEST:  [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  };

  var BANK_DOMAINS = {
    CA:"creditoagricola.pt", CTT:"ctt.pt", BNKTR:"bankinter.pt", ABANCA:"abanca.com",
    BCP:"millenniumbcp.pt", ACTVO:"activobank.pt", BPI:"bpi.pt", MNTPO:"bancomontepio.pt",
    SANTR:"santander.pt", NB:"novobanco.pt", CGD:"cgd.pt", UCI:"uci.es",
    BNI:"bnieuropa.pt", BEST:"bancobest.pt",
  };

  window._SIM = {
    fE: fE,
    fP: fP,
    SliderInput: SliderInput,
    CONTRATO_FACTOR: CONTRATO_FACTOR,
    FALLBACK_EUR: FALLBACK_EUR,
    G: G,
    Au: Au,
    R: R,
    N: N,
    Sky: Sky,
    useState: React.useState,
    EUR_COLORS: EUR_COLORS,
    LTV_BRACKETS: LTV_BRACKETS,
    BANK_DOMAINS: BANK_DOMAINS,
  };
})();
