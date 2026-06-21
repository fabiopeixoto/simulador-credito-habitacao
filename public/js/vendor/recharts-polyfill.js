;(function(){
  'use strict';
  if(!window.React)return;
  var React=window.React;
  var h = React.createElement;

  // ResponsiveContainer: renders children in a div with width/height
  function ResponsiveContainer(props) {
    var style = {
      width: props.width || '100%',
      height: props.height || (props.aspect ? undefined : 300),
      position: 'relative'
    };
    if (props.aspect && !props.height) style.paddingBottom = (100 / props.aspect) + '%';
    return h('div', {style: style, className: props.className || ''},
      React.Children.map(props.children, function(child) {
        if (!child) return null;
        return React.cloneElement(child, {
          width: '100%',
          height: props.height || 300
        });
      })
    );
  }

  // Generic chart renderer using SVG
  function makeChart(type) {
    return function(props) {
      var W = typeof props.width === 'number' ? props.width : 500;
      var H = props.height || 300;
      var data = props.data || [];
      var margin = Object.assign({top:10, right:20, bottom:30, left:50}, props.margin||{});
      var innerW = W - margin.left - margin.right;
      var innerH = H - margin.top - margin.bottom;

      // Collect children info
      var bars = [], lines = [], xKey = null, yDomain = null;
      React.Children.forEach(props.children, function(child) {
        if (!child) return;
        var t = child.type;
        if (t === Bar || t === 'Bar') bars.push(child.props);
        if (t === Line || t === 'Line') lines.push(child.props);
        if (t === XAxis || t === 'XAxis') xKey = child.props.dataKey;
      });

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

      var svgParts = [];
      // Grid lines
      for (var g = 0; g <= 4; g++) {
        var gy = margin.top + Math.round(g * innerH / 4);
        svgParts.push('<line x1="' + margin.left + '" y1="' + gy + '" x2="' + (margin.left + innerW) + '" y2="' + gy + '" stroke="rgba(0,0,0,0.04)" stroke-width="0.5"/>');
        var lv = maxV - (maxV - minV) * g / 4;
        svgParts.push('<text x="' + (margin.left - 4) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="9" fill="#4b5563" font-family="monospace">' + (lv >= 1000 ? Math.round(lv/1000) + 'k' : Math.round(lv)) + '</text>');
      }
      // Bars
      data.forEach(function(d, i) {
        bars.forEach(function(b, bi) {
          var v = +d[b.dataKey] || 0;
          var bh = Math.max(1, Math.round((v - minV) / (maxV - minV || 1) * innerH));
          var bx = toX(i, bi, bars.length) - bw / 2;
          var by = margin.top + innerH - bh;
          var fill = b.fill || '#2563eb';
          // Cell support
          if (b.children) {
            var cells = React.Children.toArray(b.children);
            if (cells[i] && cells[i].props && cells[i].props.fill) fill = cells[i].props.fill;
          }
          svgParts.push('<rect x="' + Math.round(bx) + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="2" fill="' + fill + '" opacity="' + (b.opacity||0.85) + '"/>');
        });
        // X labels
        if (xKey && d[xKey] != null) {
          var lx = margin.left + gap * i + gap / 2;
          svgParts.push('<text x="' + Math.round(lx) + '" y="' + (H - margin.bottom + 14) + '" text-anchor="middle" font-size="9" fill="#4b5563" font-family="monospace">' + d[xKey] + '</text>');
        }
      });
      // Lines
      lines.forEach(function(l) {
        var pts = data.map(function(d, i) {
          var cx = margin.left + gap * i + gap / 2;
          return cx + ',' + toY(+d[l.dataKey] || 0);
        }).join(' ');
        svgParts.push('<polyline points="' + pts + '" fill="none" stroke="' + (l.stroke || '#2563eb') + '" stroke-width="' + (l.strokeWidth || 2) + '" stroke-linejoin="round"/>');
        // Dots
        data.forEach(function(d, i) {
          var cx = margin.left + gap * i + gap / 2;
          var cy = toY(+d[l.dataKey] || 0);
          svgParts.push('<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + (l.stroke || '#2563eb') + '"/>');
        });
      });

      var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" style="overflow:visible">' + svgParts.join('') + '</svg>';
      return h('div', {
        style: {width: '100%', height: H + 'px', overflow: 'visible'},
        dangerouslySetInnerHTML: {__html: svgStr}
      });
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
