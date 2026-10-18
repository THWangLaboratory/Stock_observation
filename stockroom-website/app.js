'use strict';
// Static snapshot exported by update_data.py; missing data never uses simulated values.
const snapshot = window.STOCKROOM_DATA || {stocks:[],status:'unavailable'};
const catalog = Array.isArray(snapshot.stocks) ? snapshot.stocks : [];
const byCode = new Map(catalog.map(s => [s.code,s]));
const STORAGE_KEY = 'stockroom.watchlist.v1';
const defaults = ['2330','2454','2376','2382','3231','2408'].filter(code=>byCode.has(code));
let storageWarning = false;
function loadWatchlist() {
 try { const saved = localStorage.getItem(STORAGE_KEY); if(saved === null) return [...defaults]; const value=JSON.parse(saved); if(!Array.isArray(value)) throw new Error('Invalid storage'); return [...new Set(value.filter(code => byCode.has(code)))]; }
 catch { storageWarning=true; return [...defaults]; }
}
let watchlist=loadWatchlist(), selected=byCode.has('2330')?'2330':catalog[0]?.code, sector='半導體', period=20, sortDirection=0, toastTimer;
const $ = id => document.getElementById(id);
const money = value => Number.isFinite(value)?value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const percent = value => Number.isFinite(value)?`${value>0?'+':''}${value.toFixed(2)}%`:'—';
const tone = value => value>0?'up':value<0?'down':'flat';
function notify(message){ $('toast').textContent=message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2400); }
function save(){ try {localStorage.setItem(STORAGE_KEY,JSON.stringify(watchlist));}catch{notify('瀏覽器無法儲存，清單僅保留在這次開啟期間。');} }
function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function historyFor(stock){return (stock.history||[]).map(row=>row.close).filter(Number.isFinite);}
function signalFor(stock){const rows=(stock.adjustedHistory||[]).slice(-20);if(rows.length<20||rows.some(row=>!Number.isFinite(row.close)))return null;const values=rows.map(row=>row.close);const mean=n=>values.slice(-n).reduce((a,b)=>a+b,0)/n;const fast=mean(5),slow=mean(20);return {up:fast>=slow,fast,slow};}
function stockButton(s){return `<button class="stock-open" data-open="${escapeHTML(s.code)}"><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(s.code)} · ${escapeHTML(s.tradeDate||'無資料')}${s.state==='cached'?' · 更新失敗，保留舊值':s.tradeDate&&s.tradeDate!==snapshot.tradeDate?' · 較舊交易日':''}</small></button>`;}
function renderWatch(){
 const list=watchlist.map(code=>byCode.get(code));
 if(sortDirection)list.sort((a,b)=>{if(!Number.isFinite(a.change))return 1;if(!Number.isFinite(b.change))return -1;return sortDirection*(b.change-a.change);});
 $('count').textContent=watchlist.length;
 $('watch-count').textContent=watchlist.length;
 const valid=list.filter(s=>Number.isFinite(s.change)&&s.tradeDate===snapshot.tradeDate);
 const avg=valid.length?valid.reduce((sum,s)=>sum+s.change,0)/valid.length:NaN;
 $('average').textContent=percent(avg);$('average').className=valid.length?tone(avg):'';
 $('average-note').textContent=`${snapshot.tradeDate||'尚無交易日期'} · 有效 ${valid.length}/${list.length} 檔，非投資組合報酬`;
 $('breadth').innerHTML=`<span class="up">${valid.filter(s=>s.change>0).length} 漲</span> <span style="color:#526780">/</span> <span class="down">${valid.filter(s=>s.change<0).length} 跌</span>`;
 $('breadth-note').textContent=`平盤 ${valid.filter(s=>s.change===0).length} · 較舊或無資料 ${list.length-valid.length}`;
 $('watch-body').innerHTML=list.map(s=>{const signal=signalFor(s);return `<tr class="${selected===s.code?'selected':''}"><td>${stockButton(s)}</td><td class="numeric">${money(s.price)}</td><td class="numeric"><span class="change-pill ${tone(s.change)}">${percent(s.change)}</span></td><td><span class="signal ${!signal?'flat':signal.up?'up':'down'}">${!signal?'資料不足':signal.up?'↗ 偏多':'↘ 偏空'}</span></td><td><button class="remove-button" data-remove="${s.code}" aria-label="移除${escapeHTML(s.name)}" title="移除${escapeHTML(s.name)}">×</button></td></tr>`;}).join('');
 $('empty-state').hidden=!!list.length;
 $('sort-watch').textContent=`漲跌幅 ${sortDirection===1?'↓':sortDirection===-1?'↑':'↕'}`;
}
function renderSector(){
 const members=catalog.filter(s=>s.sector===sector);
 const valid=members.filter(s=>Number.isFinite(s.change)&&s.tradeDate===snapshot.tradeDate);
 const list=valid.sort((a,b)=>b.change-a.change).slice(0,10);
 $('sector-note').textContent=`${snapshot.tradeDate||'尚無資料'} · ${members.length} 檔中有效 ${valid.length} 檔 · 僅本站自訂分類，非完整市場排行`;
 $('sector-body').innerHTML=list.map((s,i)=>`<tr class="${selected===s.code?'selected':''}"><td><span class="rank ${i<3?'top':''}">${String(i+1).padStart(2,'0')}</span></td><td>${stockButton(s)}</td><td class="numeric">${money(s.price)}</td><td class="numeric"><span class="change-pill ${tone(s.change)}">${percent(s.change)}</span></td><td class="numeric volume-col">${money(s.volume)}</td><td class="numeric"><button class="add-button ${watchlist.includes(s.code)?'added':''}" data-toggle="${s.code}" aria-label="${watchlist.includes(s.code)?'移除':'加入'}${escapeHTML(s.name)}自選股" title="${watchlist.includes(s.code)?'移除自選股':'加入自選股'}">${watchlist.includes(s.code)?'✓':'＋'}</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">此產業尚無同交易日的有效資料，請稍後更新。</td></tr>';
 document.querySelectorAll('.tab').forEach(el=>{const active=el.dataset.sector===sector;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;});
}
function renderChart(s){
 const values=historyFor(s).slice(-period),width=380,height=210,pad={left:12,right:53,top:19,bottom:28};
 if(values.length<2){$('chart').innerHTML='<p class="empty">尚無足夠歷史資料，無法繪製走勢。</p>';return;}
 const min=Math.min(...values)*.985,max=Math.max(...values)*1.015;
 const x=i=>pad.left+i/(values.length-1)*(width-pad.left-pad.right);
 const y=v=>pad.top+(max-v)/(max-min)*(height-pad.top-pad.bottom);
 const points=values.map((v,i)=>`${x(i).toFixed(2)},${y(v).toFixed(2)}`);
 const line=points.map((p,i)=>`${i?'L':'M'}${p}`).join(' ');
 const color=values.at(-1)>=values[0]?'#ff858e':'#59d2b1';
 const ticks=[0,1,2,3].map(i=>{const v=min+(max-min)*i/3,yy=y(v);return `<line x1="12" y1="${yy}" x2="327" y2="${yy}" stroke="#2b3b52" stroke-dasharray="3 4"/><text x="337" y="${yy+3}">${v.toFixed(v>1000?0:1)}</text>`;}).join('');
 const area=`${line} L327,182 L12,182 Z`;
 const rows=(s.history||[]).slice(-period);
 $('chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(s.name)}最近${values.length}筆收盤價走勢，最後交易日${escapeHTML(s.tradeDate)}"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".18"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${ticks}<path d="${area}" fill="url(#area)"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/><circle cx="327" cy="${y(values.at(-1))}" r="3.5" fill="${color}" stroke="#151f2e" stroke-width="2"/><text x="12" y="204">${escapeHTML(rows[0].date)}</text><text x="267" y="204">${escapeHTML(rows.at(-1).date)}</text></svg>`;
}
function renderDetail(){const s=byCode.get(selected);if(!s){$('detail-name').textContent='尚無資料';$('chart').innerHTML='<p class="empty">找不到行情檔，請執行資料更新。</p>';return;}const signal=signalFor(s);$('detail-name').textContent=s.name;$('detail-code').textContent=s.code;$('detail-price').textContent=money(s.price);$('detail-change').textContent=`${s.change>0?'▲':s.change<0?'▼':'—'} ${percent(s.change)}`;$('detail-change').className=tone(s.change);$('detail-volume').textContent=Number.isFinite(s.volume)?money(s.volume)+' 張':'—';$('detail-sector').textContent=s.sector;$('detail-date').textContent=`交易日 ${s.tradeDate||'尚無資料'}${s.state==='cached'?' · 更新失敗，保留舊值':''}`;$('prediction-value').textContent=!signal?'資料不足':signal.up?'↗ 偏向上漲':'↘ 偏向下跌';$('prediction-value').className=!signal?'flat':signal.up?'up':'down';$('prediction-reason').textContent=signal?`以 ${s.tradeDate} 為基準，還原收盤價的 5 日均線（${money(signal.fast)}）${signal.up?'高於或等於':'低於'} 20 日均線（${money(signal.slow)}），顯示${signal.up?'偏多':'偏空'}訊號。僅為該日之後下一交易日的規則判讀，不代表實際結果。`:'需要最近 20 筆有效的還原收盤價，才能進行均線判讀。';renderChart(s);}
function renderAll(){renderWatch();renderSector();renderDetail();}
function add(code){if(!byCode.has(code)||watchlist.includes(code))return;watchlist.push(code);save();renderAll();renderSearch();notify(`已加入 ${byCode.get(code).name}`);}
function remove(code){watchlist=watchlist.filter(c=>c!==code);save();renderAll();renderSearch();notify(`已移除 ${byCode.get(code).name}`);}
function renderSearch(){const query=$('stock-search').value.trim().toLowerCase();const results=catalog.filter(s=>s.code.includes(query)||s.name.toLowerCase().includes(query));$('search-results').innerHTML=results.length?results.map(s=>`<div class="search-row"><div><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(s.code)} · ${escapeHTML(s.sector)} · ${escapeHTML(s.tradeDate||'無資料')}</small></div><button data-add="${s.code}" ${watchlist.includes(s.code)?'disabled':''}>${watchlist.includes(s.code)?'已加入':'＋ 加入'}</button></div>`).join(''):'<p class="empty">此股票尚未收錄。目前只能新增本站名單內的股票；需先加入股票名單並更新行情，才能搜尋與新增。</p>';}
function openSearch(){$('stock-search').value='';renderSearch();$('stock-dialog').showModal();$('stock-search').focus();}
['add-main','add-small','add-empty'].forEach(id=>$(id).addEventListener('click',openSearch));
$('stock-search').addEventListener('input',renderSearch);
$('sort-watch').addEventListener('click',()=>{sortDirection=sortDirection===1?-1:1;renderWatch();});
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const d=button.dataset;if(d.open){selected=d.open;renderAll();if(window.innerWidth<651)document.querySelector('.detail-panel').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}if(d.remove)remove(d.remove);if(d.add)add(d.add);if(d.toggle)watchlist.includes(d.toggle)?remove(d.toggle):add(d.toggle);if(d.sector){sector=d.sector;renderSector();}if(d.period){period=Number(d.period);document.querySelectorAll('.period').forEach(el=>el.classList.toggle('active',Number(el.dataset.period)===period));renderDetail();}});
document.querySelector('.tabs').addEventListener('keydown',event=>{const tabs=[...document.querySelectorAll('.tab')],i=tabs.indexOf(document.activeElement);if(i<0)return;let next;if(event.key==='ArrowRight')next=(i+1)%tabs.length;if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();tabs[next].click();tabs[next].focus();}});
document.querySelectorAll('.nav-link').forEach(link=>link.addEventListener('click',()=>{document.querySelectorAll('.nav-link').forEach(el=>el.classList.remove('active'));link.classList.add('active');}));
$('stock-dialog').addEventListener('click',event=>{if(event.target===$('stock-dialog')){const rect=$('stock-dialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('stock-dialog').close();}});
function renderStatus(){
 const available=catalog.filter(s=>Number.isFinite(s.price));
 const failures=Array.isArray(snapshot.failures)?snapshot.failures.length:0;
 const date=snapshot.tradeDate;
 const formatTime=value=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚未成功更新';
 $('data-status').textContent=!available.length?'尚無行情':snapshot.status==='error'?'更新失敗':failures?'部分更新':'yfinance 日線';
 $('data-message').textContent=!available.length?'尚未取得真實行情。請先執行資料更新，再重新讀取。':snapshot.status==='error'?'最近一次更新失敗，目前保留先前成功的行情。':`行情交易日 ${date} · ${available.length}/${catalog.length} 檔有資料${failures?`，${failures} 檔本輪未成功更新`:''}。`;
 let age='';if(date){const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});const days=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000);if(days>=4)age=` 資料距今 ${days} 天（休市期間也可能沒有更新）。`;}
 $('data-meta').textContent=`資料產出：${formatTime(snapshot.generatedAt)}（台北時間）${snapshot.status==='error'?`；最近嘗試：${formatTime(snapshot.attemptedAt)}`:''}。非即時行情；產業為自訂分組，主機板組含工業電腦相關公司。${age}`;
 $('universe-count').textContent=`共收錄 ${catalog.length} 檔股票`;
}
$('reload-data').addEventListener('click',()=>window.location.reload());
renderStatus();renderAll();
if(storageWarning)notify('無法讀取儲存清單，已載入預設自選股。');
