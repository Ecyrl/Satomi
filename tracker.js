/* Satomi Ads CRM - first-party browser tracker
 * MVP: stores only user-provided contact fields and browser/session attribution data.
 * It cannot and does not read private WeChat identifiers, contacts, call contents, or other apps.
 */
(function () {
  const KEY = 'satomi_ads_crm_v1';
  const SESSION_KEY = 'satomi_visitor_v1';
  const PARAMS = [
    'click_id','CLICK_ID','clickid','click_time','CLICK_TIME','impression_id','IMPRESSION_ID',
    'account_id','ACCOUNT_ID','campaign_id','CAMPAIGN_ID','adgroup_id','ADGROUP_ID',
    'ad_id','AD_ID','creative_id','CREATIVE_ID','dynamic_creative_id','DYNAMIC_CREATIVE_ID',
    'site_set_name','SITE_SET_NAME','page_url','PAGE_URL','ip','IP','user_agent','USER_AGENT',
    'wechat_open_id','WECHAT_OPEN_ID','callback','CALLBACK','channel','plan_id','planid'
  ];
  const SCORE = {
    page_view: 1, session_start: 1, scroll_25: 2, scroll_50: 3, scroll_75: 5, scroll_100: 8,
    time_30s: 5, time_60s: 8, wechat_click: 20, phone_click: 20, consult_click: 10,
    download_click: 8, form_start: 10, form_submit: 30, phone_provided: 20,
    wechat_provided: 10, budget_provided: 15, need_provided: 15
  };
  const now = () => new Date().toISOString();
  const uid = (prefix) => prefix + '_' + crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  function readStore() { try { return JSON.parse(localStorage.getItem(KEY)) || { visitors: {}, leads: {}, events: [] }; } catch { return { visitors: {}, leads: {}, events: [] }; } }
  function saveStore(db) { localStorage.setItem(KEY, JSON.stringify(db)); }
  function queryParams() { const p = new URLSearchParams(location.search); const out = {}; PARAMS.forEach(k => { if (p.has(k)) out[k.toLowerCase()] = p.get(k); }); return out; }
  function firstParam(params, keys) { for (const k of keys) if (params[k]) return params[k]; return ''; }
  function getVisitor() {
    let visitor = null; try { visitor = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch {}
    const params = queryParams();
    if (!visitor) {
      visitor = { visitor_id: uid('v'), created_at: now(), first_url: location.href, attribution: params, score: 0, event_count: 0 };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(visitor));
    } else if (Object.keys(params).length) {
      visitor.attribution = { ...visitor.attribution, ...params };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(visitor));
    }
    const db = readStore(); db.visitors[visitor.visitor_id] = visitor; saveStore(db); return visitor;
  }
  const visitor = getVisitor();
  function track(type, detail = {}) {
    const db = readStore();
    const event = { event_id: uid('e'), visitor_id: visitor.visitor_id, type, score: SCORE[type] || 0, timestamp: now(), url: location.href, referrer: document.referrer || '', detail };
    db.events.unshift(event);
    const v = db.visitors[visitor.visitor_id] || visitor; v.score = (v.score || 0) + event.score; v.event_count = (v.event_count || 0) + 1; v.last_seen_at = event.timestamp; db.visitors[v.visitor_id] = v;
    saveStore(db);
    window.dispatchEvent(new CustomEvent('satomi:tracked', { detail: event }));
    return event;
  }
  function normalizePhone(value) { return String(value || '').replace(/\s+/g, '').trim(); }
  function submitLead(fields) {
    const db = readStore();
    const lead = {
      lead_id: uid('l'), visitor_id: visitor.visitor_id, created_at: now(),
      name: fields.name || '', phone: normalizePhone(fields.phone), wechat: fields.wechat || '',
      budget: fields.budget || '', need: fields.need || '', attribution: visitor.attribution || {},
      score: (db.visitors[visitor.visitor_id]?.score || 0) + (fields.phone ? SCORE.phone_provided : 0) + (fields.wechat ? SCORE.wechat_provided : 0) + (fields.budget ? SCORE.budget_provided : 0) + (fields.need ? SCORE.need_provided : 0), status: 'new'
    };
    lead.level = lead.score >= 60 ? 'hot' : lead.score >= 30 ? 'warm' : 'cold';
    db.leads[lead.lead_id] = lead; saveStore(db);
    track('form_submit', { lead_id: lead.lead_id, fields: { name: !!fields.name, phone: !!fields.phone, wechat: !!fields.wechat, budget: !!fields.budget, need: !!fields.need } });
    if (fields.phone) track('phone_provided');
    if (fields.wechat) track('wechat_provided');
    if (fields.budget) track('budget_provided');
    if (fields.need) track('need_provided');
    return lead;
  }
  window.SatomiTracker = { visitor, track, submitLead, readStore, saveStore, queryParams, SCORE };
  track('session_start'); track('page_view');
  let started = false;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-track]'); if (!el) return;
    track(el.dataset.track, { text: el.textContent.trim().slice(0, 100) });
  });
  document.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight; if (max <= 0) return;
    const pct = Math.round((scrollY / max) * 100); const marks = [25,50,75,100];
    marks.forEach(m => { if (pct >= m && !sessionStorage.getItem('satomi_scroll_' + m)) { sessionStorage.setItem('satomi_scroll_' + m, '1'); track('scroll_' + m); } });
  }, { passive: true });
  document.addEventListener('focusin', e => { if (e.target.closest('#leadForm') && !started) { started = true; track('form_start'); } });
  setTimeout(() => track('time_30s'), 30000); setTimeout(() => track('time_60s'), 60000);
  window.addEventListener('beforeunload', () => track('page_leave'));
})();
