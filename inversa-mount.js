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
  var useCallback = React.useCallback;
  var h = React.createElement;

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

  function CommentsModal(props) {
    var onClose = props.onClose;
    var _sc = useState([]);         var comments = _sc[0]; var setComments = _sc[1];
    var _sl = useState(false);       var loading = _sl[0];  var setLoading = _sl[1];
    var _sf = useState({name:"",text:"",bank:"",simPt:"",realPt:""});
    var commentForm = _sf[0]; var setCommentForm = _sf[1];
    var _se = useState("");          var commentErr = _se[0]; var setCommentErr = _se[1];
    var _sok = useState(false);      var commentOk = _sok[0]; var setCommentOk = _sok[1];
    var _ssub = useState(false);     var commentSubmit = _ssub[0]; var setCommentSubmit = _ssub[1];
    var _srt = useState(null);       var replyTo = _srt[0]; var setReplyTo = _srt[1];
    var _srf = useState({name:"",text:""});
    var replyForm = _srf[0]; var setReplyForm = _srf[1];
    var _sre = useState("");         var replyErr = _sre[0]; var setReplyErr = _sre[1];
    var _srok = useState(null);      var replyOk = _srok[0]; var setReplyOk = _srok[1];
    var _srsu = useState(false);     var replySubmit = _srsu[0]; var setReplySubmit = _srsu[1];

    useEffect(function () {
      setLoading(true);
      fetch("/api/comments")
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (data) { setComments(data); setLoading(false); })
        .catch(function () { setLoading(false); });
    }, []);

    function submitComment(e) {
      e.preventDefault();
      if (commentForm.text.trim().length < 5) return;
      setCommentSubmit(true); setCommentErr(""); setCommentOk(false);
      fetch("/api/comments", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(commentForm)})
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function (c) {
          setComments(function (prev) { return [c].concat(prev); });
          setCommentForm({name:"",text:"",bank:"",simPt:"",realPt:""});
          setCommentOk(true);
        })
        .catch(function () { setCommentErr("Erro ao publicar. Tenta novamente."); })
        .finally(function () { setCommentSubmit(false); });
    }

    function submitReply(e, parentId) {
      e.preventDefault();
      if (replyForm.text.trim().length < 5) return;
      setReplySubmit(true); setReplyErr("");
      fetch("/api/comments", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({},replyForm,{parentId:parentId}))})
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function (reply) {
          setComments(function (prev) { return prev.map(function (c) {
            if (c.id !== parentId) return c;
            return Object.assign({}, c, {replies: (c.replies||[]).concat(reply)});
          }); });
          setReplyOk(parentId); setReplyTo(null); setReplyForm({name:"",text:""});
        })
        .catch(function () { setReplyErr("Erro ao responder. Tenta novamente."); })
        .finally(function () { setReplySubmit(false); });
    }

    return h("div", {onClick:onClose,style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}},
      h("div", {onClick:function(e){e.stopPropagation();},style:{background:"#ffffff",borderRadius:14,width:"100%",maxWidth:580,maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",fontFamily:"'Inter',system-ui,sans-serif"}},
        h("div", {style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid rgba(0,0,0,0.07)"}},
          h("div", null,
            h("div", {style:{fontSize:15,fontWeight:700,color:"#111827"}}, "💬 Comentários da Comunidade"),
            h("div", {style:{fontSize:11,color:"#6b7280",marginTop:2}}, "Partilha a tua experiência: quanto calculou o simulador vs o que conseguiste")
          ),
          h("button", {onClick:onClose,style:{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#6b7280",padding:"0 4px",lineHeight:1}}, "✕")
        ),
        h("div", {style:{flex:1,overflowY:"auto",padding:"14px 18px"}},
          h("form", {onSubmit:submitComment,style:{background:"rgba(139,92,246,0.04)",border:"1px solid rgba(139,92,246,0.18)",borderRadius:10,padding:14,marginBottom:16}},
            h("div", {style:{fontSize:11,fontWeight:700,color:"#7c3aed",letterSpacing:1,marginBottom:10,fontFamily:"monospace"}}, "DEIXA O TEU COMENTÁRIO"),
            h("div", {style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
              h("div", null,
                h("label", {style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}}, "Nome (opcional)"),
                h("input", {value:commentForm.name,onChange:function(e){setCommentForm(function(f){return Object.assign({},f,{name:e.target.value});});},placeholder:"Anónimo",maxLength:50,style:{width:"100%",padding:"6px 9px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",boxSizing:"border-box"}})
              ),
              h("div", null,
                h("label", {style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}}, "Banco (opcional)"),
                h("input", {value:commentForm.bank,onChange:function(e){setCommentForm(function(f){return Object.assign({},f,{bank:e.target.value});});},placeholder:"ex: CGD, BPI...",maxLength:40,style:{width:"100%",padding:"6px 9px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",boxSizing:"border-box"}})
              )
            ),
            h("div", {style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
              h("div", null,
                h("label", {style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}}, "Simulador calculou (€/mês)"),
                h("input", {value:commentForm.simPt,onChange:function(e){setCommentForm(function(f){return Object.assign({},f,{simPt:e.target.value});});},placeholder:"ex: 850",type:"text",inputMode:"decimal",style:{width:"100%",padding:"6px 9px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",boxSizing:"border-box"}})
              ),
              h("div", null,
                h("label", {style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}}, "Real conseguido (€/mês)"),
                h("input", {value:commentForm.realPt,onChange:function(e){setCommentForm(function(f){return Object.assign({},f,{realPt:e.target.value});});},placeholder:"ex: 870",type:"text",inputMode:"decimal",style:{width:"100%",padding:"6px 9px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",boxSizing:"border-box"}})
              )
            ),
            h("div", {style:{marginBottom:8}},
              h("label", {style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}}, "Comentário *"),
              h("textarea", {value:commentForm.text,onChange:function(e){setCommentForm(function(f){return Object.assign({},f,{text:e.target.value});});},placeholder:"Partilha a tua experiência com o simulador ou com o banco...",required:true,maxLength:500,rows:3,style:{width:"100%",padding:"6px 9px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",resize:"vertical",boxSizing:"border-box"}})
            ),
            commentErr&&h("div", {style:{fontSize:11,color:"#dc2626",marginBottom:8,padding:"5px 9px",background:"rgba(220,38,38,0.06)",borderRadius:5}}, "⚠️ "+commentErr),
            commentOk&&h("div", {style:{fontSize:11,color:"#059669",marginBottom:8,padding:"5px 9px",background:"rgba(5,150,105,0.06)",borderRadius:5}}, "✅ Comentário publicado!"),
            h("button", {type:"submit",disabled:commentSubmit||commentForm.text.trim().length<5,style:{padding:"7px 18px",background:commentSubmit?"rgba(0,0,0,0.05)":"rgba(139,92,246,0.9)",border:"none",borderRadius:7,color:commentSubmit?"#9b9b9b":"#ffffff",fontSize:12,fontWeight:700,cursor:commentSubmit?"not-allowed":"pointer",fontFamily:"sans-serif"}}, commentSubmit?"A publicar...":"Publicar comentário")
          ),
          loading?h("div", {style:{textAlign:"center",color:"#6b7280",fontSize:13,padding:20}}, "⏳ A carregar..."):
          comments.length===0?h("div", {style:{textAlign:"center",color:"#9ca3af",fontSize:13,padding:20}}, "Ainda não há comentários. Sê o primeiro!"):
          h("div", null, comments.map(function(c) {
            return h("div", {key:c.id,style:{borderBottom:"1px solid rgba(0,0,0,0.06)",paddingBottom:12,marginBottom:12}},
              h("div", {style:{display:"flex",alignItems:"baseline",gap:8,marginBottom:4}},
                h("span", {style:{fontWeight:700,fontSize:13,color:"#111827"}}, c.name),
                c.bank&&h("span", {style:{fontSize:11,background:"rgba(37,99,235,0.08)",border:"1px solid rgba(37,99,235,0.2)",color:"#2563eb",borderRadius:4,padding:"1px 6px"}}, c.bank),
                h("span", {style:{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}, new Date(c.ts).toLocaleDateString("pt-PT"))
              ),
              (c.simPt||c.realPt)&&h("div", {style:{display:"flex",gap:10,marginBottom:6}},
                c.simPt!=null&&c.simPt!==""&&Number.isFinite(Number(c.simPt))&&h("div", {style:{fontSize:11,background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:5,padding:"2px 8px",color:"#92400e"}}, "🧮 Simulado: "+Number(c.simPt).toFixed(2).replace(".",",")+"/mês"),
                c.realPt!=null&&c.realPt!==""&&Number.isFinite(Number(c.realPt))&&h("div", {style:{fontSize:11,background:"rgba(5,150,105,0.08)",border:"1px solid rgba(5,150,105,0.25)",borderRadius:5,padding:"2px 8px",color:"#065f46"}}, "✅ Real: "+Number(c.realPt).toFixed(2).replace(".",",")+"/mês")
              ),
              h("div", {style:{fontSize:13,color:"#374151",lineHeight:1.5}}, c.text),
              h("div", {style:{display:"flex",alignItems:"center",gap:8,marginTop:8}},
                h("button", {type:"button",onClick:function(){setReplyTo(replyTo===c.id?null:c.id);setReplyErr("");setReplyForm({name:"",text:""}); },style:{background:"rgba(37,99,235,0.08)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:6,color:"#2563eb",fontSize:11,fontWeight:700,padding:"4px 9px",cursor:"pointer",fontFamily:"sans-serif"}}, replyTo===c.id?"Cancelar":"Responder"),
                replyOk===c.id&&h("span", {style:{fontSize:11,color:"#059669"}}, "Resposta publicada!")
              ),
              replyTo===c.id&&h("form", {onSubmit:function(e){submitReply(e,c.id);},style:{marginTop:8,background:"rgba(37,99,235,0.04)",border:"1px solid rgba(37,99,235,0.14)",borderRadius:8,padding:10}},
                h("div", {style:{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8,marginBottom:8}},
                  h("input", {value:replyForm.name,onChange:function(e){setReplyForm(function(f){return Object.assign({},f,{name:e.target.value});});},placeholder:"Nome (opcional)",maxLength:50,style:{width:"100%",padding:"6px 8px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",boxSizing:"border-box"}}),
                  h("textarea", {value:replyForm.text,onChange:function(e){setReplyForm(function(f){return Object.assign({},f,{text:e.target.value});});},placeholder:"Escreve a tua resposta...",required:true,maxLength:500,rows:2,style:{width:"100%",padding:"6px 8px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",resize:"vertical",boxSizing:"border-box"}})
                ),
                replyErr&&h("div", {style:{fontSize:11,color:"#dc2626",marginBottom:8}}, "⚠️ "+replyErr),
                h("button", {type:"submit",disabled:replySubmit||replyForm.text.trim().length<5,style:{padding:"6px 13px",background:replySubmit?"rgba(0,0,0,0.05)":"#2563eb",border:"none",borderRadius:6,color:replySubmit?"#9b9b9b":"#ffffff",fontSize:12,fontWeight:700,cursor:replySubmit?"not-allowed":"pointer",fontFamily:"sans-serif"}}, replySubmit?"A responder...":"Publicar resposta")
              ),
              (c.replies||[]).length>0&&h("div", {style:{marginTop:10,marginLeft:14,paddingLeft:12,borderLeft:"2px solid rgba(37,99,235,0.16)"}}, c.replies.map(function(reply) {
                return h("div", {key:reply.id,style:{background:"rgba(37,99,235,0.035)",borderRadius:8,padding:"8px 10px",marginTop:8}},
                  h("div", {style:{display:"flex",alignItems:"baseline",gap:8,marginBottom:3}},
                    h("span", {style:{fontWeight:700,fontSize:12,color:"#111827"}}, reply.name),
                    h("span", {style:{fontSize:10,color:"#9ca3af",marginLeft:"auto"}}, new Date(reply.ts).toLocaleDateString("pt-PT"))
                  ),
                  h("div", {style:{fontSize:12,color:"#374151",lineHeight:1.5}}, reply.text)
                );
              }))
            );
          }))
        )
      )
    );
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

    var _sc = useState(false);
    var showComments = _sc[0];
    var setShowComments = _sc[1];

    useEffect(function () {
      var alive = true;
      fetch("/api/banks")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (raw) {
          if (!alive || !raw) return;
          try { setEUR(mergeEurFromApi(raw)); } catch (_) {}
        })
        .catch(function () {});
      return function () { alive = false; };
    }, []);

    return h(React.Fragment, null,
      h(window.ReverseCalcPage, {
        EUR: EUR,
        onBack: function () { window.location.href = "/"; },
        onOpenComments: function () { setShowComments(true); },
        onSimulate: function (cap, params) { window.location.href = buildSimUrl(cap, params); },
      }),
      showComments && h(CommentsModal, {onClose: function () { setShowComments(false); }})
    );
  }

  var el = document.getElementById("root");
  if (!el) return;
  var root = ReactDOM.createRoot(el);
  root.render(h(InversaRoot, null));
})();
