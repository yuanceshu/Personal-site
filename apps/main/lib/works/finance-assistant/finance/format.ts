export function formatCurrencyFromCents(cents:number){return `¥${(cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
export function formatWanYuanFromCents(cents:number){return `¥${(cents/100/10000).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}万`;}
export function formatPercent(ratio:number|null){return ratio===null?'—':`${(ratio*100).toFixed(2)}%`;}
