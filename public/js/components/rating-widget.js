;(function () {
  "use strict";
  if (!window.React) return;
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;

  var GOLD = "#c9a84c";
  var DONE_KEY = "sim_feedback_done";
  var LEGACY_KEY = "sim_rated"; // quem já votou na versão anterior não é incomodado
  var SHOW_DELAY_MS = 4000;

  function alreadyDone() {
    try {
      return !!(window.localStorage && (localStorage.getItem(DONE_KEY) || localStorage.getItem(LEGACY_KEY)));
    } catch (_) { return false; }
  }
  function markDone() {
    try { if (window.localStorage) localStorage.setItem(DONE_KEY, "1"); } catch (_) {}
  }

  // Post-it flutuante de feedback: estrelas (→ /api/rating) + nota opcional
  // (→ /api/comments, comentário público). Ao submeter OU fechar, desaparece
  // e não volta a aparecer (localStorage).
  function RatingWidget() {
    var _vis = useState(false);      var visible = _vis[0];      var setVisible = _vis[1];
    var _rating = useState(0);       var rating = _rating[0];    var setRating = _rating[1];
    var _hover = useState(0);        var hover = _hover[0];      var setHover = _hover[1];
    var _note = useState("");        var note = _note[0];        var setNote = _note[1];
    var _sub = useState(false);      var submitting = _sub[0];   var setSubmitting = _sub[1];
    var _err = useState("");         var err = _err[0];          var setErr = _err[1];
    var _thanks = useState(false);   var thanks = _thanks[0];    var setThanks = _thanks[1];

    useEffect(function () {
      if (alreadyDone()) return;
      var t = setTimeout(function () { setVisible(true); }, SHOW_DELAY_MS);
      return function () { clearTimeout(t); };
    }, []);

    function dismiss() {
      // Fechar sem votar NÃO marca como concluído: reaparece no próximo
      // carregamento da página. Só votar (submit → markDone) o esconde de vez.
      setVisible(false);
    }

    function submit() {
      if (rating < 1 || submitting) return;
      var noteTrim = note.trim();
      if (noteTrim && noteTrim.length < 5) {
        setErr("A nota deve ter pelo menos 5 caracteres (ou deixa em branco).");
        return;
      }
      setSubmitting(true); setErr("");
      // 1) Voto de estrelas.
      fetch("/api/rating", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: rating }) })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function () {
          // 2) Nota como comentário público (best-effort; não bloqueia).
          if (noteTrim.length >= 5) {
            return fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: noteTrim, bank: "" }) }).catch(function () {});
          }
        })
        .then(function () {
          markDone();
          setThanks(true);
          setTimeout(function () { setVisible(false); }, 1800);
        })
        .catch(function () { setErr("Não foi possível enviar. Tenta novamente."); })
        .finally(function () { setSubmitting(false); });
    }

    if (!visible) return null;

    var card = {
      position: "fixed", right: 16, bottom: 16, zIndex: 900,
      width: 320, maxWidth: "calc(100vw - 32px)",
      background: "#ffffff", borderRadius: 14,
      boxShadow: "0 12px 40px rgba(0,0,0,0.22)", border: "1px solid rgba(0,0,0,0.06)",
      padding: "16px 18px 18px", fontFamily: "'Inter',system-ui,sans-serif",
    };

    if (thanks) {
      return h("div", { style: card },
        h("div", { style: { textAlign: "center", padding: "10px 0" } },
          h("div", { style: { fontSize: 28, marginBottom: 6 } }, "🙏"),
          h("div", { style: { fontSize: 15, fontWeight: 700, color: "#111827" } }, "Obrigado pela tua opinião!")
        )
      );
    }

    var filled = hover > 0 ? hover : rating;
    var stars = [1, 2, 3, 4, 5].map(function (i) {
      return h("span", {
        key: i, role: "button", "aria-label": i + " estrela" + (i > 1 ? "s" : ""),
        onClick: function () { setRating(i); },
        onMouseEnter: function () { setHover(i); },
        onMouseLeave: function () { setHover(0); },
        style: { fontSize: 30, lineHeight: 1, color: i <= filled ? GOLD : "rgba(0,0,0,0.16)", cursor: "pointer", userSelect: "none", padding: "0 3px", transition: "color 0.12s" },
      }, "★");
    });

    return h("div", { style: card },
      h("button", {
        onClick: dismiss, "aria-label": "Fechar",
        style: { position: "absolute", top: 8, right: 10, background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "#9ca3af", cursor: "pointer", padding: 4 },
      }, "×"),
      h("div", { style: { display: "flex", justifyContent: "center", marginTop: 4, marginBottom: 8 } }, stars),
      h("div", { style: { fontSize: 16, fontWeight: 800, color: "#111827", textAlign: "center" } }, "Precisamos da tua opinião"),
      h("div", { style: { fontSize: 12.5, color: "#4b5563", textAlign: "center", marginTop: 4, lineHeight: 1.4 } }, "Como avalias a tua experiência com o simulador?"),
      h("textarea", {
        value: note, onChange: function (e) { setNote(e.target.value); },
        placeholder: "Escreve uma nota (opcional, torna-se um comentário público)",
        maxLength: 500, rows: 2,
        style: { width: "100%", marginTop: 12, padding: "8px 10px", border: "1px solid rgba(0,0,0,0.14)", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
      }),
      err && h("div", { style: { fontSize: 11.5, color: "#dc2626", marginTop: 6 } }, "⚠️ " + err),
      h("button", {
        onClick: submit, disabled: rating < 1 || submitting,
        style: {
          width: "100%", marginTop: 10, padding: "10px 14px", border: "none", borderRadius: 9,
          background: rating < 1 || submitting ? "rgba(201,168,76,0.45)" : GOLD,
          color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: rating < 1 || submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
        },
      }, submitting ? "A enviar..." : "Enviar")
    );
  }

  window.RatingWidget = RatingWidget;
})();
