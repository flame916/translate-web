const paths = {
  book:'<path d="M4 4h6c2 0 2 2 2 2s0-2 2-2h6v15h-6c-2 0-2 1-2 1s0-1-2-1H4z"/><path d="M12 6v14"/>',
  pin:'<path d="m8 3 8 0-1 7 3 3v2H6v-2l3-3z"/><path d="M12 15v6"/>',
  history:'<path d="M4 7a8 8 0 1 1-1 8"/><path d="M4 3v5h5M12 7v5l3 2"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V4H4v11h4"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  grid:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'
};
export function icon(name) {return `<svg class="lx-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.grid}</svg>`}
export function mountIcons(root=document) {root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon))}
export function setBusy(button,busy,label='开始翻译',busyLabel='处理中…') {button.disabled=busy;button.setAttribute('aria-busy',String(busy));button.innerHTML=busy?`<span class="lx-loader" aria-hidden="true"></span>${busyLabel}`:label}
export function createToast(element) {let timer;return message=>{element.textContent=message;element.hidden=false;element.classList.remove('hidden');clearTimeout(timer);timer=setTimeout(()=>element.hidden=true,3500)}}
export function createModal(overlay,background,initial) {
  let previous,oldOverflow;
  const visible=()=>!overlay.classList.contains('hidden');
  const close=()=>{if(!visible())return;overlay.classList.add('hidden');background.inert=false;document.body.style.overflow=oldOverflow;previous?.focus()};
  const open=()=>{if(visible())return;previous=document.activeElement;oldOverflow=document.body.style.overflow;overlay.classList.remove('hidden');background.inert=true;document.body.style.overflow='hidden';initial.focus()};
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  overlay.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();close()}
    if(e.key!=='Tab')return;
    const items=[...overlay.querySelectorAll('button,input,textarea,select,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(!items.length){e.preventDefault();return}
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  });
  return {open,close};
}
