(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const screen = $('screen');
  const state = { step: 'welcome', language: 'English', method: '', reference: '', seat: '31A', bags: 0, declared: false, error: '', busy: false, seatStart: 30 };
  let returnStep = null, timer = null, started = Date.now();
  const languages = ['English', '日本語', '简体中文'];
  const translations = {
    'Welcome': ['ようこそ', '欢迎'], 'Welcome to ANA': ['ANAへようこそ', '欢迎乘坐ANA'],
    'Self-service check-in': ['自動チェックイン', '自助值机'], 'International flights': ['国際線', '国际航班'],
    'Touch to begin': ['画面にタッチして開始', '点击开始'], 'Continue': ['次へ', '继续'], 'Back': ['戻る', '返回'], 'Cancel': ['取消', '取消'], 'Help': ['ヘルプ', '帮助'],
    'Select your language.': ['言語を選択してください。', '请选择您的语言。'], 'Language': ['言語', '语言'],
    'Identification': ['予約検索', '预订查询'], 'Please select a method to retrieve your booking.': ['予約の検索方法を選択してください。', '请选择查询预订的方式。'],
    'Booking Reference': ['予約番号', '预订编号'], 'E-Ticket Number': ['航空券番号', '电子机票号码'], 'Frequent Flyer': ['マイレージカード', '常旅客卡'], 'Passport': ['パスポート', '护照'], 'Boarding Pass Barcode': ['搭乗券バーコード', '登机牌条形码'],
    'Please enter your booking reference.': ['予約番号を入力してください。', '请输入您的预订编号。'], 'Your booking reference': ['予約番号', '预订编号'],
    'Delete': ['削除', '删除'], 'Space': ['スペース', '空格'], 'Reservation confirmation': ['予約内容確認', '确认预订'],
    'Please confirm your passenger and flight details.': ['お客様とフライト情報をご確認ください。', '请确认旅客及航班信息。'],
    'Seat Map': ['座席表', '座位图'], 'Please select your desired seat.': ['ご希望の座席を選択してください。', '请选择您需要的座位。'],
    'Checked baggage': ['お預け手荷物', '托运行李'], 'How many bags will you check in?': ['お預けになる手荷物の個数を選択してください。', '您需要托运几件行李？'],
    'Dangerous goods': ['危険物の確認', '危险品确认'], 'Please confirm before you continue.': ['次に進む前にご確認ください。', '请在继续前确认。'],
    'I confirm that my checked bags do not contain the prohibited items shown above.': ['預け入れ手荷物に上記の禁止品が入っていないことを確認しました。', '我确认托运行李中没有以上违禁物品。'],
    'Searching for your reservation…': ['予約を検索しています…', '正在查询您的预订…'], 'Printing your boarding pass…': ['搭乗券を印刷しています…', '正在打印登机牌…'],
    'Check-in complete': ['チェックイン完了', '值机完成'], 'Thank you for choosing ANA.': ['ANAをご利用いただきありがとうございます。', '感谢您选择ANA。'],
    'Start again': ['最初から開始', '重新开始'], 'Collect boarding pass': ['搭乗券を受け取る', '领取登机牌']
  };
  const t = text => state.language === 'English' ? text : (translations[text]?.[state.language === '日本語' ? 0 : 1] || text);
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const button = (action, text, css = 'blue', extra = '') => `<button class="${css}" data-action="${action}" ${extra}>${t(text)}</button>`;
  const detail = (label, value) => `<div><small>${label}</small><b>${value}</b></div>`;
  const route = () => '<div class="route"><div><span class="airport-code">HND</span>Tokyo / Haneda</div><span class="plane">✈ ·······</span><div><span class="airport-code">LHR</span>London / Heathrow</div></div>';
  const itinerary = () => `<div class="details">${detail('Flight', 'NH211')}${detail('Departure · 03 OCT 2026', '09:45')}${detail('Cabin', 'Economy')}${detail('Seat', state.seat)}${detail('Boarding time', '09:05')}${detail('Gate', '110')}</div>`;
  const labels = { welcome: 'Welcome', language: 'Language', lookup: 'Identification', entry: 'Booking Reference', scan: 'Identification', confirmation: 'Reservation confirmation', seats: 'Seat Map', bags: 'Checked baggage', goods: 'Dangerous goods', printing: 'Collect boarding pass', complete: 'Check-in complete', processing: 'Identification' };
  function render() {
    document.documentElement.lang = state.language === 'English' ? 'en' : state.language === '日本語' ? 'ja' : 'zh-CN';
    $('screen-label').textContent = t(labels[state.step]);
    $('back').innerHTML = `<span>❮</span> ${t('Back')}`;
    $('cancel').innerHTML = `<span>×</span> ${t('Cancel')}`;
    $('help').innerHTML = `<span>?</span> ${t('Help')}`;
    const nextText = state.step === 'complete' ? 'Start again' : state.step === 'printing' ? 'Collect boarding pass' : 'Continue';
    $('continue').innerHTML = `${t(nextText)} <span>❯</span>`;
    $('back').disabled = ['welcome', 'processing', 'printing', 'complete'].includes(state.step);
    $('cancel').disabled = state.busy || state.step === 'welcome';
    $('continue').disabled = state.busy || state.step === 'lookup' || (state.step === 'goods' && !state.declared) || (state.step === 'entry' && !validReference());
    $('languages').disabled = state.busy;
    document.querySelectorAll('[data-language]').forEach(el => { el.disabled = state.busy; el.textContent = `${state.language === el.dataset.language ? '✓ ' : ''}${el.dataset.language}`; });
    switch (state.step) {
      case 'welcome': screen.innerHTML = `<div class="welcome"><div class="big-ana">ANA<span style="color:#00a8db">／</span></div><h1>${t('Welcome to ANA')}</h1><p>${t('Self-service check-in')}<br>${t('International flights')}</p>${button('start', 'Touch to begin', 'blue start')}<p class="muted">Please have your passport and booking information ready.</p></div>`; break;
      case 'language': screen.innerHTML = `<h1>${t('Select your language.')}</h1><p class="muted">言語を選択してください。 / 请选择您的语言。</p><div class="languages">${languages.map(lang => `<button class="choice ${state.language === lang ? 'selected' : ''}" data-select-language="${lang}" aria-pressed="${state.language === lang}">${state.language === lang ? '✓ ' : ''}${lang}</button>`).join('')}</div><p class="muted" style="text-align:center">You can change the language at any time.</p>`; break;
      case 'lookup': {
        const methods = [
          ['booking', 'Booking Reference', '<div class="document">Itinerary<br>Booking Reference<b>ABC123</b></div>', '6-character code'],
          ['ticket', 'E-Ticket Number', '<div class="document">Electronic Ticket<b>205-1234567890</b></div>', '13-digit code'],
          ['mileage', 'Frequent Flyer', '<div class="document" style="background:#d9e4ef">ANA MILEAGE CLUB<b>1234 567890</b></div>', 'Membership card'],
          ['passport', 'Passport', '<div class="passport">PASSPORT<b>◎</b></div>', 'Passport reader'],
          ['barcode', 'Boarding Pass Barcode', '<div class="document"><span class="barcode">▥ ▥▥▥▥▥</span></div>', '2D barcode reader']
        ];
        screen.innerHTML = `<h1>${t('Please select a method to retrieve your booking.')}</h1><div class="methods">${methods.map(([id, name, picture, hint]) => `<button class="method" data-method="${id}"><span class="method-title">${t(name)}</span><span class="method-picture"><small>${hint}</small>${picture}</span></button>`).join('')}</div>`; break;
      }
      case 'entry': {
        const isBooking = state.method === 'booking';
        const name = isBooking ? 'Your booking reference' : state.method === 'ticket' ? 'E-Ticket Number' : 'Frequent Flyer';
        const demo = isBooking ? 'ABC123' : state.method === 'ticket' ? '2051234567890' : '1234567890';
        $('screen-label').textContent = t(name);
        screen.innerHTML = `<h1>${isBooking ? t('Please enter your booking reference.') : `Please enter your ${state.method === 'ticket' ? '13-digit e-ticket' : '10-digit membership'} number.`}</h1><p class="muted">Demo ${isBooking ? 'booking reference' : 'number'}: <b>${demo}</b> · Use the touchscreen keyboard or type.</p><div class="entry"><label for="reference">${t(name)}</label><input id="reference" autocomplete="off" maxlength="${isBooking ? 6 : state.method === 'ticket' ? 13 : 10}" value="${esc(state.reference)}" aria-describedby="entry-error" ${isBooking ? '' : 'inputmode="numeric"'}>${button('delete', 'Delete', 'choice', 'style="min-height:52px;font-size:18px"')}</div><div class="keyboard"><div class="letters">${['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map(row => `<div class="keyrow">${[...row].map(k => `<button class="key" data-key="${k}" ${isBooking ? '' : 'disabled'}>${k}</button>`).join('')}</div>`).join('')}<div class="keyrow"><button class="key space" data-key=" " ${isBooking ? '' : 'disabled'}>${t('Space')}</button><button class="key" data-action="clear" style="width:22%;font-size:15px">Clear</button></div></div><div class="numbers">${[...'7894561230'].map(k => `<button class="key" data-key="${k}">${k}</button>`).join('')}</div></div><div id="entry-error" class="error" role="status">${esc(state.error)}</div>`; break;
      }
      case 'scan': screen.innerHTML = `<h1>${state.method === 'passport' ? 'Place your passport on the reader.' : 'Place your boarding pass barcode on the reader.'}</h1><div class="processing"><div class="panel" style="text-align:center"><div style="font-size:75px;color:#161e58">${state.method === 'passport' ? '▣' : '▥'}</div><h2>${t(state.method === 'passport' ? 'Passport' : 'Boarding Pass Barcode')}</h2><p class="muted">This is a simulated reader. No camera or personal document is needed.</p>${button('scan', 'Simulate scan')}</div></div>`; break;
      case 'processing': screen.innerHTML = `<div class="processing"><div class="spinner"></div><h1>${t('Searching for your reservation…')}</h1><p>Please wait a moment.</p></div>`; break;
      case 'confirmation': screen.innerHTML = `<h1>${t('Please confirm your passenger and flight details.')}</h1><div class="summary"><section class="panel"><div class="passenger"><span class="check">✓</span> ALEX MORGAN</div><h2>Passenger information</h2><div class="details">${detail('Booking reference', 'ABC123')}${detail('Passport', '••••••4821')}${detail('Nationality', 'United States')}${detail('Passenger', '1 adult')}</div><p class="muted" style="margin-top:25px">Fictional passenger · Demo reservation</p></section><section class="panel">${route()}${itinerary()}</section></div><p class="muted" style="text-align:center">Select Continue to choose your seat.</p>`; break;
      case 'seats': {
        const cols = ['A', 'C', '', 'D', 'E', 'F', '', 'H', 'K'];
        screen.innerHTML = `<h1>${t('Please select your desired seat.')}</h1><div class="seat-layout"><aside class="seat-info"><div class="panel"><h2>ALEX MORGAN</h2><p>Economy Class<br>Selected seat: <b id="selected-seat">${state.seat}</b></p></div><p class="muted">NH211 · HND → LHR<br>Boeing 787-9<br>Front of aircraft ↑</p><div class="legend"><span><i></i>Available</span><span><i class="occupied"></i>Occupied</span><span><i class="selected"></i>Selected</span></div><div style="display:flex;gap:10px;margin-top:12px">${button('seat-front', '↑ Front', 'blue', `aria-label="Show front seat rows" ${state.seatStart === 30 ? 'disabled' : ''}`)}${button('seat-rear', '↓ Rear', 'blue', `aria-label="Show rear seat rows" ${state.seatStart === 42 ? 'disabled' : ''}`)}</div></aside><div class="seat-map"><div class="seat-row">${cols.map(c => `<span>${c}</span>`).join('')}</div>${Array.from({length:6}, (_, i) => state.seatStart + i).map(row => `<div class="seat-row">${cols.map((c, index) => { if (!c) return `<span>${row}</span>`; const id = row+c; const occupied = (row+index)%4 === 0; return `<button data-seat="${id}" class="${state.seat === id ? 'selected' : ''}" aria-label="Seat ${id}${occupied ? ', occupied' : ''}" aria-pressed="${state.seat === id}" ${occupied ? 'disabled' : ''}>${occupied ? '×' : id}</button>`; }).join('')}</div>`).join('')}</div></div>`; break;
      }
      case 'bags': screen.innerHTML = `<h1>${t('How many bags will you check in?')}</h1><p>Select the total number of bags for ALEX MORGAN.</p><div class="bag-choices">${[0,1,2,3].map(n => `<button class="choice ${state.bags === n ? 'selected' : ''}" data-bags="${n}" aria-pressed="${state.bags === n}"><b>${n}</b>${n === 1 ? 'bag' : 'bags'} ${state.bags === n ? '✓' : ''}</button>`).join('')}</div><div class="bag-rule"><p>Economy allowance: <b>2 pieces · 23 kg per bag</b></p><p class="muted">Maximum combined dimensions: 158 cm per bag.<br>${state.bags > 2 ? 'An additional baggage fee would apply. This simulator does not collect payment.' : 'After check-in, take any checked bags to the baggage drop counter.'}</p></div>`; break;
      case 'goods': screen.innerHTML = `<h1>${t('Please confirm before you continue.')}</h1><p>These items must not be packed in checked baggage.</p><div class="goods">${[['▰','Spare lithium batteries'],['ϟ','Power banks'],['♨','Flammable liquids'],['✹','Explosives / fireworks'],['◉','Compressed gas']].map(([icon, label]) => `<div class="good"><span class="hazard">${icon}</span><b>${label}</b></div>`).join('')}</div><p class="muted">Carry spare batteries and power banks in your cabin baggage. If you are unsure about an item, ask an airline staff member.</p><label class="declaration"><input type="checkbox" id="declaration" ${state.declared ? 'checked' : ''}><span>${t('I confirm that my checked bags do not contain the prohibited items shown above.')}</span></label>`; break;
      case 'printing': screen.innerHTML = `<div class="processing">${state.busy ? '<div class="spinner"></div>' : '<div class="success">✓</div>'}<h1>${t(state.busy ? 'Printing your boarding pass…' : 'Collect boarding pass')}</h1><p>${state.busy ? 'Please wait. Your simulated boarding pass is being issued.' : 'Your boarding pass is ready. Touch Continue to collect it.'}</p>${state.busy ? '' : boardingPass()}<p class="muted">Simulated printing · No physical printer required</p></div>`; break;
      case 'complete': screen.innerHTML = `<div class="completion"><div class="success">✓</div><h1>${t('Check-in complete')}</h1><p>${t('Thank you for choosing ANA.')}</p>${boardingPass()}<p>${state.bags ? `Take your ${state.bags} checked ${state.bags === 1 ? 'bag' : 'bags'} to the baggage drop counter, then proceed to security.` : 'Proceed to security, then to your departure gate.'}</p><p class="muted">Please be at gate <b>110</b> by <b>09:05</b>. Enjoy your flight.</p></div>`; break;
    }
  }
  function boardingPass() { return `<div class="boarding-pass"><h2>ANA <span style="float:right;font-size:15px;font-weight:400">BOARDING PASS · DEMO</span></h2><div class="passenger">MORGAN / ALEX</div><div class="details">${detail('Flight', 'NH211')}${detail('Date', '03 OCT 2026')}${detail('Seat', state.seat)}${detail('Gate', '110')}</div><div style="display:flex;justify-content:space-between;align-items:center"><b>HND → LHR &nbsp; Boarding 09:05</b><span class="barcode">▥▥▥▥▥▥▥</span></div><small>NOT VALID FOR TRAVEL · ${state.bags} checked ${state.bags === 1 ? 'bag' : 'bags'}</small></div>`; }
  function validReference() { return state.method === 'booking' ? /^[A-Z0-9]{6}$/.test(state.reference) : new RegExp(`^\\d{${state.method === 'ticket' ? 13 : 10}}$`).test(state.reference); }
  function go(step) { state.step = step; state.error = ''; render(); }
  function processReservation() {
    state.busy = true; go('processing');
    timer = setTimeout(() => { state.busy = false; go('confirmation'); }, 1400);
  }
  function next() {
    if ($('continue').disabled) return;
    switch(state.step) {
      case 'welcome': go('language'); break;
      case 'language': if (returnStep) { const target = returnStep; returnStep = null; go(target); } else go('lookup'); break;
      case 'entry': processReservation(); break;
      case 'scan': processReservation(); break;
      case 'confirmation': go('seats'); break;
      case 'seats': go('bags'); break;
      case 'bags': go('goods'); break;
      case 'goods': state.busy = true; go('printing'); timer = setTimeout(() => { state.busy = false; render(); }, 2200); break;
      case 'printing': go('complete'); break;
      case 'complete': reset(); break;
    }
  }
  function back() {
    if ($('back').disabled) return;
    if (state.step === 'language' && returnStep) { const target = returnStep; returnStep = null; go(target); return; }
    const previous = { language:'welcome', lookup:'language', entry:'lookup', scan:'lookup', confirmation: ['passport','barcode'].includes(state.method) ? 'scan' : 'entry', seats:'confirmation', bags:'seats', goods:'bags' };
    go(previous[state.step] || 'welcome');
  }
  function reset() { clearTimeout(timer); Object.assign(state,{step:'welcome',method:'',reference:'',seat:'31A',bags:0,declared:false,error:'',busy:false,seatStart:30}); returnStep = null; started = Date.now(); render(); }
  function modal(title, text, actions) {
    $('dialog-title').textContent = title; $('dialog-text').textContent = text;
    $('dialog-actions').replaceChildren();
    actions.forEach(([label, css, fn]) => { const el = document.createElement('button'); el.textContent = label; el.className = css; el.onclick = () => { $('dialog').close(); fn?.(); }; $('dialog-actions').append(el); });
    $('dialog').showModal();
  }
  function updateReference(value) {
    const max = state.method === 'booking' ? 6 : state.method === 'ticket' ? 13 : 10;
    state.reference = value.toUpperCase().replace(state.method === 'booking' ? /[^A-Z0-9]/g : /\D/g, '').slice(0,max);
    $('reference').value = state.reference;
    $('continue').disabled = !validReference();
  }
  screen.addEventListener('input', e => {
    if (e.target.id === 'reference') updateReference(e.target.value);
    if (e.target.id === 'declaration') { state.declared = e.target.checked; $('continue').disabled = !state.declared; }
  });
  screen.addEventListener('click', e => {
    const el = e.target.closest('button'); if (!el || el.disabled || state.busy) return;
    if (el.dataset.selectLanguage) { state.language = el.dataset.selectLanguage; render(); }
    if (el.dataset.method) { state.method = el.dataset.method; state.reference = ''; go(['passport','barcode'].includes(state.method) ? 'scan' : 'entry'); }
    if (el.dataset.key !== undefined) updateReference(state.reference + el.dataset.key);
    if (el.dataset.seat) { state.seat = el.dataset.seat; render(); }
    if (el.dataset.bags !== undefined) { state.bags = Number(el.dataset.bags); render(); }
    switch(el.dataset.action) {
      case 'start': go('language'); break;
      case 'delete': updateReference(state.reference.slice(0,-1)); break;
      case 'clear': updateReference(''); break;
      case 'scan': processReservation(); break;
      case 'seat-front': state.seatStart = Math.max(30,state.seatStart-6); render(); break;
      case 'seat-rear': state.seatStart = Math.min(42,state.seatStart+6); render(); break;
    }
  });
  $('continue').onclick = next; $('back').onclick = back;
  $('cancel').onclick = () => modal('Cancel check-in?', 'Your selections will be cleared and this kiosk will return to the welcome screen.', [['Keep checking in','blue'],['Cancel check-in','orange',reset]]);
  $('help').onclick = () => modal('Check-in assistance', state.step === 'entry' ? 'Enter any valid demo code: ABC123 (booking), 2051234567890 (e-ticket), or 1234567890 (membership). All valid entries retrieve the fictional Alex Morgan itinerary.' : 'Use Continue to advance and Back to review your selections. Passport and barcode readers and boarding-pass printing are simulated. For this demo, all passenger and flight data is fictional.', [['Close','blue']]);
  $('languages').onclick = () => { if (state.step !== 'language') { returnStep = state.step; go('language'); } };
  document.querySelectorAll('[data-language]').forEach(el => { el.onclick = () => { if (!state.busy) { state.language = el.dataset.language; render(); } }; });
  document.addEventListener('keydown', e => {
    if (state.step !== 'entry' || $('dialog').open || state.busy || e.target.id === 'reference' || e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === 'BUTTON') return;
    if (/^[a-z0-9]$/i.test(e.key)) { e.preventDefault(); updateReference(state.reference + e.key); }
    if (e.key === 'Backspace') { e.preventDefault(); updateReference(state.reference.slice(0,-1)); }
    if (e.key === 'Enter') next();
  });
  setInterval(() => { const secs = Math.floor((Date.now()-started)/1000); $('time').textContent = `${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`; }, 1000);
  render();
})();
