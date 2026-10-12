import {mountIcons,setBusy,createToast} from '../components.js';
const $=s=>document.querySelector(s),toast=createToast($('#toast'));
const names={button:'按钮',input:'输入框',loader:'加载器',switch:'开关',card:'卡片',other:'其他'};
const statuses={candidate:'候选',adapted:'已适配',verified:'已验证',retired:'停用'};
let registry={providers:[],materials:[]};
const termContent=$('#sample-term').innerHTML;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeLink=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'#'}catch{return '#'}};
mountIcons();
$('#reduce-motion').addEventListener('change',e=>document.documentElement.dataset.reduceMotion=String(e.target.checked));
$('#preview-width').addEventListener('change',e=>{const grid=$('#component-grid');grid.classList.remove('preview-small','preview-medium','preview-large');if(['small','medium','large'].includes(e.target.value))grid.classList.add('preview-'+e.target.value)});
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(el=>{el.classList.toggle('active',el===button);el===button?el.setAttribute('aria-current','page'):el.removeAttribute('aria-current')});$('#components-view').hidden=button.dataset.tab!=='components';$('#sources-view').hidden=button.dataset.tab!=='sources'}));
$('#preview-state').addEventListener('change',e=>{
  const state=e.target.value,button=$('#sample-primary'),input=$('#sample-input');
  setBusy(button,state==='busy');button.disabled=['busy','disabled'].includes(state);$('#sample-secondary').disabled=['busy','disabled','empty'].includes(state);input.disabled=state==='disabled';input.setAttribute('aria-invalid',String(state==='error'));
  $('#input-note').textContent={error:'未找到这个词条，请换个关键词',success:'已找到示例词条',busy:'正在检索…',empty:'输入内容后开始检索'}[state]||'例如 resilient';
  $('#sample-status').className=`lx-badge ${state==='error'?'error':state==='success'?'success':''}`;
  $('#sample-status').textContent={error:'检索失败',success:'本地命中',empty:'暂无结果',disabled:'已禁用',busy:'检索中'}[state]||'本地命中';
  $('#sample-loader').hidden=state!=='busy';
  $('#sample-switch').disabled=state==='disabled';
  $('#sample-term').classList.toggle('is-empty',state==='empty');$('#sample-term').innerHTML=state==='empty'?'暂无词条，输入英文后开始检索。':termContent;
  if($('#sample-term details'))$('#sample-term details').hidden=!$('#sample-switch').checked;
});
$('#sample-primary').addEventListener('click',()=>toast('按钮交互已触发 · 组件演示'));
$('#sample-secondary').addEventListener('click',async()=>{try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText('Lexicon UI · 示例译文');toast('示例译文已复制')}catch{toast('复制未完成，请手动复制')}});
$('#sample-switch').addEventListener('change',e=>{const details=$('#sample-term details');if(details)details.hidden=!e.target.checked;toast(e.target.checked?'已显示词源解释':'已隐藏词源解释')});
async function api(path,data){const response=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:undefined);const result=await response.json();if(!response.ok)throw Error(result.error||'保存失败');return result}
async function refresh(){registry=await api('/api/registry');renderRegistry()}
function renderRegistry(){
  $('#material-count').textContent=registry.materials.length;
  const verified=registry.materials.filter(m=>m.status==='verified').length;
  $('#registry-summary').textContent=`${registry.materials.length} 份素材 · ${verified} 份已验证 · 保留原始快照与许可`;
  $('#providers').innerHTML=registry.providers.map(p=>`<article class="lx-card provider"><div class="provider-head"><h3>${esc(p.name)}</h3><span class="lx-badge ${p.status==='active'?'success':''}">${p.status==='active'?'供给中':'已暂停'}</span></div><p>${esc(p.allowedHosts.join(' / '))}<br>${p.categories.map(c=>names[c]||c).map(esc).join(' · ')}</p><div class="provider-actions"><a href="${esc(safeLink(p.homepage))}" target="_blank" rel="noreferrer">访问网站 ↗</a><button class="lx-button" data-provider="${esc(p.id)}" data-next="${p.status==='active'?'paused':'active'}">${p.status==='active'?'暂停来源':'启用来源'}</button></div></article>`).join('');
  const selected=$('#material-provider').value;
  $('#material-provider').innerHTML=registry.providers.filter(p=>p.status==='active').map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if([...$('#material-provider').options].some(o=>o.value===selected))$('#material-provider').value=selected;
  updateCategories();renderMaterials();
}
function updateCategories(){const provider=registry.providers.find(p=>p.id===$('#material-provider').value);$('#material-category').innerHTML=(provider?.categories||[]).map(c=>`<option value="${esc(c)}">${esc(names[c]||c)}</option>`).join('')}
$('#material-provider').addEventListener('change',updateCategories);
function renderMaterials(){
  const filter=$('#material-filter').value;
  const materials=registry.materials.filter(m=>filter==='all'||m.category===filter);
  $('#materials').innerHTML=materials.length?materials.map(m=>`<article class="lx-card material"><div class="material-head"><h3>${esc(m.name)}</h3><span class="lx-badge status-${esc(m.status)}">${esc(statuses[m.status]||m.status)}</span></div><p>${esc(names[m.category]||m.category)} · ${esc(m.author)}${m.originalCredit&&m.originalCredit!==m.author?`<br>原始代码署名：${esc(m.originalCredit)}`:''}</p><div class="material-meta"><span class="lx-badge">${esc(m.license)}</span><span class="lx-badge">${m.licenseStatus==='confirmed'?'许可已留档':m.licenseStatus==='declared'?'许可待复核':'许可待确认'}</span></div><a href="${esc(safeLink(m.sourceUrl))}" target="_blank" rel="noreferrer">查看素材来源 ↗</a>${m.licenseEvidence?` · <a href="${esc(safeLink(m.licenseEvidence))}" target="_blank" rel="noreferrer">许可依据 ↗</a>`:''}<details data-source="${esc(m.id)}"><summary>原始代码与使用记录</summary><p>使用位置：${esc(m.usedIn.join('、')||'尚未接入项目')}</p><p>${esc(m.verification.join('；')||'等待适配与检查')}</p><p class="audit-note">版本 ${esc(m.version)}<br>SHA-256 ${esc(m.contentHash)}</p><pre>展开后读取本地快照…</pre></details></article>`).join(''):'<div class="lx-empty">这个类型还没有素材。</div>';
  $('#materials').querySelectorAll('details').forEach(details=>details.addEventListener('toggle',async()=>{if(!details.open||details.dataset.loaded)return;try{const data=await api('/api/source?id='+encodeURIComponent(details.dataset.source));details.querySelector('pre').textContent=data.code;details.dataset.loaded='true'}catch(e){details.querySelector('pre').textContent=e.message}}));
}
$('#material-filter').addEventListener('change',renderMaterials);
$('#providers').addEventListener('click',async e=>{const button=e.target.closest('[data-provider]');if(!button)return;button.disabled=true;try{await api('/api/providers/status',{id:button.dataset.provider,status:button.dataset.next});await refresh();toast('来源状态已保存，已接入组件仍可使用')}catch(error){toast(error.message);button.disabled=false}});
for(const [open,close,form] of [['#add-site-open','#add-site-close','#provider-form'],['#import-open','#import-close','#material-form']]){$(open).addEventListener('click',()=>{$(form).hidden=false;$(form).querySelector('input,select').focus()});$(close).addEventListener('click',()=>{$(form).hidden=true;$(open).focus()})}
for(const [formId,path] of [['#provider-form','/api/providers'],['#material-form','/api/materials']]){
  $(formId).addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]'),message=form.querySelector('.form-message');button.disabled=true;message.textContent='正在保存…';try{await api(path,Object.fromEntries(new FormData(form)));form.reset();await refresh();message.textContent='';form.hidden=true;$(formId==='#provider-form'?'#add-site-open':'#import-open').focus();toast(formId==='#provider-form'?'网站已登记，可以导入素材':'候选素材已保存，等待适配与检查')}catch(error){message.textContent=error.message}finally{button.disabled=false}});
}
$('#export-registry').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(registry,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lexicon-ui-materials.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出素材清单')});
refresh().catch(e=>{$('#load-error').hidden=false;$('#load-error').textContent='素材库暂时无法读取。请使用项目中的启动脚本打开工具。'+e.message;$('#registry-summary').textContent='素材库未连接'});
// Local files populate the candidate text field; their contents are never evaluated.
const fileLabel=document.createElement('label');
fileLabel.className='file-field';fileLabel.textContent='选择源码文件（可选，HTML / CSS / TXT，最多 64 KB）';
const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='.html,.css,.txt';fileInput.id='source-file';fileLabel.append(fileInput);
$('#material-form .form-note').before(fileLabel);
fileInput.addEventListener('change',async()=>{
  const file=fileInput.files[0];if(!file)return;
  const form=$('#material-form'),message=form.querySelector('.form-message'),submit=form.querySelector('[type=submit]');
  if(file.size>65536||!/[.](html|css|txt)$/i.test(file.name)){message.textContent='请选择 64 KB 以内的 HTML、CSS 或 TXT 文件';fileInput.value='';return}
  submit.disabled=true;message.textContent='正在读取本机文件…';
  try{form.querySelector('[name=code]').value=await file.text();message.textContent='已读取源码，请核对来源、作者与许可'}catch{message.textContent='文件未能读取，请手动粘贴代码'}finally{submit.disabled=false}
});
