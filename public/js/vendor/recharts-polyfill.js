;(function(){
  'use strict';
  if(!window.React)return;
  var React=window.React;
  var h = React.createElement;

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ResponsiveContainer: measures its real pixel width and passes it (as a number)
  // down to the chart so the SVG fills the available horizontal space.
  function ResponsiveContainer(props) {
    var ref = React.useRef(null);
    var _w = React.useState(0); var w = _w[0]; var setW = _w[1];
    React.useLayoutEffect(function(){
      function measure(){ if(ref.current){ var cw=ref.current.clientWidth; if(cw && cw!==w) setW(cw); } }
      measure();
      var ro=null;
      if(typeof window.ResizeObserver!=='undefined'){
        ro=new window.ResizeObserver(measure);
        if(ref.current) ro.observe(ref.current);
      }
      window.addEventListener('resize',measure,{passive:true});
      return function(){ window.removeEventListener('resize',measure); if(ro) ro.disconnect(); };
    },[]);
    var H = props.height || (props.aspect ? undefined : 300);
    var style = { width: props.width || '100%', height: H, position: 'relative' };
    if (props.aspect && !props.height) style.paddingBottom = (100 / props.aspect) + '%';
    return h('div', {ref: ref, style: style, className: props.className || ''},
      w > 0 ? React.Children.map(props.children, function(child) {
        if (!child) return null;
        return React.cloneElement(child, { width: w, height: H || 300 });
      }) : null
    );
  }

  // Generic chart renderer using SVG
  function makeChart(type) {
    return function(props) {
      var W = typeof props.width === 'number' ? props.width : 500;
      var Htot = props.height || 300;
      var data = props.data || [];

      // Índice do ponto sob o rato (-1 = nenhum) para o tooltip.
      var _hv = React.useState(-1); var hover = _hv[0]; var setHover = _hv[1];

      // Collect children info
      var bars = [], lines = [], xKey = null, hasLegend = false, hasTooltip = false;
      var xAxis = null, yAxis = null, tooltipProps = null;
      React.Children.forEach(props.children, function(child) {
        if (!child) return;
        var t = child.type;
        if (t === Bar || t === 'Bar') bars.push(child.props);
        if (t === Line || t === 'Line') lines.push(child.props);
        if (t === XAxis || t === 'XAxis') { xKey = child.props.dataKey; xAxis = child.props; }
        if (t === YAxis || t === 'YAxis') { yAxis = child.props; }
        if (t === Legend || t === 'Legend') { hasLegend = true; }
        if (t === Tooltip || t === 'Tooltip') { hasTooltip = true; tooltipProps = child.props; }
      });

      // Legend entries (name + colour) from Lines/Bars
      var legendItems = [];
      lines.forEach(function(l){ legendItems.push({name: l.name || l.dataKey, color: l.stroke || '#2563eb'}); });
      bars.forEach(function(b){ legendItems.push({name: b.name || b.dataKey, color: b.fill || '#2563eb'}); });
      var showLegend = hasLegend && legendItems.length > 0;
      var legendH = showLegend ? 26 : 0;
      var H = Htot - legendH;

      var margin = Object.assign({top:10, right:20, bottom:30, left:50}, props.margin||{});
      // Garantir espaço mínimo à esquerda para os rótulos do eixo Y não serem cortados.
      if (margin.left < 38) margin.left = 38;
      var innerW = W - margin.left - margin.right;
      var innerH = H - margin.top - margin.bottom;

      // Compute value range
      var allVals = [];
      data.forEach(function(d) {
        bars.forEach(function(b) { if(d[b.dataKey] != null) allVals.push(+d[b.dataKey]); });
        lines.forEach(function(l) { if(d[l.dataKey] != null) allVals.push(+d[l.dataKey]); });
      });
      var minV = 0, maxV = Math.max.apply(null, allVals.concat([1]));

      var n = data.length;
      var bw = bars.length > 0 ? Math.max(4, Math.floor(innerW / n * 0.6)) : 0;
      var gap = n > 0 ? innerW / n : innerW;

      var toY = function(v) { return margin.top + innerH - Math.round((v - minV) / (maxV - minV || 1) * innerH); };
      var toX = function(i, bi, nb) {
        var cx = margin.left + gap * i + gap / 2;
        if (nb > 1) cx += (bi - (nb-1)/2) * (bw + 2);
        return cx;
      };

      var yFmt = (yAxis && typeof yAxis.tickFormatter === 'function') ? yAxis.tickFormatter
               : function(v){ return v >= 1000 ? Math.round(v/1000) + 'k' : Math.round(v); };
      var xFmt = (xAxis && typeof xAxis.tickFormatter === 'function') ? xAxis.tickFormatter
               : function(v){ return v; };

      var svgParts = [];
      // Grid lines + Y labels
      for (var g = 0; g <= 4; g++) {
        var gy = margin.top + Math.round(g * innerH / 4);
        svgParts.push('<line x1="' + margin.left + '" y1="' + gy + '" x2="' + (margin.left + innerW) + '" y2="' + gy + '" stroke="rgba(0,0,0,0.04)" stroke-width="0.5"/>');
        var lv = maxV - (maxV - minV) * g / 4;
        svgParts.push('<text x="' + (margin.left - 6) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="10" fill="#4b5563" font-family="sans-serif">' + esc(yFmt(Math.round(lv))) + '</text>');
      }
      // X axis line
      var showXAxisLine = !(xAxis && xAxis.axisLine === false);
      if (showXAxisLine) {
        svgParts.push('<line x1="' + margin.left + '" y1="' + (margin.top + innerH) + '" x2="' + (margin.left + innerW) + '" y2="' + (margin.top + innerH) + '" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>');
      }
      var xTicksFilter = xAxis && Array.isArray(xAxis.ticks) ? xAxis.ticks : null;
      var showTickLines = !(xAxis && xAxis.tickLine === false);

      // Bars
      data.forEach(function(d, i) {
        bars.forEach(function(b, bi) {
          var v = +d[b.dataKey] || 0;
          var bh = Math.max(1, Math.round((v - minV) / (maxV - minV || 1) * innerH));
          var bx = toX(i, bi, bars.length) - bw / 2;
          var by = margin.top + innerH - bh;
          var fill = b.fill || '#2563eb';
          if (b.children) {
            var cells = React.Children.toArray(b.children);
            if (cells[i] && cells[i].props && cells[i].props.fill) fill = cells[i].props.fill;
          }
          svgParts.push('<rect x="' + Math.round(bx) + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="2" fill="' + fill + '" opacity="' + (b.opacity||0.85) + '"/>');
        });
        // X labels (filtered by ticks if specified)
        if (xKey && d[xKey] != null) {
          var showLabel = !xTicksFilter || xTicksFilter.indexOf(d[xKey]) >= 0;
          if (showLabel) {
            var lx = Math.round(margin.left + gap * i + gap / 2);
            var axisY = margin.top + innerH;
            if (showTickLines) {
              svgParts.push('<line x1="' + lx + '" y1="' + axisY + '" x2="' + lx + '" y2="' + (axisY + 4) + '" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>');
            }
            svgParts.push('<text x="' + lx + '" y="' + (H - margin.bottom + 16) + '" text-anchor="middle" font-size="10" fill="#4b5563" font-family="sans-serif">' + esc(xFmt(d[xKey])) + '</text>');
          }
        }
      });
      // Lines
      lines.forEach(function(l) {
        var pts = data.map(function(d, i) {
          var cx = margin.left + gap * i + gap / 2;
          return cx + ',' + toY(+d[l.dataKey] || 0);
        }).join(' ');
        svgParts.push('<polyline points="' + pts + '" fill="none" stroke="' + (l.stroke || '#2563eb') + '" stroke-width="' + (l.strokeWidth || 2) + '" stroke-linejoin="round"/>');
        // Dots (a menos que dot:false)
        if (l.dot !== false) {
          data.forEach(function(d, i) {
            var cx = margin.left + gap * i + gap / 2;
            var cy = toY(+d[l.dataKey] || 0);
            svgParts.push('<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + (l.stroke || '#2563eb') + '"/>');
          });
        }
      });

      var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" style="display:block">' + svgParts.join('') + '</svg>';
      var svgDiv = h('div', {
        key: 'svg',
        style: {width: '100%', height: H + 'px'},
        dangerouslySetInnerHTML: {__html: svgStr}
      });

      // ── Camada interativa (tooltip ao passar o rato) ──
      var cxAt = function(i){ return margin.left + gap * i + gap / 2; };
      var series = lines.map(function(l){ return {name: l.name || l.dataKey, key: l.dataKey, color: l.stroke || '#2563eb'}; })
        .concat(bars.map(function(b){ return {name: b.name || b.dataKey, key: b.dataKey, color: b.fill || '#2563eb'}; }));

      var overlayChildren = [];
      var enableHover = hasTooltip && n > 0 && series.length > 0;
      if (enableHover) {
        // Área transparente que captura o movimento do rato sobre o gráfico.
        overlayChildren.push(h('div', {
          key: 'hot',
          style: {position:'absolute', left:0, top:0, width:'100%', height:H+'px', cursor:'crosshair'},
          onMouseMove: function(e){
            var rect = e.currentTarget.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var i = Math.round((x - margin.left - gap/2) / gap);
            if (i < 0) i = 0; if (i > n-1) i = n-1;
            if (i !== hover) setHover(i);
          },
          onMouseLeave: function(){ setHover(-1); }
        }));

        if (hover >= 0 && hover < n) {
          var hx = cxAt(hover);
          var d = data[hover];
          // Linha vertical de referência
          overlayChildren.push(h('div', {
            key: 'cursor',
            style: {position:'absolute', left:hx+'px', top:margin.top+'px', width:'1px', height:innerH+'px', background:'rgba(0,0,0,0.18)', pointerEvents:'none'}
          }));
          // Pontos destacados sobre cada série
          series.forEach(function(s, si){
            if (d[s.key] == null) return;
            var cy = toY(+d[s.key]);
            overlayChildren.push(h('div', {
              key: 'pt'+si,
              style: {position:'absolute', left:(hx-4)+'px', top:(cy-4)+'px', width:'8px', height:'8px', borderRadius:'50%', background:'#fff', border:'2px solid '+s.color, pointerEvents:'none'}
            }));
          });
          // Caixa do tooltip
          var labelRaw = (xKey && d[xKey] != null) ? d[xKey] : hover;
          var labelTxt = (tooltipProps && typeof tooltipProps.labelFormatter === 'function')
            ? tooltipProps.labelFormatter(labelRaw) : String(labelRaw);
          var rows = series.map(function(s, si){
            var raw = d[s.key];
            var valTxt = String(raw), nameTxt = s.name;
            if (tooltipProps && typeof tooltipProps.formatter === 'function') {
              var r = tooltipProps.formatter(raw, s.name);
              if (Array.isArray(r)) { valTxt = r[0]; if (r[1] != null) nameTxt = r[1]; }
              else if (r != null) { valTxt = r; }
            }
            return h('div', {key:si, style:{display:'flex', alignItems:'center', gap:'6px', marginTop: si? 3:0}},
              h('span', {style:{width:9, height:9, borderRadius:2, background:s.color, display:'inline-block', flexShrink:0}}),
              h('span', {style:{color:'#374151'}}, nameTxt+': '),
              h('strong', {style:{color:'#111827'}}, valTxt)
            );
          });
          var flip = hx > W * 0.6;
          var tipStyle = Object.assign({
            position:'absolute', top:Math.max(margin.top, 4)+'px',
            background:'#ffffff', border:'1px solid rgba(37,99,235,0.5)', borderRadius:'8px',
            padding:'7px 9px', fontFamily:'sans-serif', fontSize:'12px', color:'#111827',
            boxShadow:'0 2px 8px rgba(0,0,0,0.12)', pointerEvents:'none', whiteSpace:'nowrap', zIndex:5
          }, tooltipProps && tooltipProps.contentStyle ? tooltipProps.contentStyle : {});
          tipStyle.left = (flip ? hx - 12 : hx + 12) + 'px';
          tipStyle.transform = flip ? 'translateX(-100%)' : 'none';
          overlayChildren.push(h('div', {key:'tip', style: tipStyle},
            h('div', {style:{fontWeight:700, marginBottom:4, color:'#111827'}}, labelTxt),
            rows
          ));
        }
      }

      var chartDiv = h('div', {
        key: 'chart',
        style: {position:'relative', width: '100%', height: H + 'px'}
      }, svgDiv, overlayChildren);

      if (!showLegend) return chartDiv;

      var legendDiv = h('div', {
        key: 'legend',
        style: {display:'flex', flexWrap:'wrap', justifyContent:'center', alignItems:'center', gap:'14px', height: legendH + 'px', fontFamily:'sans-serif', fontSize:12, color:'#374151'}
      }, legendItems.map(function(it, idx){
        return h('span', {key: idx, style: {display:'inline-flex', alignItems:'center', gap:'5px'}},
          h('span', {style: {width:11, height:11, borderRadius:2, background: it.color, display:'inline-block', flexShrink:0}}),
          h('span', null, it.name)
        );
      }));
      return h('div', {style: {width:'100%', height: Htot + 'px'}}, chartDiv, legendDiv);
    };
  }

  function Bar(props) { return null; }
  function Line(props) { return null; }
  function XAxis(props) { return null; }
  function YAxis(props) { return null; }
  function CartesianGrid(props) { return null; }
  function Tooltip(props) { return null; }
  function Legend(props) { return null; }
  function Cell(props) { return null; }

  var BarChart = makeChart('bar');
  var LineChart = makeChart('line');

  window.Recharts={
    BarChart: BarChart, Bar: Bar,
    LineChart: LineChart, Line: Line,
    XAxis: XAxis, YAxis: YAxis,
    CartesianGrid: CartesianGrid, Tooltip: Tooltip,
    Legend: Legend, ResponsiveContainer: ResponsiveContainer, Cell: Cell
  };
})();
