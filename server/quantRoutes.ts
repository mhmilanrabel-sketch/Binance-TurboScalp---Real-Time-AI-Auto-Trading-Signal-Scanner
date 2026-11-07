import type { Express, Request, Response } from 'express';
import axios from 'axios';
const BASE='https://demo-fapi.binance.com';
let cache:{at:number;markets:any[]}={at:0,markets:[]};
const n=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const ema=(x:number[],p:number)=>{if(!x.length)return[];const k=2/(p+1),o=[x[0]];for(let i=1;i<x.length;i++)o.push(x[i]*k+o[i-1]*(1-k));return o;};
function rsi(x:number[],p=14){const o=Array(x.length).fill(50);if(x.length<=p)return o;let g=0,l=0;for(let i=1;i<=p;i++){const d=x[i]-x[i-1];g+=Math.max(0,d);l+=Math.max(0,-d);}let ag=g/p,al=l/p;o[p]=al===0?100:100-100/(1+ag/al);for(let i=p+1;i<x.length;i++){const d=x[i]-x[i-1];ag=(ag*(p-1)+Math.max(0,d))/p;al=(al*(p-1)+Math.max(0,-d))/p;o[i]=al===0?100:100-100/(1+ag/al);}return o;}
function calc(symbol:string,c:any[],change24h:number,quoteVolume:number){
 const close=c.map(x=>x.close),vol=c.map(x=>x.volume),e9=ema(close,9),e21=ema(close,21),e50=ema(close,50),rv=rsi(close),fast=ema(close,12),slow=ema(close,26),macd=fast.map((v,i)=>v-slow[i]),sig=ema(macd,9);
 const tr=c.map((x:any,i:number)=>i?Math.max(x.high-x.low,Math.abs(x.high-c[i-1].close),Math.abs(x.low-c[i-1].close)):x.high-x.low),a=ema(tr,14),i=close.length-1,last=close[i];
 const av=vol.slice(Math.max(0,i-20),i).reduce((s:number,v:number)=>s+v,0)/Math.max(1,Math.min(20,i)),vr=av?vol[i]/av:1;
 const hi=Math.max(...c.slice(-21,-1).map((x:any)=>x.high)),lo=Math.min(...c.slice(-21,-1).map((x:any)=>x.low));
 const trend=e9[i]>e21[i]&&e21[i]>e50[i]?1:e9[i]<e21[i]&&e21[i]<e50[i]?-1:0;
 const mom=macd[i]>sig[i]&&macd[i]>macd[i-1]?1:macd[i]<sig[i]&&macd[i]<macd[i-1]?-1:0;
 const br=last>hi?1:last<lo?-1:0,rs=rv[i]>=52&&rv[i]<=68?1:rv[i]<=48&&rv[i]>=32?-1:0,ds=change24h>.25?1:change24h<-.25?-1:0;
 const score=Math.round(35*trend+20*mom+15*br+15*rs+5*(vr>=1.15?1:0)+10*ds),direction=score>=45?'BUY':score<=-45?'SELL':'NEUTRAL';
 const distance=Math.max(a[i]*1.5,last*.002),stopLoss=direction==='BUY'?last-distance:direction==='SELL'?last+distance:null,takeProfit=direction==='BUY'?last+distance*2:direction==='SELL'?last-distance*2:null;
 return {symbol,direction,score,confidence:Math.min(95,Math.round(50+Math.abs(score)*.45)),price:last,change24h,quoteVolume,rsi:+rv[i].toFixed(2),ema9:e9[i],ema21:e21[i],ema50:e50[i],macdHistogram:macd[i]-sig[i],volumeRatio:+vr.toFixed(2),volatilityPct:+(a[i]/last*100).toFixed(3),support:lo,resistance:hi,stopLoss,takeProfit,reasons:[trend?'EMA 9/21/50 trend alignment':'EMA trend mixed',mom?'MACD momentum confirms':'MACD not confirmed',br?'20-candle breakout':'No 20-candle breakout','RSI '+rv[i].toFixed(1)+' · relative volume '+vr.toFixed(2)+'x']};
}
async function universe(){
 if(Date.now()-cache.at<15000&&cache.markets.length)return cache.markets;
 const [info,tick]=await Promise.all([axios.get(BASE+'/fapi/v1/exchangeInfo',{timeout:12000}),axios.get(BASE+'/fapi/v1/ticker/24hr',{timeout:12000})]);
 const map=new Map((tick.data as any[]).map(t=>[t.symbol,t]));
 cache.markets=(info.data.symbols as any[]).filter(s=>s.status==='TRADING'&&s.contractType==='PERPETUAL'&&s.quoteAsset==='USDT').map(s=>{const t:any=map.get(s.symbol);return{symbol:s.symbol,baseAsset:s.baseAsset,price:n(t?.lastPrice),change24h:n(t?.priceChangePercent),quoteVolume:n(t?.quoteVolume),high24h:n(t?.highPrice),low24h:n(t?.lowPrice)};}).filter(m=>m.price>0).sort((a,b)=>b.quoteVolume-a.quoteVolume);
 cache.at=Date.now();return cache.markets;
}
async function candles(symbol:string){if(!/^[A-Z0-9]{5,20}$/.test(symbol))throw Error('Invalid symbol');const r=await axios.get(BASE+'/fapi/v1/klines',{params:{symbol,interval:'15m',limit:120},timeout:12000});return (r.data as any[]).map(k=>({open:n(k[1]),high:n(k[2]),low:n(k[3]),close:n(k[4]),volume:n(k[5])}));}
export function registerQuantRoutes(app:Express){
 app.get('/api/quant/universe',async(_q:Request,res:Response)=>{try{const markets=await universe();res.json({success:true,count:markets.length,markets,updatedAt:Date.now(),environment:'USD_M_FUTURES_DEMO'});}catch(e:any){res.status(502).json({success:false,message:e?.response?.data?.msg||e.message||'Universe unavailable'});}});
 app.get('/api/quant/scan',async(req:Request,res:Response)=>{try{const m=(await universe()).filter(x=>x.quoteVolume>=Math.max(0,n(req.query.minVolume)||250000)).slice(0,Math.min(60,Math.max(5,n(req.query.limit)||40)));let cursor=0;const out:any[]=[];await Promise.all(Array.from({length:5},async()=>{while(cursor<m.length){const x=m[cursor++];try{const c=await candles(x.symbol);if(c.length>=60)out.push(calc(x.symbol,c,x.change24h,x.quoteVolume));}catch{/* skip an unavailable contract */}}}));out.sort((a,b)=>Math.abs(b.score)-Math.abs(a.score));res.json({success:true,count:out.length,universeCount:(await universe()).length,signals:out,scannedAt:Date.now(),timeframe:'15m',environment:'USD_M_FUTURES_DEMO'});}catch(e:any){res.status(502).json({success:false,message:e?.response?.data?.msg||e.message||'Scan failed'});}});
 app.get('/api/quant/analyze/:symbol',async(req:Request,res:Response)=>{try{const s=String(req.params.symbol).toUpperCase(),m=(await universe()).find(x=>x.symbol===s);if(!m){res.status(404).json({success:false,message:'Not an active USDT perpetual.'});return;}const c=await candles(s);res.json({success:true,analysis:calc(s,c,m.change24h,m.quoteVolume),candles:c.slice(-80)});}catch(e:any){res.status(502).json({success:false,message:e.message||'Analysis failed'});}});
 app.post('/api/quant/discuss',(req:Request,res:Response)=>{const a=req.body?.analysis;if(!a||typeof a.symbol!=='string'){res.status(400).json({success:false,message:'Valid analysis is required'});return;}res.json({success:true,mode:'RULE_BASED_ANALYST',discussion:a.symbol+' is '+a.direction+' with composite score '+a.score+'. RSI '+a.rsi+', relative volume '+a.volumeRatio+'x and MACD histogram '+Number(a.macdHistogram).toPrecision(4)+'. '+(a.reasons||[]).join('; ')+'. These are technical conditions, not a probability or guaranteed forecast. Check higher timeframe, spread, funding, slippage and event risk.'});});
}
