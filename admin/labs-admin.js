(() => {
  'use strict';
  const API = 'https://viora-auth-website.onrender.com';
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token = () => { try { return sessionStorage.getItem('viora_admin_session') || JSON.parse(localStorage.getItem('viora_session') || 'null')?.token || ''; } catch { return ''; } };
  let tools = [], articles = [], editingTool = null, editingArticle = null, coverImageId = '', blocks = [], busy = false;
  let previewUrls = [];
  const adminImageUrls = [];
  async function loadAdminImage(img, id) { try { const response=await fetch(API+'/api/admin/labs/media/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token()},cache:'no-store'}); if(!response.ok)return; const url=URL.createObjectURL(await response.blob()); adminImageUrls.push(url); img.src=url; } catch {} }

  async function api(path, options = {}) {
    const headers = { Authorization: 'Bearer ' + token(), ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...(options.headers || {}) };
    const response = await fetch(API + path, { ...options, headers, cache:'no-store' });
    const type = response.headers.get('content-type') || '';
    if (type.includes('image/')) return response;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Labs management request failed (' + response.status + ').');
    return data;
  }
  function status(message = '', error = false) {
    const el = $('#labs-admin-status'); el.textContent = message; el.dataset.error = String(error);
  }
  function fail(error) { $('#labs-admin-error').textContent = error.message || String(error); $('#labs-admin-error').classList.add('show'); status('', true); }
  function clearFail() { $('#labs-admin-error').textContent = ''; $('#labs-admin-error').classList.remove('show'); }
  function slug(value) { return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70); }
  function date(value) { return value ? new Date(value).toLocaleDateString() : '—'; }
  function showTab(name) {
    document.querySelectorAll('[data-labs-tab]').forEach(b => { const on = b.dataset.labsTab === name; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
    document.querySelectorAll('[data-labs-panel]').forEach(p => { const on = p.dataset.labsPanel === name; p.hidden = !on; p.classList.toggle('active', on); });
    status('');
    if (name === 'articles' && !articles.length) loadArticles().catch(fail);
  }
  async function loadTools() {
    clearFail(); status('Loading Labs tools…');
    const data = await api('/api/admin/labs/tools'); tools = data.tools || [];
    $('#labs-tool-count').textContent = String(tools.length); renderTools(); status('Tools loaded from private server storage.');
  }
  async function loadArticles() {
    clearFail(); status('Loading articles…');
    const data = await api('/api/admin/labs/articles'); articles = data.articles || [];
    $('#labs-article-count').textContent = String(articles.length); renderArticles(); status('Articles loaded from private server storage.');
  }
  function renderTools() {
    const root = $('#labs-tools-list'); root.replaceChildren();
    if (!tools.length) { root.innerHTML = '<div class="empty">No tools yet. Add your first Labs tool.</div>'; return; }
    for (const t of [...tools].sort((a,b) => a.order - b.order)) {
      const row = document.createElement('div'); row.className = 'labs-tool-row';
      const mark = document.createElement('div'); mark.className = 'labs-tool-mark';
      if (t.imageId) { const img = document.createElement('img'); img.alt = ''; loadAdminImage(img,t.imageId); img.onerror = () => { mark.textContent = t.icon || '✦'; }; mark.append(img); }
      else mark.textContent = t.icon || '✦';
      const copy = document.createElement('div'); copy.className = 'labs-row-copy';
      const title = document.createElement('b'); title.textContent = t.name;
      const desc = document.createElement('p'); desc.textContent = t.short;
      const meta = document.createElement('div'); meta.className = 'labs-row-meta';
      for (const [label, cls] of [[t.active?'Active':'Hidden',t.active?'live':''],[t.assistant?'Connected':'Upcoming',t.assistant?'live':''],[t.category,''],[t.featured?'Featured':'','']]) if(label) { const pill=document.createElement('span');pill.className='labs-pill '+cls;pill.textContent=label;meta.append(pill); }
      copy.append(title,desc,meta);
      const actions=document.createElement('div');actions.className='labs-row-actions';
      for (const [label,action] of [['↑','up'],['↓','down'],['Edit','edit'],['Delete','delete']]) { const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;b.dataset.toolAction=action;b.dataset.id=t.id;actions.append(b); }
      row.append(mark,copy,actions); root.append(row);
    }
  }
  async function saveTools() {
    status('Publishing Labs tools…');
    const data = await api('/api/admin/labs/tools',{method:'POST',body:JSON.stringify({tools})});
    tools=data.tools; renderTools(); $('#labs-tool-count').textContent=String(tools.length); status('Labs tools published. The public Labs page will show the updated content.');
  }
  function toolFormData(t = {}) {
    const form=$('#labs-tool-form');
    for(const name of ['name','id','short','description','category','icon','order','assistant','documentationUrl']) form.elements[name].value=t[name] ?? ({category:'General',icon:'✦',order:tools.length+1,assistant:'',documentationUrl:''}[name] ?? '');
    form.elements.featured.checked=!!t.featured;form.elements.active.checked=t.active!==false;
    form.elements.id.disabled=!!t.id && ['humanizer','pro-search','code','math'].includes(t.id);
    $('#labs-tool-form-title').textContent=t.id?'Edit '+t.name:'New Labs tool';
    const preview=$('#labs-tool-image-preview');preview.replaceChildren();
    if(t.imageId){const img=document.createElement('img');loadAdminImage(img,t.imageId);img.alt='Current tool image';preview.append(img);}else preview.textContent='No image selected';
    form.dataset.imageId=t.imageId||''; form.elements.image.value='';
    updateToolPreview();
    form.hidden=false;form.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function updateToolPreview() {
    const f=$('#labs-tool-form'), name=f.elements.name.value.trim()||'Tool name', desc=f.elements.short.value.trim()||'Your tool description will appear here.';
    $('#labs-tool-preview').querySelector('b').textContent=name;
    $('#labs-tool-preview').querySelector('p').textContent=desc;
    $('#labs-tool-preview').querySelector('.labs-preview-icon').textContent=f.elements.icon.value||'✦';
  }
  async function uploadImage(file) {
    if(!file) return null;
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP, or GIF image.');
    if(file.size>3*1024*1024) throw new Error('Images must be smaller than 3 MB.');
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read image.'));reader.readAsDataURL(file);});
    const result=await api('/api/admin/labs/media',{method:'POST',body:JSON.stringify({name:file.name,contentType:file.type,data})});
    return result.imageId;
  }
  async function toolSubmit(event) {
    event.preventDefault();if(busy)return;busy=true;clearFail();
    const form=$('#labs-tool-form'), old=editingTool?tools.find(t=>t.id===editingTool):null;
    const button=form.querySelector('[type=submit]');button.disabled=true;
    try {
      const file=form.elements.image.files[0];let imageId=form.dataset.imageId||'';
      if(file){status('Uploading tool image…');imageId=await uploadImage(file);}
      const id=old?.id || slug(form.elements.id.value || form.elements.name.value);
      const item={id,name:form.elements.name.value.trim(),short:form.elements.short.value.trim(),description:form.elements.description.value.trim(),
        category:form.elements.category.value.trim()||'General',icon:form.elements.icon.value.trim()||'✦',order:Number(form.elements.order.value),
        assistant:form.elements.assistant.value,imageId,featured:form.elements.featured.checked,active:form.elements.active.checked,documentationUrl:form.elements.documentationUrl.value.trim()};
      if(!item.name||!item.short||!item.id)throw new Error('Enter a tool name, short description, and valid URL slug.');
      const next=old?tools.map(t=>t.id===old.id?item:t):[...tools,item];
      if(next.some((t,i)=>next.findIndex(x=>x.id===t.id)!==i))throw new Error('That URL slug is already in use.');
      tools=next;await saveTools();form.hidden=true;editingTool=null;
    } catch(e){fail(e);} finally {busy=false;button.disabled=false;}
  }
  function renderArticles() {
    const root=$('#labs-articles-list');root.replaceChildren();
    if(!articles.length){root.innerHTML='<div class="empty">No articles yet. Create your first technology article.</div>';return;}
    for(const a of articles){
      const row=document.createElement('div');row.className='labs-article-row';
      if(a.coverImageId){const img=document.createElement('img');loadAdminImage(img,a.coverImageId);img.alt='';row.append(img);}
      const copy=document.createElement('div');copy.className='labs-row-copy';const title=document.createElement('b');title.textContent=a.title;const desc=document.createElement('p');desc.textContent=a.subtitle;const meta=document.createElement('div');meta.className='labs-row-meta';
      for(const [label,cls] of [[a.status==='published'?'Published':'Draft',a.status==='published'?'live':'draft'],[a.category,''],[date(a.publishedAt||a.updatedAt),'']]){const p=document.createElement('span');p.className='labs-pill '+cls;p.textContent=label;meta.append(p);}
      copy.append(title,desc,meta);const actions=document.createElement('div');actions.className='labs-row-actions';
      const edit=document.createElement('button');edit.className='btn';edit.type='button';edit.textContent='Edit';edit.dataset.articleAction='edit';edit.dataset.id=a.id;
      const preview=document.createElement('button');preview.className='btn';preview.type='button';preview.textContent='Preview';preview.dataset.articleAction='preview';preview.dataset.id=a.id;
      const del=document.createElement('button');del.className='btn';del.type='button';del.textContent='Delete';del.dataset.articleAction='delete';del.dataset.id=a.id;
      actions.append(edit,preview,del);row.append(copy,actions);root.append(row);
    }
  }
  function articleFormData(a=null) {
    const f=$('#labs-article-form');editingArticle=a?.id||null;blocks=(a?.blocks||[]).map(b=>({...b,items:b.items?[...b.items]:undefined}));coverImageId=a?.coverImageId||'';
    for(const name of ['title','subtitle','author','category','tags','status'])f.elements[name].value=a? (name==='tags'?(a.tags||[]).join(', '):a[name]??'') : ({author:'Viora Team',category:'Technology',status:'draft'}[name]||'');
    f.elements.featured.checked=!!a?.featured;f.elements.title.dataset.id=a?.id||'';
    const p=$('#labs-cover-preview');p.replaceChildren();if(coverImageId){const img=document.createElement('img');loadAdminImage(img,coverImageId);img.alt='Current cover image';p.append(img);}else p.textContent='No cover image selected';
    f.elements.cover.value='';renderBlocks();$('#labs-article-form-title').textContent=a?'Edit article':'New article';f.hidden=false;f.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function renderBlocks() {
    const root=$('#labs-article-blocks');root.replaceChildren();
    if(!blocks.length){root.innerHTML='<div class="empty">Add your first content block.</div>';return;}
    blocks.forEach((block,index)=>{
      const box=document.createElement('div');box.className='labs-block';box.dataset.index=String(index);
      const head=document.createElement('div');head.className='labs-block-head';const title=document.createElement('b');title.textContent=block.type.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());const up=document.createElement('button');up.type='button';up.className='btn';up.textContent='↑';up.dataset.blockAction='up';up.dataset.index=index;const down=document.createElement('button');down.type='button';down.className='btn';down.textContent='↓';down.dataset.blockAction='down';down.dataset.index=index;const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Remove';remove.dataset.blockAction='remove';remove.dataset.index=index;head.append(title,up,down,remove);box.append(head);
      const field=(key,value,placeholder,multi=true)=>{const el=document.createElement(multi?'textarea':'input');el.dataset.field=key;el.value=value||'';el.placeholder=placeholder||'';box.append(el);};
      if(['heading','paragraph','quote','code'].includes(block.type))field('text',block.text,'Write your '+block.type+'…');
      else if(block.type==='bulleted-list'||block.type==='numbered-list')field('items',(block.items||[]).join('\n'),'One list item per line');
      else if(block.type==='link'){field('text',block.text,'Link text',false);field('url',block.url,'https://example.com',false);}
      else if(block.type==='image'){
        if(block.imageId){const img=document.createElement('img');loadAdminImage(img,block.imageId);img.alt=block.alt||'';img.style.cssText='max-width:100%;max-height:130px;object-fit:contain;border-radius:8px;margin-bottom:8px';box.append(img);}
        const upload=document.createElement('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp,image/gif';upload.dataset.field='file';box.append(upload);
        const grid=document.createElement('div');grid.className='labs-block-grid';for(const [key,ph] of [['alt','Accessible image description'],['caption','Image caption']]){const inp=document.createElement('input');inp.dataset.field=key;inp.value=block[key]||'';inp.placeholder=ph;grid.append(inp);}box.append(grid);
      }
      root.append(box);
    });
  }
  async function readBlocks() {
    const root=$('#labs-article-blocks');
    for(const box of root.querySelectorAll('.labs-block')){
      const i=Number(box.dataset.index),b=blocks[i];if(!b)continue;
      for(const field of box.querySelectorAll('[data-field]')){
        const key=field.dataset.field;
        if(key==='file'&&field.files[0]){status('Uploading article image…');b.imageId=await uploadImage(field.files[0]);continue;}
        if(key==='items')b.items=field.value.split('\n').map(x=>x.trim()).filter(Boolean);
        else if(key!=='file')b[key]=field.value;
      }
    }
    return blocks;
  }
  function renderBlockPreview(b, imageUrls) {
    if(b.type==='heading')return '<h2>'+esc(b.text)+'</h2>';
    if(b.type==='paragraph')return '<p>'+esc(b.text).replace(/\n/g,'<br>')+'</p>';
    if(b.type==='quote')return '<blockquote>'+esc(b.text)+'</blockquote>';
    if(b.type==='code')return '<pre><code>'+esc(b.text)+'</code></pre>';
    if(b.type==='bulleted-list'||b.type==='numbered-list')return '<'+(b.type==='bulleted-list'?'ul':'ol')+'>' +(b.items||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</'+(b.type==='bulleted-list'?'ul':'ol')+'>';
    if(b.type==='link')return '<p><a href="'+esc(b.url)+'" target="_blank" rel="noopener noreferrer">'+esc(b.text||b.url)+'</a></p>';
    if(b.type==='image')return '<figure><img src="'+esc(imageUrls.get(b.imageId)||'')+'" alt="'+esc(b.alt)+'"><figcaption>'+esc(b.caption)+'</figcaption></figure>';
    return '';
  }
  async function openPreview(article) {
    const ids=[article.coverImageId,...article.blocks.filter(b=>b.type==='image').map(b=>b.imageId)].filter(Boolean), urls=new Map();
    for(const id of ids){const response=await api('/api/admin/labs/media/'+encodeURIComponent(id));const blob=await response.blob();const url=URL.createObjectURL(blob);previewUrls.push(url);urls.set(id,url);}
    const root=$('#labs-preview-content');
    root.innerHTML='<div class="eyebrow">'+esc(article.category)+' · '+esc(article.author)+'</div><h1>'+esc(article.title)+'</h1><p class="subtitle">'+esc(article.subtitle)+'</p>'+
      (article.coverImageId?'<figure><img src="'+esc(urls.get(article.coverImageId))+'" alt="Cover image"></figure>':'')+
      '<p class="labs-preview-byline">By '+esc(article.author)+' · '+esc(article.status)+'</p>'+article.blocks.map(b=>renderBlockPreview(b,urls)).join('');
    $('#labs-preview-dialog').showModal();
  }
  async function submitArticle(event) {
    event.preventDefault();if(busy)return;busy=true;clearFail();const f=$('#labs-article-form'),button=f.querySelector('[type=submit]');button.disabled=true;
    try{
      const file=f.elements.cover.files[0];if(file)coverImageId=await uploadImage(file);
      const title=f.elements.title.value.trim(),id=f.elements.title.dataset.id||slug(title);
      const article={id,title,subtitle:f.elements.subtitle.value.trim(),author:f.elements.author.value.trim(),category:f.elements.category.value.trim(),
        tags:f.elements.tags.value.split(',').map(x=>x.trim()).filter(Boolean),coverImageId,blocks:await readBlocks(),status:f.elements.status.value,featured:f.elements.featured.checked};
      const data=await api('/api/admin/labs/articles',{method:'POST',body:JSON.stringify(article)});
      articles=[data.article,...articles.filter(a=>a.id!==data.article.id)];renderArticles();$('#labs-article-count').textContent=String(articles.length);
      f.hidden=true;editingArticle=null;status(article.status==='published'?'Article published to Viora Labs.':'Draft saved privately.');
    }catch(e){fail(e);}finally{busy=false;button.disabled=false;}
  }
  async function deleteArticle(id) {
    const article=articles.find(a=>a.id===id);if(!article)return;
    if(!confirm('Permanently delete “'+article.title+'”? This cannot be undone.'))return;
    try{await api('/api/admin/labs/articles/'+encodeURIComponent(id),{method:'DELETE'});articles=articles.filter(a=>a.id!==id);renderArticles();$('#labs-article-count').textContent=String(articles.length);status('Article deleted.');}
    catch(e){fail(e);}
  }
  function previewCurrentTool() {
    const f=$('#labs-tool-form');updateToolPreview();status('Preview updated. This is how the tool card will be presented.');
  }
  async function loadAll() { try { await loadTools(); await loadArticles(); } catch(e) { fail(e); } }

  $('#nav').addEventListener('click',e=>{const button=e.target.closest('[data-view="labs"]');if(button)loadAll();});
  document.querySelectorAll('[data-labs-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.labsTab)));
  $('#labs-refresh').addEventListener('click',loadAll);
  $('#labs-add-tool').addEventListener('click',()=>{editingTool=null;toolFormData();});
  $('#labs-tool-close').addEventListener('click',()=>{$('#labs-tool-form').hidden=true;editingTool=null;});
  $('#labs-tool-form').addEventListener('submit',toolSubmit);
  $('#labs-tool-form').addEventListener('input',updateToolPreview);
  $('#labs-tool-preview-btn').addEventListener('click',previewCurrentTool);
  $('#labs-tool-form').elements.image.addEventListener('change',e=>{const file=e.target.files[0],root=$('#labs-tool-image-preview');root.replaceChildren();if(file){const img=document.createElement('img');img.src=URL.createObjectURL(file);img.alt='Selected tool image preview';root.append(img);}else root.textContent='No image selected';});
  $('#labs-tools-list').addEventListener('click',async e=>{
    const b=e.target.closest('[data-tool-action]');if(!b)return;const index=tools.findIndex(t=>t.id===b.dataset.id);if(index<0)return;const action=b.dataset.toolAction;
    if(action==='edit'){editingTool=tools[index].id;toolFormData(tools[index]);return;}
    if(action==='delete'){if(!confirm('Delete the Labs tool “'+tools[index].name+'”?'))return;tools.splice(index,1);try{await saveTools();}catch(err){fail(err);}return;}
    const target=action==='up'?index-1:index+1;if(target<0||target>=tools.length)return;[tools[index],tools[target]]=[tools[target],tools[index]];tools.forEach((t,i)=>t.order=i+1);try{await saveTools();}catch(err){fail(err);}
  });
  $('#labs-add-article').addEventListener('click',()=>articleFormData());
  $('#labs-article-close').addEventListener('click',()=>{$('#labs-article-form').hidden=true;editingArticle=null;});
  $('#labs-article-form').addEventListener('submit',submitArticle);
  $('#labs-article-form').elements.cover.addEventListener('change',e=>{const file=e.target.files[0],root=$('#labs-cover-preview');root.replaceChildren();if(file){const img=document.createElement('img');img.src=URL.createObjectURL(file);img.alt='Selected cover preview';root.append(img);}else root.textContent='No cover image selected';});
  $('#labs-add-block').addEventListener('click',()=>{blocks.push({type:$('#labs-block-type').value,text:'',items:[]});renderBlocks();});
  $('#labs-article-blocks').addEventListener('click',e=>{const b=e.target.closest('[data-block-action]');if(!b)return;const i=Number(b.dataset.index),action=b.dataset.blockAction;if(action==='remove')blocks.splice(i,1);else{const n=action==='up'?i-1:i+1;if(n>=0&&n<blocks.length)[blocks[i],blocks[n]]=[blocks[n],blocks[i]];}renderBlocks();});
  $('#labs-article-preview').addEventListener('click',async()=>{try{const f=$('#labs-article-form');if(f.elements.cover.files[0])coverImageId=await uploadImage(f.elements.cover.files[0]);const article={title:f.elements.title.value||'Untitled article',subtitle:f.elements.subtitle.value,author:f.elements.author.value,category:f.elements.category.value,status:f.elements.status.value,coverImageId,blocks:await readBlocks()};await openPreview(article);}catch(e){fail(e);}});
  $('#labs-articles-list').addEventListener('click',async e=>{const b=e.target.closest('[data-article-action]');if(!b)return;const article=articles.find(a=>a.id===b.dataset.id);if(!article)return;if(b.dataset.articleAction==='edit')articleFormData(article);if(b.dataset.articleAction==='delete')deleteArticle(article.id);if(b.dataset.articleAction==='preview')try{await openPreview(article);}catch(err){fail(err);}});
  $('#labs-preview-close').addEventListener('click',()=>$('#labs-preview-dialog').close());
  $('#labs-preview-dialog').addEventListener('close',()=>{for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls=[];});
})();