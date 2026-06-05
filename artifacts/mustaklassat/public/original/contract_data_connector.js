function saveToLocalStorage(k,d){try{localStorage.setItem(k,JSON.stringify(d))}catch(e){console.error('saveToLocalStorage',k,e)}}
function loadFromLocalStorage(k){try{var d=localStorage.getItem(k);return d?JSON.parse(d):null}catch(e){console.error('loadFromLocalStorage',k,e);return null}}
function manualCompanyKey(h){return 'manualCompanyName__h__'+encodeURIComponent(h||'')}
function getManualCompanyName(h){try{return localStorage