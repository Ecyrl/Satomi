const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'satomi-crm.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(express.static(__dirname));

const now = () => new Date().toISOString();
const id = prefix => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;

// SQLite schema: deliberately stores only data the visitor submits or the browser sends for attribution.
db.exec(`
CREATE TABLE IF NOT EXISTS visitors (
  visitor_id TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  first_url TEXT,
  referrer TEXT,
  attribution_json TEXT NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  url TEXT,
  referrer TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(visitor_id) REFERENCES visitors(visitor_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_events_visitor_time ON events(visitor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE TABLE IF NOT EXISTS leads (
  lead_id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  wechat TEXT,
  budget TEXT,
  need TEXT,
  attribution_json TEXT NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'cold',
  status TEXT NOT NULL DEFAULT 'new',
  FOREIGN KEY(visitor_id) REFERENCES visitors(visitor_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE TABLE IF NOT EXISTS conversion_callbacks (
  callback_id TEXT PRIMARY KEY,
  lead_id TEXT,
  event_type TEXT,
  platform TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

const SCORE = {
  page_view: 1, session_start: 1, scroll_25: 2, scroll_50: 3, scroll_75: 5, scroll_100: 8,
  time_30s: 5, time_60s: 8, wechat_click: 20, phone_click: 20, consult_click: 10,
  download_click: 8, form_start: 10, form_submit: 30, phone_provided: 20,
  wechat_provided: 10, budget_provided: 15, need_provided: 15, page_leave: 0
};
const levelFor = score => score >= 60 ? 'hot' : score >= 30 ? 'warm' : 'cold';
const json = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };

const upsertVisitor = db.transaction(v => {
  const existing = db.prepare('SELECT visitor_id FROM visitors WHERE visitor_id=?').get(v.visitor_id);
  if (existing) {
    db.prepare(`UPDATE visitors SET last_seen_at=?, first_url=COALESCE(first_url,?), referrer=COALESCE(referrer,?), attribution_json=?, score=?, event_count=? WHERE visitor_id=?`)
      .run(v.last_seen_at, v.first_url || null, v.referrer || null, JSON.stringify(v.attribution || {}), v.score || 0, v.event_count || 0, v.visitor_id);
  } else {
    db.prepare(`INSERT INTO visitors(visitor_id,first_seen_at,last_seen_at,first_url,referrer,attribution_json,score,event_count) VALUES(?,?,?,?,?,?,?,?)`)
      .run(v.visitor_id, v.first_seen_at || now(), v.last_seen_at || now(), v.first_url || null, v.referrer || null, JSON.stringify(v.attribution || {}), v.score || 0, v.event_count || 0);
  }
});

app.post('/api/track', (req, res) => {
  const { visitor, event } = req.body || {};
  if (!visitor?.visitor_id || !event?.type) return res.status(400).json({ error: 'visitor_id and event.type are required' });
  const score = Number.isFinite(event.score) ? event.score : (SCORE[event.type] || 0);
  const timestamp = event.timestamp || now();
  upsertVisitor({ ...visitor, last_seen_at: timestamp, score: Number(visitor.score || 0), event_count: Number(visitor.event_count || 0) });
  db.prepare(`INSERT OR REPLACE INTO events(event_id,visitor_id,type,score,timestamp,url,referrer,detail_json) VALUES(?,?,?,?,?,?,?,?)`)
    .run(event.event_id || id('e'), visitor.visitor_id, event.type, score, timestamp, event.url || null, event.referrer || null, JSON.stringify(event.detail || {}));
  db.prepare('UPDATE visitors SET last_seen_at=?, score=score+?, event_count=event_count+1 WHERE visitor_id=?').run(timestamp, score, visitor.visitor_id);
  res.json({ ok: true, event_id: event.event_id, score });
});

app.post('/api/leads', (req, res) => {
  const { visitor, fields } = req.body || {};
  if (!visitor?.visitor_id || !fields?.phone) return res.status(400).json({ error: 'visitor_id and phone are required' });
  upsertVisitor(visitor);
  const base = Number(visitor.score || 0) + (fields.phone ? 20 : 0) + (fields.wechat ? 10 : 0) + (fields.budget ? 15 : 0) + (fields.need ? 15 : 0);
  const lead = { lead_id: id('l'), visitor_id: visitor.visitor_id, created_at: now(), name: fields.name || '', phone: String(fields.phone).replace(/\s+/g,''), wechat: fields.wechat || '', budget: fields.budget || '', need: fields.need || '', attribution: visitor.attribution || {}, score: base, level: levelFor(base), status: 'new' };
  db.prepare(`INSERT INTO leads(lead_id,visitor_id,created_at,name,phone,wechat,budget,need,attribution_json,score,level,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(lead.lead_id, lead.visitor_id, lead.created_at, lead.name, lead.phone, lead.wechat, lead.budget, lead.need, JSON.stringify(lead.attribution), lead.score, lead.level, lead.status);
  res.status(201).json({ ok: true, lead });
});

app.get('/api/dashboard', (_req, res) => {
  const visitors = db.prepare('SELECT COUNT(*) AS n FROM visitors').get().n;
  const leads = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;
  const hot = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE level='hot'").get().n;
  const forms = db.prepare("SELECT COUNT(*) AS n FROM events WHERE type='form_submit'").get().n;
  const recentLeads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 20').all().map(row => ({ ...row, attribution: json(row.attribution_json) }));
  const recentEvents = db.prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT 30').all().map(row => ({ ...row, detail: json(row.detail_json) }));
  res.json({ visitors, leads, hot, forms, recentLeads, recentEvents });
});

app.get('/api/leads', (req, res) => {
  const q = String(req.query.q || '').trim();
  const level = String(req.query.level || 'all');
  let sql = 'SELECT * FROM leads WHERE 1=1'; const params = [];
  if (level !== 'all') { sql += ' AND level=?'; params.push(level); }
  if (q) { sql += ' AND (name LIKE ? OR phone LIKE ? OR wechat LIKE ? OR need LIKE ?)'; params.push(...Array(4).fill(`%${q}%`)); }
  sql += ' ORDER BY created_at DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params).map(row => ({ ...row, attribution: json(row.attribution_json) })));
});

app.get('/api/leads/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE lead_id=?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'lead not found' });
  const events = db.prepare('SELECT * FROM events WHERE visitor_id=? ORDER BY timestamp ASC').all(lead.visitor_id).map(row => ({ ...row, detail: json(row.detail_json) }));
  res.json({ ...lead, attribution: json(lead.attribution_json), events });
});

app.get('/api/events', (req, res) => {
  const q = String(req.query.q || '').trim();
  const type = String(req.query.type || 'all');
  let sql = 'SELECT * FROM events WHERE 1=1'; const params = [];
  if (type !== 'all') { sql += ' AND type=?'; params.push(type); }
  if (q) { sql += ' AND (type LIKE ? OR visitor_id LIKE ? OR url LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  sql += ' ORDER BY timestamp DESC LIMIT 1000';
  res.json(db.prepare(sql).all(...params).map(row => ({ ...row, detail: json(row.detail_json) })));
});

// Generic conversion callback intake. Wire the exact Tencent callback contract here after confirming the production API fields.
app.post('/api/conversions/callback', (req, res) => {
  const payload = req.body || {};
  const callbackId = id('cb');
  db.prepare('INSERT INTO conversion_callbacks(callback_id,lead_id,event_type,platform,payload_json,created_at) VALUES(?,?,?,?,?,?)')
    .run(callbackId, payload.lead_id || null, payload.event_type || null, payload.platform || 'unknown', JSON.stringify(payload), now());
  res.json({ ok: true, callback_id: callbackId });
});

app.get('/health', (_req,res) => res.json({ ok: true, service: 'satomi-ads-crm', time: now() }));
app.get('*', (_req,res) => res.sendFile(path.join(__dirname,'index.html')));

app.listen(PORT, () => console.log(`Satomi Ads CRM listening on :${PORT}`));
