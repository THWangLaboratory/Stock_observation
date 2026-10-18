(function(root){
 'use strict';
 const MAX_NOTE=4000;
 const isCode=value=>typeof value==='string'&&/^\d{4,6}$/.test(value);
 function validateRecord(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('個股紀錄格式不正確。');
  if(typeof value.note!=='string'||value.note.length>MAX_NOTE)throw new Error('筆記必須為文字，最多 4,000 字。');
  const price=value=>value===null||typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=10000000;
  if(!price(value.lower)||!price(value.upper))throw new Error('價格條件必須為正數，或留空。');
  if(value.lower!==null&&value.upper!==null&&value.lower>=value.upper)throw new Error('低價條件必須小於高價條件。');
  if(value.updatedAt!==null&&(typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt))))throw new Error('紀錄時間格式不正確。');
  return {note:value.note,lower:value.lower,upper:value.upper,updatedAt:value.updatedAt};
 }
 function validateBackup(data){
  if(!data||data.format!=='stockroom-personal'||data.version!==1)throw new Error('這不是支援的股感備份檔。');
  if(!Array.isArray(data.watchlist)||data.watchlist.length>2000||data.watchlist.some(code=>!isCode(code)))throw new Error('自選清單格式不正確。');
  if(!data.records||typeof data.records!=='object'||Array.isArray(data.records)||Object.keys(data.records).length>2000)throw new Error('個股紀錄格式不正確。');
  const records=Object.create(null);
  for(const [code,value] of Object.entries(data.records)){if(!isCode(code))throw new Error('備份包含無效股票代碼。');records[code]=validateRecord(value);}
  return {watchlist:[...new Set(data.watchlist)],records};
 }
 function checkCondition(stock,record,latestDate){
  if(!record||record.lower===null&&record.upper===null)return {status:'none',hits:[]};
  if(!stock||!Number.isFinite(stock.price)||!stock.tradeDate)return {status:'unavailable',hits:[]};
  if(stock.state==='cached'||stock.tradeDate!==latestDate)return {status:'stale',hits:[]};
  const hits=[];
  if(record.lower!==null&&stock.price<=record.lower)hits.push({type:'lower',target:record.lower});
  if(record.upper!==null&&stock.price>=record.upper)hits.push({type:'upper',target:record.upper});
  return {status:hits.length?'hit':'waiting',hits};
 }
 const api={MAX_NOTE,validateRecord,validateBackup,checkCondition};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.StockroomPersonal=api;
})(typeof window==='object'?window:globalThis);
