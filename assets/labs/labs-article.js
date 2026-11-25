(() => {
'use strict';
const API='https://viora-auth-website.onrender.com',$=s=>document.querySelector(s);
const slug=new URLSearchParams(location.search).get('slug')||'',state=$('#la-state'),root=$('#la-article');
function node(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
function addBlock(parent,b){
 if(b.type==='heading'){parent.append(node('h2',b.text));return;}
 if(b.type==='paragraph'){parent.append(node('p',b.text));return;}
 if(b.type==='quote'){parent.append(node('blockquote',b.text));return;}
 if(b.type==='code'){const pre=node('pre'),code=node('code',b.text);pre.append(code);parent.append(pre);return;}
 if(b.type==='link'){const p=node('p'),a=node('a',b.text||b.url);a.href=b.url;a.target='_blank';a.rel='noopener noreferrer';p.append(a);parent.append(p);return;}
 if(b.type==='bulleted-list'||b.type==='numbered-list'){const list=node(b.type==='bulleted-list'?'ul':'ol');(b.items||[]).forEach(x=>list.append(node('li',x)));parent.append(list);return;}
 if(b.type==='image'){const figure=node('figure'),img=document.createElement('img');img.src=API+'/api/labs/media/'+encodeURIComponent(b.imageId);img.alt=b.alt||'';img.loading='lazy';figure.append(img);if(b.caption)figure.append(node('figcaption',b.caption));parent.append(figure);}
}
function renderArticle(a){
 document.title=a.title+' — Viora Labs';
 const header=node('header',null,'la-article-head');
 header.append(node('div',(a.category||'Technology').toUpperCase(),'la-kicker'),node('h1',a.title),node('p',a.subtitle,'la-subtitle'),node('div',(a.author||'Viora Team')+' · '+(a.publishedAt?new Date(a.publishedAt).toLocaleDateString():'Published'),'la-byline'));root.append(header);
 if(a.coverImageId){const fig=node('figure',null,'la-cover'),img=document.createElement('img');img.src=API+'/api/labs/media/'+encodeURIComponent(a.coverImageId);img.alt=a.title+' cover image';img.fetchPriority='high';fig.append(img);root.append(fig);}
 const content=node('div',null,'la-content');(a.blocks||[]).forEach(b=>addBlock(content,b));root.append(content);
 if(a.tags?.length){const tags=node('div',null,'la-tags');a.tags.forEach(t=>tags.append(node('span','#'+t)));root.append(tags);}
}
function related(articles,current){const list=articles.filter(a=>a.id!==current.id).sort((a,b)=>Number(b.featured)-Number(a.featured)).slice(0,3);if(!list.length)return;const grid=$('#la-related-grid');list.forEach(a=>{const card=node('a',null,'la-related-card');card.href='labs-article.html?slug='+encodeURIComponent(a.id);if(a.coverImageId){const img=document.createElement('img');img.src=API+'/api/labs/media/'+encodeURIComponent(a.coverImageId);img.alt='';card.append(img);}const copy=node('div',null,'la-related-copy');copy.append(node('span',a.category||'Technology'),node('h3',a.title),node('p',a.subtitle));card.append(copy);grid.append(card);});$('#la-related').hidden=false;}
async function boot(){if(!slug){state.textContent='Choose an article from the Viora Labs homepage.';return;}try{const response=await fetch(API+'/api/labs/content',{cache:'no-store'});if(!response.ok)throw new Error('Labs articles are temporarily unavailable.');const data=await response.json(),articles=Array.isArray(data.articles)?data.articles:[],article=articles.find(a=>a.id===slug);if(!article){state.textContent='This article could not be found. It may be a draft or have been unpublished.';return;}state.hidden=true;root.hidden=false;renderArticle(article);related(articles,article);}catch(e){state.textContent=e.message||'The article could not be loaded.';}}
boot();
})();