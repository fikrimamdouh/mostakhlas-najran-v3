function saveToLocalStorage(k,d){try{localStorage.setItem(k,JSON.stringify(d))}catch(e){console.error('save localStorage',k,e)}}
function loadFromLocalStorage(k){try{var d=localStorage.getItem(k);return d?JSON.parse(d):null}catch(e){console.error('load localStorage',k,e);return null}}
function manualCompanyKey(h){return 'manualCompanyName__h__'+encodeURIComponent(h||'')}
function get