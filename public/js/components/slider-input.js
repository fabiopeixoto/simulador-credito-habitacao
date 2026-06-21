/**
 * SliderInput — slider + input numérico em simultâneo.
 * Componente único partilhado por todas as páginas (registado em
 * window._SIM.SliderInput). Carregar depois de inversa-bootstrap.js.
 */
;(function () {
  "use strict";
  if (typeof window.React === "undefined") return;
  var React = window.React;

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
          React.createElement("span", { style: { fontSize: 13, color: "#374151", fontFamily: "sans-serif", flexShrink: 0 } }, prefix),
        React.createElement("input", {
          type: "text",
          inputMode: "numeric",
          className: "val-compact",
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
            flex: "0 1 78px",
            minWidth: "40px",
            padding: "2px 6px",
            background: "rgba(37,99,235,0.05)",
            border: "1px solid rgba(37,99,235,0.22)",
            borderRadius: 6,
            color: "#111827",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "sans-serif",
            textAlign: "right",
            outline: "none",
            cursor: "text",
          },
        }),
        suffix && React.createElement("span", { style: { fontSize: 13, color: "#374151", fontFamily: "sans-serif" } }, suffix)
      )
    );
  }

  window._SIM = Object.assign(window._SIM || {}, { SliderInput: SliderInput });
})();
