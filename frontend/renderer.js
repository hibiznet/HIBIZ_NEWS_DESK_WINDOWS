let page='search';
let providers=[];
let current=null;
let searchRows=[];

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Date(s).toLocaleString('ko-KR'):'-';

function showPage(name){
  page=name;
  ['search','reader','db','api'].forEach(p=>$(p+'Page').classList.toggle('hidden',p!==name));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
  if(name==='db') loadDb();
  if(name==='api') renderApis();
}

document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$('backBtn').onclick=()=>showPage('search');

async function loadProviders(){
  providers=await window.hibiz.providers.list();
  $('providerSelect').innerHTML='<option value="">전체 활성 API</option>'+providers.filter(p=>p.enabled).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  renderApis();
}

async function doSearch(){
  const q=$('query').value.trim();
  if(!q){$('searchError').textContent='검색어를 입력해 주세요.';$('searchError').classList.remove('hidden');return;}
  $('searchError').classList.add('hidden');$('searchBtn').disabled=true;$('searchBtn').textContent='검색 중...';
  try{
    const id=$('providerSelect').value;
    const r=await window.hibiz.news.search({query:q,providerIds:id?[id]:[]});
    searchRows=r.rows||[];
    let html='';
    if(r.errors?.length){$('searchError').textContent='일부 API 검색 실패:\n'+r.errors.join('\n');$('searchError').classList.remove('hidden');}
    if(!searchRows.length) html='<div class="empty">검색 결과가 없습니다.</div>';
    else html=searchRows.map((n,i)=>`<article class="card"><div class="source">${esc(n.sourceName||'Unknown')} · ${date(n.publishedAt)}</div><h2>${esc(n.title)}</h2><p>${esc(n.description||'설명이 없습니다.')}</p><div class="actions"><button onclick="readNews(${i})">기사 읽기</button><button class="${n.saved?'saved':''}" ${n.saved?'disabled':''} onclick="saveSearchNews(${i})">${n.saved?'✓ 저장됨':'저장'}</button></div></article>`).join('');
    $('results').innerHTML=html;
  }catch(e){$('searchError').textContent=e.message||String(e);$('searchError').classList.remove('hidden');}
  finally{$('searchBtn').disabled=false;$('searchBtn').textContent='검색';}
}
$('searchBtn').onclick=doSearch;
$('query').onkeydown=e=>{if(e.key==='Enter')doSearch()};

window.readNews=i=>{current={...searchRows[i]};renderReader();showPage('reader')};
window.saveSearchNews=async i=>{const r=await window.hibiz.news.save(searchRows[i]);if(r.saved||r.already){searchRows[i].saved=true;renderSearchRows();await updateCount()}};
function renderSearchRows(){
  $('results').innerHTML=searchRows.map((n,i)=>`<article class="card"><div class="source">${esc(n.sourceName||'Unknown')} · ${date(n.publishedAt)}</div><h2>${esc(n.title)}</h2><p>${esc(n.description||'설명이 없습니다.')}</p><div class="actions"><button onclick="readNews(${i})">기사 읽기</button><button class="${n.saved?'saved':''}" ${n.saved?'disabled':''} onclick="saveSearchNews(${i})">${n.saved?'✓ 저장됨':'저장'}</button></div></article>`).join('');
}

function hasGoogleApi(){
  return providers.some(p=>p.provider==='google_translate' && p.enabled && p.apiKey);
}
function renderReader(){
  $('readerSource').textContent=`${current.sourceName||'Unknown'} · ${date(current.publishedAt)}`;
  $('readerTitle').textContent=current.title||'';
  $('readerDescription').textContent=current.description||'검색 API에서 제공하는 설명이 없습니다.';
  $('readerContent').textContent=current.content||'이 뉴스 API는 전체 본문을 제공하지 않습니다. 원문 사이트에서 확인해 주세요.';
  $('readerSaveBtn').textContent=current.saved?'✓ 저장됨':'내 뉴스 DB에 저장';
  $('readerSaveBtn').disabled=!!current.saved;
  $('apiTranslateBtn').disabled=!hasGoogleApi();
  $('apiTranslateBtn').title=hasGoogleApi()?'Google Cloud Translation API로 바로 번역합니다.':'API 관리에서 Google Cloud Translation API Key를 등록해 주세요.';
  $('translatedBox').classList.add('hidden');
  $('translatedContent').textContent='';
}
$('popupTranslateBtn').onclick=()=>window.hibiz.openGoogleTranslatePopup();
$('apiTranslateBtn').onclick=async()=>{
  if(!hasGoogleApi()){alert('Google Cloud Translation API Key가 등록되어 있지 않습니다. API 관리에서 등록해 주세요.');return;}
  const text=[current.title,current.description,current.content].filter(Boolean).join('\n\n');
  if(!text.trim()){alert('번역할 원문이 없습니다.');return;}
  const btn=$('apiTranslateBtn');btn.disabled=true;btn.textContent='번역 중...';
  try{
    const r=await window.hibiz.googleTranslate(text,$('langSelect').value);
    $('translatedContent').textContent=r.text||'';
    $('translatedBox').classList.remove('hidden');
  }catch(e){alert('Google API 번역 실패: '+(e.message||e));}
  finally{btn.disabled=!hasGoogleApi();btn.textContent='구글(API)번역';}
};
$('originalBtn').onclick=()=>window.hibiz.openUrl(current.sourceUrl);
$('readerSaveBtn').onclick=async()=>{const r=await window.hibiz.news.save(current);if(r.saved||r.already){current.saved=true;renderReader();await updateCount()}};

async function loadDb(){
  const r=await window.hibiz.news.list({q:$('dbQuery').value,category:$('dbCategory').value,page:1,limit:50});
  const rows=r.rows||[];
  const cats=await window.hibiz.news.categories();
  const selected=$('dbCategory').value;
  $('dbCategory').innerHTML='<option value="전체">전체</option>'+cats.map(c=>`<option value="${esc(c.category)}">${esc(c.category)} (${c.count})</option>`).join('');
  if([...$('dbCategory').options].some(o=>o.value===selected))$('dbCategory').value=selected;
  $('dbResults').innerHTML=rows.length?rows.map(n=>`<article class="card"><div class="source">${esc(n.source_name)} · ${date(n.published_at)} · ${esc(n.category)}</div><h2>${esc(n.title)}</h2><p>${esc(n.description||'')}</p><div class="actions"><button onclick="openSaved(${n.id})">기사 보기</button><button onclick="window.hibiz.openUrl('${String(n.source_url).replace(/'/g,"\\'")}')">원문 사이트</button><button class="danger" onclick="deleteSaved(${n.id})">삭제</button></div></article>`).join(''):'<div class="empty">저장된 뉴스가 없습니다.</div>';
  await updateCount();
}
$('dbSearchBtn').onclick=loadDb;$('dbQuery').onkeydown=e=>{if(e.key==='Enter')loadDb()};$('dbCategory').onchange=loadDb;
window.openSaved=async id=>{const n=await window.hibiz.news.get(id);current={title:n.title,description:n.description,content:n.content,sourceName:n.source_name,sourceUrl:n.source_url,publishedAt:n.published_at,saved:true};renderReader();showPage('reader')};
window.deleteSaved=async id=>{if(confirm('이 뉴스를 삭제하시겠습니까?')){await window.hibiz.news.delete(id);await loadDb()}};

function renderApis(){
  $('apiGrid').innerHTML=providers.map(p=>`<div class="api-card"><h2>${esc(p.name)}</h2><div class="meta">${esc(p.provider)} · <span class="status ${p.enabled?'on':'off'}">${p.enabled?'활성':'비활성'}</span></div><p>API Key: ${esc(p.apiKey||'미등록')}</p><div class="actions"><button onclick="testApi('${p.id}')">${p.provider==='google_translate'?'번역 테스트':'연결 테스트'}</button><button onclick="editApi('${p.id}')">수정</button><button onclick="toggleApi('${p.id}')">${p.enabled?'비활성화':'활성화'}</button><button class="danger" onclick="deleteApi('${p.id}')">삭제</button></div></div>`).join('')+`<div class="api-card info"><h2>Google 번역</h2><p><b>Google Cloud Translation API</b>를 등록하면 기사 읽기 화면의 <b>구글(API)번역</b> 버튼이 활성화됩니다.</p><p>API 키가 없어도 <b>구글번역 팝업열기</b>는 사용할 수 있습니다.</p><p>Google Cloud에서 Translation API를 활성화한 API Key를 등록해 주세요.</p></div>`;
}
$('addApiBtn').onclick=()=>{ $('apiForm').classList.remove('hidden');$('apiId').value='';$('apiName').value='GNews';$('apiProvider').value='gnews';$('apiKey').value='';$('apiKey').placeholder='API Key 입력'};
$('apiCancelBtn').onclick=()=>$('apiForm').classList.add('hidden');
$('apiSaveBtn').onclick=async()=>{const p={id:$('apiId').value||undefined,name:$('apiName').value,provider:$('apiProvider').value,apiKey:$('apiKey').value,enabled:true};await window.hibiz.providers.save(p);$('apiForm').classList.add('hidden');await loadProviders()};
window.editApi=id=>{const p=providers.find(x=>x.id===id);$('apiForm').classList.remove('hidden');$('apiId').value=p.id;$('apiName').value=p.name;$('apiProvider').value=p.provider;$('apiKey').value='';$('apiKey').placeholder='기존 키 유지: 비워두고 저장'};
window.testApi=async id=>{const r=await window.hibiz.providers.test(id);alert(r.message)};
window.toggleApi=async id=>{await window.hibiz.providers.toggle(id);await loadProviders()};
window.deleteApi=async id=>{if(confirm('API 설정을 삭제하시겠습니까?')){await window.hibiz.providers.delete(id);await loadProviders()}};

async function updateCount(){ $('dbBadge').textContent=await window.hibiz.news.count() }

(async()=>{try{await loadProviders();await loadDb();await updateCount()}catch(e){$('searchError').textContent='초기화 오류: '+e.message;$('searchError').classList.remove('hidden')}})();
