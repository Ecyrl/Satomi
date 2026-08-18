const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const fmt = (d) => new Date(d).toLocaleString('zh-CN', { hour12: false });
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const levelLabel = l => l === 'hot' ? '高意向' : l === 'warm' ? '潜在客户' : '低意向';
const levelClass = l => l === 'hot' ? 'hot' : l === 'warm' ? 'warm' : 'cold';
function db() { return SatomiTracker.readStore(); }
function visitors() { return Object.values(db().visitors); }
function leads() { return Object.values(db().leads).sort((a,b) => new Date(b.created_at)-new Date(a.created_at)); }
function events() { return db().events || []; }
function sourceKey(v) { const a = v.attribution || {}; return a.adgroup_id || a.plan_id || a.campaign_id || a.click_id || '自然/测试流量'; }
function renderDashboard() {
  const vs = visitors(), ls = leads(), es = events();
  $('#kpiVisitors').textContent = vs.length; $('#kpiLeads').textContent = ls.length; $('#kpiHot').textContent = ls.filter(x => x.level === 'hot').length; $('#kpiForms').textContent = es.filter(x => x.type === 'form_submit').length;
  $('#hotLeads').innerHTML = ls.filter(x => x.level === 'hot').slice(0,6).map(l => `<button class="lead-row" data-lead="${l.lead_id}"><span class="avatar">${esc((l.name || '客').slice(0,1))}</span><span><b>${esc(l.name || '未命名客户')}</b><small>${esc(l.need || '未填写需求')}</small></span><strong>${l.score}分</strong></button>`).join('') || '<div class="empty">暂无高意向客户，去检测测试页提交一条吧。</div>';
  $('#recentEvents').innerHTML = es.slice(0,8).map(e => `<div class="event-row"><span class="dot"></span><span><b>${esc(e.type)}</b><small>${esc(e.visitor_id)} · ${fmt(e.timestamp)}</small></span><em>+${e.score}</em></div>`).join('') || '<div class="empty">暂无行为事件。</div>';
  const groups = {};
  vs.forEach(v => { const k = sourceKey(v); groups[k] ||= {visits:0, leads:0, hot:0, scores:[]}; groups[k].visits++; groups[k].scores.push(v.score || 0); });
  ls.forEach(l => { const k = sourceKey({ attribution:l.attribution }); groups[k] ||= {visits:0, leads:0, hot:0, scores:[]}; groups[k].leads++; if (l.level === 'hot') groups[k].hot++; });
  $('#sourceTable').innerHTML = Object.entries(groups).sort((a,b)=>b[1].visits-a[1].visits).map(([k,x])=>`<tr><td>${esc(k)}</td><td>${x.visits}</td><td>${x.leads}</td><td>${x.hot}</td><td>${x.scores.length ? Math.round(x.scores.reduce((a,b)=>a+b,0)/x.scores.length) : 0}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">暂无数据</td></tr>';
}
function renderLeads() {
  const q = ($('#leadSearch')?.value || '').toLowerCase(), f = $('#leadFilter')?.value || 'all';
  const data = leads().filter(l => (f==='all'||l.level===f) && [l.name,l.phone,l.wechat,l.need].join(' ').toLowerCase().includes(q));
  $('#leadTable').innerHTML = data.map(l => `<tr class="clickable" data-lead="${l.lead_id}"><td><b>${esc(l.name||'未命名')}</b><small>${esc(l.lead_id)}</small></td><td>${esc(l.phone||'-')}<br>${esc(l.wechat||'-')}</td><td>${esc(l.need||'-')}<br><small>预算：${esc(l.budget||'未填')}</small></td><td><small>${esc(sourceKey({attribution:l.attribution}))}</small></td><td><span class="score ${levelClass(l.level)}">${l.score}</span></td><td>${levelLabel(l.level)}</td><td>${fmt(l.created_at)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">没有符合条件的客户</td></tr>';
}
function renderEvents() {
  const q = ($('#eventSearch')?.value || '').toLowerCase(), f = $('#eventTypeFilter')?.value || 'all';
  const types = [...new Set(events().map(e=>e.type))]; $('#eventTypeFilter').innerHTML = '<option value="all">全部事件</option>' + types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join(''); $('#eventTypeFilter').value=f;
  const data = events().filter(e => (f==='all'||e.type===f) && [e.type,e.visitor_id,e.url,e.detail?.text].join(' ').toLowerCase().includes(q));
  $('#eventTable').innerHTML = data.map(e => `<tr><td>${fmt(e.timestamp)}</td><td><code>${esc(e.visitor_id)}</code></td><td><b>${esc(e.type)}</b><br><small>+${e.score}</small></td><td title="${esc(e.url)}">${esc(new URL(e.url).pathname)}</td><td><small>${esc(sourceKey(db().visitors[e.visitor_id]||{}))}</small></td><td>${esc(e.detail?.text || JSON.stringify(e.detail || {}))}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">暂无事件</td></tr>';
}
function renderTest() {
  const v = SatomiTracker.visitor, a = v.attribution || {};
  $('#visitorInfo').innerHTML = [['visitor_id',v.visitor_id],['首次访问',fmt(v.created_at)],['当前评分',v.score],['事件数量',v.event_count],['click_id',a.click_id || a.click_id?.toString() || '-'],['adgroup_id',a.adgroup_id || '-'],['ad_id',a.ad_id || '-'],['来源URL',v.first_url]].map(([k,x])=>`<div><span>${esc(k)}</span><b>${esc(x)}</b></div>`).join('');
  $('#paramGrid').innerHTML = Object.entries(a).map(([k,v])=>`<div class="param"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('') || '<div class="empty">当前 URL 没有广告参数。可以在地址后加 ?click_id=demo123&adgroup_id=10001&ad_id=20002 测试。</div>';
  $('#trackingTemplate').textContent = `${location.origin}${location.pathname}?click_id=__CLICK_ID__&click_time=__CLICK_TIME__&impression_id=__IMPRESSION_ID__&account_id=__ACCOUNT_ID__&campaign_id=__CAMPAIGN_ID__&adgroup_id=__ADGROUP_ID__&ad_id=__AD_ID__&dynamic_creative_id=__DYNAMIC_CREATIVE_ID__&site_set_name=__SITE_SET_NAME__&page_url=__PAGE_URL__`;
}
function openLead(id) {
  const l = db().leads[id]; if (!l) return; const es = events().filter(e=>e.visitor_id===l.visitor_id).sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)); const card=$('#leadDetailCard'); card.hidden=false; card.innerHTML=`<div class="card-head"><h2>${esc(l.name||'未命名客户')} · ${l.score}分</h2><button class="text-btn" onclick="document.getElementById('leadDetailCard').hidden=true">关闭</button></div><div class="detail-grid"><div><b>手机号</b><span>${esc(l.phone||'-')}</span></div><div><b>微信号</b><span>${esc(l.wechat||'-')}</span></div><div><b>预算</b><span>${esc(l.budget||'-')}</span></div><div><b>需求</b><span>${esc(l.need||'-')}</span></div></div><h3>行为时间轴</h3><div class="timeline">${es.map(e=>`<div><i></i><span><b>${esc(e.type)}</b><small>${fmt(e.timestamp)} · +${e.score}</small></span></div>`).join('')}</div>`; card.scrollIntoView({behavior:'smooth'});
}
function navigate(view) {
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view)); $$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+view));
  const titles={dashboard:['数据总览','实时查看广告来源、用户行为和线索意向度'],leads:['客户线索','查看、筛选和回溯每一个广告客户'],events:['行为事件','完整查看访客在检测页面上的主动行为'],test:['检测测试页','模拟广告用户从进入页面到提交线索的完整链路'],settings:['监测参数','查看 URL 参数与推荐监测链接模板']}; $('#pageTitle').textContent=titles[view][0]; $('#pageSubtitle').textContent=titles[view][1];
  renderDashboard(); renderLeads(); renderEvents(); renderTest();
}
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
document.addEventListener('click',e=>{const row=e.target.closest('[data-lead]'); if(row) openLead(row.dataset.lead);});
$('#leadSearch').addEventListener('input',renderLeads); $('#leadFilter').addEventListener('change',renderLeads); $('#eventSearch').addEventListener('input',renderEvents); $('#eventTypeFilter').addEventListener('change',renderEvents);
$('#leadForm').addEventListener('submit',e=>{e.preventDefault(); const fields=Object.fromEntries(new FormData(e.currentTarget).entries()); const lead=SatomiTracker.submitLead(fields); alert(`线索已进入CRM\n意向评分：${lead.score}\n等级：${levelLabel(lead.level)}`); e.currentTarget.reset(); navigate('leads');});
$('#exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(db(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='satomi-crm-export.json'; a.click(); URL.revokeObjectURL(a.href);});
$('#clearBtn').addEventListener('click',()=>{if(confirm('确定清空当前浏览器中的全部测试数据吗？')){localStorage.removeItem('satomi_ads_crm_v1');sessionStorage.clear();location.reload();}});
window.addEventListener('satomi:tracked',()=>{renderDashboard();renderEvents();renderTest();});
navigate('dashboard');
