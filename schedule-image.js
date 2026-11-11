/* A4 300dpi, two identical calendars for cutting and distribution. */
(function (root) {
  'use strict';
  var W = 595.28, H = 841.89, M = 28, CW = W - M * 2;
  var colors = [['#eaf4ed', '#2e7046'], ['#f1ebfa', '#7542a5'], ['#e9f1fb', '#30649b']];
  var ink = '#20344d', muted = '#708095', line = '#d6dfe8';
  function model(input) {
    var days = new Date(input.year, input.month, 0).getDate();
    var first = new Date(input.year, input.month - 1, 1).getDay();
    var people = Array.from(new Set(input.people || [])), totals = {}, cells = [], notes = [];
    for (var d = 1; d <= days; d++) {
      var row = input.data[d] || {}, work = [];
      input.slots.forEach(function (slot, i) {
        var value = row[slot.key] || {};
        if (!value.worker || (slot.leave && (value.leave || value.trip))) return;
        if (!people.includes(value.worker)) people.push(value.worker);
        if (!totals[value.worker]) totals[value.worker] = input.slots.map(function () { return 0; });
        totals[value.worker][i]++;
        work.push({ index: i, worker: value.worker });
      });
      cells.push({ day: d, work: work });
      var note = String(row.note || '').trim();
      if (note) {
        var prev = notes[notes.length - 1];
        if (prev && prev.end === d - 1 && prev.text === note) prev.end = d;
        else notes.push({ start: d, end: d, text: note });
      }
    }
    return Object.assign({}, input, { days: days, first: first, weeks: Math.ceil((first + days) / 7),
      people: people, totals: totals, cells: cells, notes: notes });
  }
  function font(ctx, size, bold) { ctx.font = (bold ? '600 ' : '400 ') + size + 'px "Noto Sans KR", "Malgun Gothic", sans-serif'; }
  function text(ctx, value, x, y, size, color, bold, align, maxWidth) {
    font(ctx, size, bold); ctx.fillStyle = color || ink; ctx.textAlign = align || 'left';
    ctx.fillText(String(value), x, y, maxWidth || CW); ctx.textAlign = 'left';
  }
  function rule(ctx, y) { ctx.strokeStyle = line; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); }
  function wrap(ctx, value, width) {
    var result = [];
    String(value).split(/\r?\n/).forEach(function (paragraph) {
      var current = '';
      Array.from(paragraph).forEach(function (ch) {
        if (current && ctx.measureText(current + ch).width > width) { result.push(current); current = ''; }
        current += ch;
      });
      result.push(current);
    });
    return result;
  }
  function noteLines(ctx, m) {
    font(ctx, 9, false);
    if (!m.notes.length) return ['등록된 비고가 없습니다.'];
    var lines = [];
    m.notes.forEach(function (n) {
      var date = m.month + '/' + n.start + (n.end === n.start ? '' : '–' + n.end);
      wrap(ctx, date + '  ' + n.text, CW - 36).forEach(function (s) { lines.push(s); });
    });
    return lines;
  }
  function heading(ctx, m, continued) {
    text(ctx, m.center + '사무소 근무표', M, 40, 19, ink, true);
    text(ctx, m.year + '년 ' + m.month + '월' + (continued ? ' · 비고 계속' : ''), W - M, 39, 13, ink, true, 'right');
  }
  function calendar(ctx, m) {
    heading(ctx, m, false);
    var gap = 8, legendW = (CW - gap * (m.slots.length - 1)) / m.slots.length;
    m.slots.forEach(function (s, i) {
      var c = colors[i % colors.length], x = M + i * (legendW + gap);
      ctx.fillStyle = c[0]; ctx.fillRect(x, 54, legendW, 23);
      text(ctx, s.key.toUpperCase() + '  ' + s.time, x + legendW / 2, 70, 10, c[1], true, 'center', legendW - 12);
    });
    var top = 87, dayH = 20, rowH = Math.min(49, 235 / m.weeks), colW = CW / 7;
    ['일', '월', '화', '수', '목', '금', '토'].forEach(function (s, i) {
      text(ctx, s, M + (i + .5) * colW, top + 13, 9, i === 0 ? '#ba4141' : i === 6 ? '#376bab' : muted, true, 'center');
    });
    for (var r = 0; r < m.weeks; r++) {
      for (var c = 0; c < 7; c++) {
        var x = M + c * colW, y = top + dayH + r * rowH;
        var day = r * 7 + c - m.first + 1;
        ctx.fillStyle = day < 1 || day > m.days ? '#f8fafc' : '#ffffff';
        ctx.fillRect(x, y, colW, rowH);
        ctx.strokeStyle = line; ctx.lineWidth = .6; ctx.strokeRect(x, y, colW, rowH);
        if (day < 1 || day > m.days) continue;
        text(ctx, day, x + 6, y + 12, 9, c === 0 ? '#ba4141' : c === 6 ? '#376bab' : ink, true);
        var badgeH = Math.min(14, (rowH - 17) / m.slots.length);
        m.cells[day - 1].work.forEach(function (work, j) {
          var color = colors[work.index % colors.length], by = y + 15 + j * badgeH;
          ctx.fillStyle = color[0]; ctx.fillRect(x + 5, by, colW - 10, badgeH - 1);
          text(ctx, m.slots[work.index].key.toUpperCase() + '  ' + work.worker,
            x + colW / 2, by + (badgeH - 1) / 2 + 2.8, Math.min(9, badgeH - 2), color[1], true, 'center', colW - 15);
        });
      }
    }
    var bottom = top + dayH + m.weeks * rowH;
    rule(ctx, bottom + 9);
    return bottom + 26;
  }
  function render(input, createCanvas) {
    var m = model(input), measure = createCanvas(1, 1).getContext('2d');
    var notes = noteLines(measure, m), pages = [], offset = 0;
    do {
      var canvas = createCanvas(2480, 3508), ctx = canvas.getContext('2d');
      ctx.scale(2480 / W, 3508 / H); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      var page = pages.length, start = page ? 72 : calendarStart();
      function calendarStart() {
        // Measure the footer position without mutating the page canvas.
        var scratch = createCanvas(1, 1).getContext('2d'); return calendar(scratch, m);
      }
      var capacity = Math.max(1, Math.floor((H / 2 - 24 - start) / 13));
      var take = Math.min(notes.length - offset, capacity);
      var more = offset + take < notes.length;
      if (more && take > 1) take--; // Reserve a line for the continuation notice.
      for (var copy = 0; copy < 2; copy++) {
        ctx.save(); ctx.translate(0, copy * H / 2);
        if (page) heading(ctx, m, true); else calendar(ctx, m);
        text(ctx, '비고', M + 5, start, 9, ink, true);
        notes.slice(offset, offset + take).forEach(function (s, i) { text(ctx, s, M + 36, start + i * 13, 9, muted); });
        if (more) text(ctx, '※ 비고는 다음 장에 이어집니다.', M + 36, start + take * 13, 8, muted);
        if (page) text(ctx, '비고 별지 ' + page, W - M, H / 2 - 19, 8, muted, false, 'right');
        ctx.restore();
      }
      ctx.save(); ctx.strokeStyle = '#aab5c0'; ctx.lineWidth = .65; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(15, H / 2); ctx.lineTo(W - 15, H / 2); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 24, H / 2 - 6, 48, 12);
      text(ctx, '자르는 선', W / 2, H / 2 + 3, 7, muted, false, 'center');
      pages.push(canvas); offset += take;
    } while (offset < notes.length);
    return pages;
  }
  // Canvas PNGs default to 96dpi. Replace their pHYs chunk with 300dpi for A4 printing.
  async function png300(canvas) {
    var blob = await new Promise(function (resolve, reject) { canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('PNG 생성 실패')); }, 'image/png'); });
    var bytes = new Uint8Array(await blob.arrayBuffer()), chunk = new Uint8Array(21), dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4); dv.setUint32(8, 11811); dv.setUint32(12, 11811); chunk[16] = 1;
    var crc = 0xffffffff;
    for (var i = 4; i < 17; i++) { crc ^= chunk[i]; for (var b = 0; b < 8; b++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    dv.setUint32(17, (crc ^ 0xffffffff) >>> 0);
    var parts = [bytes.slice(0, 33), chunk], pos = 33, view = new DataView(bytes.buffer);
    while (pos < bytes.length) {
      var length = view.getUint32(pos) + 12;
      if (String.fromCharCode.apply(null, bytes.slice(pos + 4, pos + 8)) !== 'pHYs') parts.push(bytes.slice(pos, pos + length));
      pos += length;
    }
    return new Blob(parts, { type: 'image/png' });
  }
  // <a download> with a blob URL is ignored by most mobile and in-app browsers.
  async function saveOnMobile(event, link) {
    if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
    event.preventDefault();
    try {
      var blob = await (await fetch(link.href)).blob();
      var file = new File([blob], link.download, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: link.download });
        return;
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
    window.open(link.href, '_blank');
    showToast('새 창의 그림을 길게 눌러 저장해 주세요.');
  }
  async function downloadScheduleImage() {
    var button = document.getElementById('schImageButton');
    if (button.disabled) return;
    var label = button.textContent;
    var input = { year: SCH_YEAR, month: schMonth, center: centerLabel(), people: SCH_INSPECTORS.slice(),
      slots: getSlots().map(function (s) { return Object.assign({}, s); }), data: collectSchData(schMonth) };
    button.disabled = true; button.textContent = '그림 생성 중…';
    try {
      if (document.fonts) await document.fonts.ready;
      var canvases = render(input, function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
      var urls = await Promise.all(canvases.map(async function (c) { return URL.createObjectURL(await png300(c)); }));
      var dialog = document.createElement('dialog');
      dialog.style.cssText = 'margin:auto;width:780px;max-width:96vw;max-height:94vh;border:1px solid #d6dfe8;border-radius:12px;padding:20px;background:#f4f6f8;color:#20344d;';
      var title = document.createElement('h2'); title.textContent = input.month + '월 근무표 그림'; title.style.cssText = 'font-size:18px;margin-bottom:6px'; dialog.appendChild(title);
      var hint = document.createElement('p'); hint.textContent = 'A4 세로 · 300dpi · 한 장에 2부 · 가운데 절취선' + (urls.length > 1 ? ' / 비고 별지를 함께 저장해 주세요.' : ''); hint.style.cssText = 'font-size:12px;margin-bottom:14px'; dialog.appendChild(hint);
      var close = document.createElement('button'); close.className = 'btn btn-surface'; close.textContent = '닫기'; close.style.cssText = 'position:absolute;right:20px;top:16px'; close.onclick = function () { dialog.close(); }; dialog.appendChild(close);
      urls.forEach(function (url, i) {
        var link = document.createElement('a'); link.className = 'btn btn-dl'; link.href = url;
        link.download = input.year + '년_' + input.month + '월_' + input.center + '사무소_근무표_A4_2부' + (i ? '_비고' + i : '') + '.png';
        link.textContent = i ? '비고 별지 ' + i + ' 저장' : '그림 저장 (PNG)'; link.style.cssText = 'margin-bottom:12px;text-decoration:none'; dialog.appendChild(link);
        link.addEventListener('click', function (event) { saveOnMobile(event, link); });
        var img = document.createElement('img'); img.src = url; img.alt = input.month + '월 근무표 A4 두 부' + (i ? ' 비고 별지' : ''); img.style.cssText = 'display:block;width:100%;height:auto;margin-bottom:18px;box-shadow:0 1px 8px #20344d18'; dialog.appendChild(img);
      });
      dialog.addEventListener('close', function () { urls.forEach(function (url) { URL.revokeObjectURL(url); }); dialog.remove(); button.focus(); }, { once: true });
      document.body.appendChild(dialog); dialog.showModal();
    } catch (error) { console.error(error); showToast('그림을 생성하지 못했습니다. 다시 시도해 주세요.'); }
    finally { button.disabled = false; button.textContent = label; }
  }
  root.ScheduleImage = { model: model, render: render, png300: png300 };
  root.downloadScheduleImage = downloadScheduleImage;
})(typeof window !== 'undefined' ? window : globalThis);
