/* exportAuditPDF(state): multi-page audit report.
   Page 1: branded header, company profile, composite score, executive summary, routing.
   Page 2+: every evaluated flag with status, Y1–Y3 values, threshold and source.
   Uses jsPDF + autoTable (loaded from cdnjs). If they could not load, opens a print-ready report instead. */
(function () {
  const F = () => window.RF_FMT;
  const strip = h => h.replace(/<[^>]+>/g, '');
  const COL = { G: [16, 185, 129], Y: [245, 158, 11], R: [239, 68, 68], GREY_OK: [100, 116, 139], GREY_NOT_OK: [249, 115, 22], PENDING: [100, 116, 139] };

  function rows(state) {
    return state.cards.map(c => {
      const r = c.res, ys = state.co.years;
      return [c.flag.id, c.flag.catName, c.flag.name + (c.flag._dupOf ? ' (duplicate of ' + c.flag._dupOf + ')' : ''), F().STATUS[r.status].label,
        ...ys.map(y => r.vals ? F().metric(r.vals[y], r.fmt) : '—'),
        'G: ' + c.flag.g + ' | R: ' + c.flag.r,
        r.status.startsWith('GREY') ? 'Missing: ' + (r.missing || []).join(', ') : window.RF.sourceOf(c.flag)];
    });
  }

  function viaJsPDF(state) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), co = state.co, sc = state.sc;
    doc.setFillColor(8, 11, 16); doc.rect(0, 0, W, 70, 'F');
    doc.setTextColor(255, 77, 77); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('RedFlag Terminal', 40, 42);
    doc.setTextColor(200, 205, 215); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Forensic Audit Report · generated ' + new Date().toISOString().slice(0, 10), W - 40, 42, { align: 'right' });
    doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text(`${co.ticker} — ${co.name}`, 40, 110);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
    doc.text(`SIC ${co.sic} ${co.sicName || ''} · ${co.form || '10-K'} ${co.fiscalYear} filed ${co.filed} · CIK ${co.cik}`, 40, 128);
    doc.text(`Profile: ${state.profileText}`, 40, 144);
    if (co.quote && co.quote.price) doc.text(`Price $${co.quote.price.toFixed(2)}${co.quote.marketCap ? ' · Market cap ' + F().big(co.quote.marketCap) : ''} (Yahoo Finance)`, 40, 160);
    const col = sc.score == null ? [100, 116, 139] : sc.score >= 80 ? COL.G : sc.score >= 60 ? COL.Y : COL.R;
    doc.setFillColor(...col); doc.roundedRect(40, 178, 120, 70, 8, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(30);
    doc.text(sc.score == null ? '—' : String(sc.score), 100, 222, { align: 'center' });
    doc.setFontSize(9); doc.text('HEALTH SCORE / 100', 100, 240, { align: 'center' });
    doc.setTextColor(40, 40, 40); doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(`${sc.G} Green · ${sc.Y} Yellow · ${sc.R} Red · ${sc.greyOk} N/A · ${sc.greyNotOk} Disclosure alerts`, 180, 205);
    doc.text(`Coverage ${Math.round(sc.coverage * 100)}% of ${sc.counted} unique flags (${sc.total} routed${sc.dup ? ', ' + sc.dup + ' duplicates counted once' : ''})`, 180, 222);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Executive summary', 40, 280);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    let y = 298;
    state.summary.forEach(b => { const lines = doc.splitTextToSize('• ' + strip(b), W - 80); doc.text(lines, 40, y); y += lines.length * 13 + 6; });
    doc.autoTable({ startY: y + 8, head: [['Cat', 'Master category', 'Active source', 'Flags']],
      body: Object.entries(state.plan).map(([c, s]) => [c.slice(4), state.catName[c], s.join(' + '), state.cards.filter(x => x.flag.cat === c).length]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [15, 19, 28] } });
    doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 20, 20); doc.text('Itemized forensic flags', 40, 40);
    doc.autoTable({ startY: 52, head: [['ID', 'Category', 'Flag', 'Status', ...state.co.years.map(y => 'FY' + y), 'Thresholds', 'Source']],
      body: rows(state), styles: { fontSize: 6.5, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: [15, 19, 28] },
      columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 60 }, 2: { cellWidth: 95 }, 3: { cellWidth: 48 }, 7: { cellWidth: 80 }, 8: { cellWidth: 62 } },
      didParseCell: d => { if (d.section === 'body' && d.column.index === 3) { const st = state.cards[d.row.index].res.status; d.cell.styles.textColor = COL[st]; d.cell.styles.fontStyle = 'bold'; } } });
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
      doc.text('© 2026 RedFlag Terminal. For informational purposes only — not investment advice. Data prioritized via SEC EDGAR XBRL, Yahoo Finance, and Benchmark Feeds.', 40, doc.internal.pageSize.getHeight() - 20);
      doc.text(`Page ${i} of ${pages}`, W - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' }); }
    doc.save(`RedFlag_${co.ticker}_${co.fiscalYear}_Audit.pdf`);
  }

  function viaPrint(state) {
    const e = F().esc, co = state.co, sc = state.sc;
    const html = `<!DOCTYPE html><html><head><title>RedFlag ${e(co.ticker)} Audit</title><style>
      body{font:11px/1.4 Helvetica,Arial,sans-serif;color:#111;margin:32px}h1{color:#E53E3E;margin:0}table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border-bottom:1px solid #ddd;padding:4px 5px;text-align:left;vertical-align:top}th{background:#0F131C;color:#fff}.pb{page-break-before:always}
      .G{color:#10B981}.Y{color:#F59E0B}.R{color:#EF4444}.GREY_OK{color:#64748B}.GREY_NOT_OK{color:#F97316}.foot{margin-top:24px;color:#777;font-size:9px}</style></head><body>
      <h1>RedFlag Terminal — Forensic Audit Report</h1><h2>${e(co.ticker)} — ${e(co.name)}</h2>
      <p>SIC ${e(co.sic)} ${e(co.sicName || '')} · ${e(co.form || '10-K')} ${e(co.fiscalYear)} filed ${e(co.filed)}<br>Profile: ${e(state.profileText)}</p>
      <p><b style="font-size:22px">${sc.score == null ? '—' : sc.score}/100</b> · ${sc.G} Green · ${sc.Y} Yellow · ${sc.R} Red · ${sc.greyOk} N/A · ${sc.greyNotOk} Disclosure alerts</p>
      <h3>Executive summary</h3><ul>${state.summary.map(b => '<li>' + b + '</li>').join('')}</ul>
      <div class="pb"></div><h3>Itemized flags</h3><table><tr><th>ID</th><th>Category</th><th>Flag</th><th>Status</th>${co.years.map(y => '<th>FY' + y + '</th>').join('')}<th>Source</th></tr>
      ${rows(state).map((r, i) => `<tr>${r.map((c, j) => j === 7 ? '' : `<td class="${j === 3 ? state.cards[i].res.status : ''}">${e(c)}</td>`).join('')}</tr>`).join('')}</table>
      <p class="foot">© 2026 RedFlag Terminal. For informational purposes only — not investment advice. Data prioritized via SEC EDGAR XBRL, Yahoo Finance, and Benchmark Feeds.</p>
      <script>window.onload=()=>window.print()<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); return true; }
    return false;
  }

  window.exportAuditPDF = function (state) {
    if (!state || !state.cards) return { ok: false, msg: 'Analyze a ticker first.' };
    try {
      if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) { viaJsPDF(state); return { ok: true, msg: 'PDF downloaded.' }; }
    } catch (e) { console.error(e); }
    return viaPrint(state) ? { ok: true, msg: 'PDF library unavailable — opened a print-ready report (choose "Save as PDF").' } : { ok: false, msg: 'Pop-up blocked — allow pop-ups to export.' };
  };
})();
