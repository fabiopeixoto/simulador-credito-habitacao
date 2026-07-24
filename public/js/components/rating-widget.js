;(function () {
  "use strict";
  if (!window.React) return;
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;

  var GOLD = "#c9a84c";
  var STORAGE_KEY = "sim_rated";

  function fmtAvg(v) {
    return (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
  }
  function countLabel(n) {
    return n + " " + (n === 1 ? "avaliação" : "avaliações");
  }

  function RatingWidget() {
    var _stats = useState(null);          var stats = _stats[0];        var setStats = _stats[1];
    var _voted = useState(false);         var voted = _voted[0];        var setVoted = _voted[1];
    var _just  = useState(false);         var justVoted = _just[0];     var setJustVoted = _just[1];
    var _hover = useState(0);             var hover = _hover[0];        var setHover = _hover[1];
    var _sub   = useState(false);         var submitting = _sub[0];     var setSubmitting = _sub[1];
    var _err   = useState("");            var err = _err[0];            var setErr = _err[1];

    useEffect(function () {
      try { if (window.localStorage && localStorage.getItem(STORAGE_KEY)) setVoted(true); } catch (_) {}
      fetch("/api/rating")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d) setStats(d); })
        .catch(function () {});
    }, []);

    function vote(value) {
      if (voted || submitting) return;
      setSubmitting(true); setErr("");
      fetch("/api/rating", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: value }) })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function (d) {
          setStats(d); setVoted(true); setJustVoted(true);
          try { if (window.localStorage) localStorage.setItem(STORAGE_KEY, "1"); } catch (_) {}
        })
        .catch(function () { setErr("Não foi possível registar a avaliação. Tenta novamente."); })
        .finally(function () { setSubmitting(false); });
    }

    var count = stats ? stats.count : 0;
    var average = stats ? stats.average : null;
    // Estrelas preenchidas: no hover mostra a selecção; senão a média (read-only).
    var filled = hover > 0 ? hover : (average != null ? Math.round(average) : 0);
    var interactive = !voted && !submitting;

    var starEls = [1, 2, 3, 4, 5].map(function (i) {
      var on = i <= filled;
      return h("span", {
        key: i,
        role: interactive ? "button" : undefined,
        "aria-label": interactive ? (i + " estrela" + (i > 1 ? "s" : "")) : undefined,
        onClick: interactive ? function () { vote(i); } : undefined,
        onMouseEnter: interactive ? function () { setHover(i); } : undefined,
        onMouseLeave: interactive ? function () { setHover(0); } : undefined,
        style: {
          fontSize: 30, lineHeight: 1, color: on ? GOLD : "rgba(0,0,0,0.18)",
          cursor: interactive ? "pointer" : "default", userSelect: "none",
          padding: "0 2px", transition: "color 0.12s",
        },
      }, "★");
    });

    var summary = count > 0
      ? h("span", { style: { fontSize: 13, color: "#374151" } },
          h("strong", { style: { color: "#111827" } }, fmtAvg(average)),
          " / 5 · " + countLabel(count))
      : h("span", { style: { fontSize: 13, color: "#6b7280" } }, "Sê o primeiro a avaliar");

    var statusLine = err
      ? h("div", { style: { fontSize: 12, color: "#dc2626", marginTop: 6 } }, "⚠️ " + err)
      : justVoted
        ? h("div", { style: { fontSize: 13, color: "#059669", marginTop: 6, fontWeight: 600 } }, "Obrigado pela avaliação! 🙏")
        : voted
          ? h("div", { style: { fontSize: 12, color: "#6b7280", marginTop: 6 } }, "Já avaliaste — obrigado!")
          : h("div", { style: { fontSize: 12, color: "#6b7280", marginTop: 6 } }, "Toca numa estrela para avaliar.");

    return h("div", {
      style: {
        background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.28)",
        borderRadius: 11, padding: "14px 16px", margin: "14px 0",
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 16px",
        fontFamily: "'Inter',system-ui,sans-serif",
      },
    },
      h("div", { style: { flex: "1 1 200px", minWidth: 0 } },
        h("div", { style: { fontSize: 14, fontWeight: 700, color: "#111827" } }, "Achaste o simulador útil?"),
        summary,
        statusLine
      ),
      h("div", { style: { display: "flex", alignItems: "center" }, "aria-label": "Avaliação por estrelas" }, starEls)
    );
  }

  window.RatingWidget = RatingWidget;
})();
