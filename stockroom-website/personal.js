'use strict';
const PERSONAL_KEY='stockroom.personal.v1';
const personalCore=window.StockroomPersonal;
let records=Object.create(null), pendingImport=null;
try{const raw=localStorage.getItem(PERSONAL_KEY);if(raw!==null)records=personalCore.validateBackup({format:'stockroom-personal',version:1,watchlist:[],records:JSON.parse(raw)}).records;}
catch{$('personal-warning').hidden=false;$('personal-warning').textContent='個人紀錄無法讀取。原始資料未覆寫；請先匯出可讀資料或保留原備份，再進行修改。';}
const blankRecord=()=>({note:'',lower:null,upper:null,updatedAt:null});
function commitRecords(next){try{localStorage.setItem(PERSONAL_KEY,JSON.stringify(next));records=next;return true;}catch{notify('無法儲存個人紀錄，請確認瀏覽器允許本機儲存。');return false;}}
function conditionLabel(stock,record){const result=personalCore.checkCondition(stock,record,snapshot.tradeDate);if(result.status==='none')return '尚未設定價格條件';if(result.status==='unavailable')return '行情不足，尚無法檢查';if(result.status==='stale')return '資料較舊或本輪更新失敗，暫不判定';if(result.status==='waiting')return `尚未達成 · 交易日 ${stock.tradeDate}`;return `已達成：${result.hits.map(hit=>`收盤價 ${hit.type==='lower'?'≤':'≥'} ${money(hit.target)}`).join('、')} · ${stock.tradeDate}`;}
function renderPersonal(){
 const stock=byCode.get(selected),record=records[selected]||blankRecord();
 $('personal-stock').textContent=stock?`${stock.name} ${stock.code}`:'請先選擇股票';
 $('stock-note').value=record.note;$('target-lower').value=record.lower??'';$('target-upper').value=record.upper??'';
 $('note-count').textContent=`${record.note.length} / 4,000`;
 $('note-save-state').textContent=record.updatedAt?`已儲存 · ${new Date(record.updatedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}`:'筆記自動儲存於這個瀏覽器';
 $('condition-result').textContent=conditionLabel(stock,record);
 $('note-error').textContent='';$('rule-error').textContent='';
 $('save-rule').disabled=!stock;$('stock-note').disabled=!stock;
 renderTracking();
}
function renderTracking(){
 const active=watchlist.map(code=>({stock:byCode.get(code),record:records[code]})).filter(item=>item.record&&(item.record.lower!==null||item.record.upper!==null));
 const hit=active.filter(({stock,record})=>personalCore.checkCondition(stock,record,snapshot.tradeDate).status==='hit');
 $('tracking-count').textContent=`${hit.length} 已達成 / ${active.length} 追蹤中`;
 $('tracking-list').innerHTML=active.map(({stock,record})=>{const result=personalCore.checkCondition(stock,record,snapshot.tradeDate);return `<div class="tracking-row"><div>${stockButton(stock)}<small class="tracking-result ${result.status==='hit'?'condition-hit':''}">${escapeHTML(conditionLabel(stock,record))}</small><small class="tracking-target">${record.lower!==null?`低價 ≤ ${money(record.lower)}`:''}${record.lower!==null&&record.upper!==null?' ／ ':''}${record.upper!==null?`高價 ≥ ${money(record.upper)}`:''}</small></div><span class="tracking-price">${money(stock.price)}</span></div>`;}).join('')||'<p class="personal-empty">尚無價格條件。點選股票，在右側或下方設定目標價格。</p>';
}
$('stock-note').addEventListener('input',()=>{
 const note=$('stock-note').value;$('note-count').textContent=`${note.length} / 4,000`;
 if(!byCode.has(selected)||note.length>4000)return;
 const next={...records,[selected]:{...(records[selected]||blankRecord()),note,updatedAt:new Date().toISOString()}};
 if(commitRecords(next)){$('note-save-state').textContent='已自動儲存';$('note-error').textContent='';}
 else{$('note-save-state').textContent='尚未儲存';$('note-error').textContent='儲存失敗，請先複製這段筆記以免遺失。';}
});
$('price-form').addEventListener('submit',event=>{
 event.preventDefault();if(!byCode.has(selected))return;
 const lower=$('target-lower').value.trim(),upper=$('target-upper').value.trim();
 try{const record=personalCore.validateRecord({...blankRecord(),...records[selected],lower:lower===''?null:Number(lower),upper:upper===''?null:Number(upper),updatedAt:new Date().toISOString()});
 if(commitRecords({...records,[selected]:record})){renderPersonal();notify('價格條件已儲存，依收盤資料檢查。');}}
 catch(error){$('rule-error').textContent=error.message;}
});
$('clear-rule').addEventListener('click',()=>{if(!byCode.has(selected))return;const record={...(records[selected]||blankRecord()),lower:null,upper:null,updatedAt:new Date().toISOString()};if(commitRecords({...records,[selected]:record})){renderPersonal();notify('已清除價格條件，筆記仍保留。');}});
$('export-personal').addEventListener('click',()=>{
 const backup={format:'stockroom-personal',version:1,exportedAt:new Date().toISOString(),watchlist:[...watchlist],records};
 $('export-text').value=JSON.stringify(backup,null,2);$('export-dialog').showModal();
});
$('download-backup').addEventListener('click',()=>{const blob=new Blob([$('export-text').value],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`stockroom-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('已準備下載；也可以直接複製備份文字。');});
$('copy-backup').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('export-text').value);notify('已複製備份文字。');}catch{$('export-text').focus();$('export-text').select();notify('請手動複製已選取的備份文字。');}});
$('import-personal').addEventListener('click',()=>{pendingImport=null;$('import-text').value='';$('import-preview').textContent='選擇 JSON 檔案，或貼上備份文字後點「檢查備份」。';$('import-skipped').textContent='';$('import-error').textContent='';$('confirm-import').disabled=true;$('import-dialog').showModal();});
$('choose-backup').addEventListener('click',()=>$('import-file').click());
function prepareImport(text){
 pendingImport=null;$('confirm-import').disabled=true;
 try{if(text.length>2*1024*1024)throw new Error('備份文字過長。');const data=personalCore.validateBackup(JSON.parse(text));
 const known=data.watchlist.filter(code=>byCode.has(code)),missing=data.watchlist.filter(code=>!byCode.has(code));pendingImport={...data,watchlist:known};
 $('import-preview').textContent=`將匯入 ${known.length} 檔自選股、${Object.values(data.records).filter(r=>r.note).length} 則筆記、${Object.values(data.records).filter(r=>r.lower!==null||r.upper!==null).length} 組價格條件。`;
 $('import-skipped').textContent=missing.length?`本站尚未收錄 ${missing.length} 檔（${missing.join('、')}），不加入自選清單；筆記與條件仍保存在備份紀錄中。`:'';
 $('import-error').textContent='';$('confirm-import').disabled=false;
 }catch(error){$('import-preview').textContent='備份尚未通過檢查。';$('import-error').textContent=error instanceof SyntaxError?'不是有效的 JSON 備份檔。':error.message;}
}
$('check-backup').addEventListener('click',()=>prepareImport($('import-text').value));
$('import-text').addEventListener('input',()=>{pendingImport=null;$('confirm-import').disabled=true;$('import-preview').textContent='文字已修改，請重新檢查備份。';});
$('import-file').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 pendingImport=null;$('confirm-import').disabled=true;
 try{if(file.size>2*1024*1024)throw new Error('備份檔過大，請選擇小於 2 MB 的 JSON 檔。');$('import-text').value=await file.text();prepareImport($('import-text').value);}
 catch(error){$('import-error').textContent=error.message;}
});
$('confirm-import').addEventListener('click',()=>{
 if(!pendingImport)return;
 let oldWatch,oldRecords;
 try{oldWatch=localStorage.getItem(STORAGE_KEY);oldRecords=localStorage.getItem(PERSONAL_KEY);
 try{localStorage.setItem(PERSONAL_KEY,JSON.stringify(pendingImport.records));localStorage.setItem(STORAGE_KEY,JSON.stringify(pendingImport.watchlist));}
 catch(error){if(oldRecords===null)localStorage.removeItem(PERSONAL_KEY);else localStorage.setItem(PERSONAL_KEY,oldRecords);if(oldWatch===null)localStorage.removeItem(STORAGE_KEY);else localStorage.setItem(STORAGE_KEY,oldWatch);throw error;}
 records=pendingImport.records;watchlist=pendingImport.watchlist;pendingImport=null;
 $('import-dialog').close();renderAll();renderPersonal();notify('備份已還原。');
 }catch{$('import-error').textContent='無法寫入瀏覽器儲存，未套用此備份；請先匯出目前資料，並確認瀏覽器有可用空間。';}
});
$('import-dialog').addEventListener('close',()=>{pendingImport=null;});
// Existing stock-selection handlers run first, so personal tools follow the new selection.
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.open)renderPersonal();else if(button.dataset.remove||button.dataset.add||button.dataset.toggle)renderTracking();});
renderPersonal();
