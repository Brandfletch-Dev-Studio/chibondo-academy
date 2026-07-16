/**
 * supabaseClient.js — unified data & auth client for Chibondo Academy
 *
 * Exports a single `db` object that all pages import:
 *   import { db } from '@/api/supabaseClient';
 *
 *   db.entities.EntityName.filter / list / get / create / update / delete / subscribe
 *   db.auth.me / loginViaEmailPassword / register / verifyOtp / resendOtp /
 *              setToken / updateMe / changePassword / resetPasswordRequest / resetPassword
 *   db.functions.invoke(name, args)
 *   db.storage.upload(bucket, path, file) / getPublicUrl(bucket, path)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Token storage ────────────────────────────────────────────────────────────
const TOKEN_KEY = 'aca_access_token';

function getToken() {
  // Support new key + legacy key from pre-migration sessions
  return (
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem('base44_access_token') ||
    localStorage.getItem('token') ||
    null
  );
}

function saveToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    // Clean up legacy keys from pre-migration sessions
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('token');
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('token');
  }
}

// ── Supabase JS client (for realtime) ────────────────────────────────────────
function getClient() {
  const token = getToken();
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    auth: { persistSession: false },
  });
}

// ── REST helpers ──────────────────────────────────────────────────────────────
const API = `${SUPABASE_URL}/rest/v1`;

async function _req(method, path, body, extra = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || err.error_description || `HTTP ${res.status}`), { status: res.status });
  }
  if (res.status === 204) return true;
  return res.json();
}

const get    = (path)        => _req('GET',    path);
const post   = (path, body)  => _req('POST',   path, body);
const patch  = (path, body)  => _req('PATCH',  path, body);
const del    = (path)        => _req('DELETE', path);

// ── Utilities ─────────────────────────────────────────────────────────────────
function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

// Column name remapping (keep parity with Base44 field names → Supabase columns)
const COL_REMAP = { order: 'order_num' };

function buildSort(sortStr) {
  if (!sortStr) return '';
  const desc = sortStr.startsWith('-');
  const raw  = desc ? sortStr.slice(1) : sortStr;
  const col  = COL_REMAP[raw] || raw;
  return `order=${col}.${desc ? 'desc' : 'asc'}&`;
}

// Remap any Base44-style field names (e.g. `order`) to their real Supabase
// column names (e.g. `order_num`) before sending a write payload.
function remapPayload(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[COL_REMAP[k] || k] = v;
  }
  return out;
}

// Reverse remap: alias real Supabase columns (e.g. `order_num`) back onto the
// Base44-style field name (e.g. `order`) on read, so existing app code that
// reads `.order` keeps working. Keeps the original column too.
const REVERSE_REMAP = Object.fromEntries(Object.entries(COL_REMAP).map(([k, v]) => [v, k]));
function remapRow(row) {
  if (!row || typeof row !== 'object') return row;
  for (const [col, alias] of Object.entries(REVERSE_REMAP)) {
    if (col in row && !(alias in row)) row[alias] = row[col];
  }
  return row;
}
function remapRows(rows) {
  return Array.isArray(rows) ? rows.map(remapRow) : remapRow(rows);
}

// ── Entity API factory ────────────────────────────────────────────────────────
const TABLE = {
  AcademicForm:          'academic_forms',
  AffiliateMaterial:     'affiliate_materials',
  Assignment:            'assignments',
  AssignmentSubmission:  'assignment_submissions',
  BlogPost:              'blog_posts',
  Discussion:            'discussions',
  Enrollment:            'enrollments',
  ForumMembership:       'forum_memberships',
  ForumPresence:         'forum_presence',
  Lesson:                'lessons',
  NotFoundLog:           'not_found_logs',
  Notification:          'notifications',
  Payment:               'payments',
  PayoutRequest:         'payout_requests',
  PlatformSettings:      'platform_settings',
  Quiz:                  'quizzes',
  QuizAttempt:           'quiz_attempts',
  Referral:              'referrals',
  RevisionResource:      'revision_resources',
  StudentProfile:        'student_profiles',
  Subject:               'subjects',
  Subscription:          'subscriptions',
  TeacherApplication:    'teacher_applications',
  Topic:                 'topics',
  TutorProfile:          'tutor_profiles',
  User:                  'users',
  GroupChatMessage:      'group_chat_messages',
  StudyGroup:            'study_groups',
};

function entityAPI(entityName) {
  const table = TABLE[entityName];
  if (!table) throw new Error(`Unknown entity: ${entityName}`);

  return {
    async filter(queryObj = {}, sort = '-created_date', limit = 100) {
      let qs = `?${buildSort(sort)}limit=${limit}`;
      for (const [k, v] of Object.entries(queryObj)) {
        if (v !== undefined && v !== null)
          qs += `&${encodeURIComponent(COL_REMAP[k] || k)}=eq.${encodeURIComponent(v)}`;
      }
      return remapRows(await get(`/${table}${qs}`));
    },

    async list(sort = '-created_date', limit = 100) {
      return remapRows(await get(`/${table}?${buildSort(sort)}limit=${limit}`));
    },

    async get(id) {
      const rows = await get(`/${table}?id=eq.${encodeURIComponent(id)}&limit=1`);
      if (!rows?.length) throw Object.assign(new Error(`${entityName} not found`), { status: 404 });
      return remapRow(rows[0]);
    },

    // Exact row count via PostgREST's Content-Range header (no rows fetched).
    async count(queryObj = {}) {
      let qs = '?select=id';
      for (const [k, v] of Object.entries(queryObj)) {
        if (v !== undefined && v !== null)
          qs += `&${encodeURIComponent(COL_REMAP[k] || k)}=eq.${encodeURIComponent(v)}`;
      }
      const token = getToken();
      const res = await fetch(`${API}/${table}${qs}`, {
        method: 'HEAD',
        headers: {
          apikey: SUPABASE_ANON,
          Prefer: 'count=exact',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const range = res.headers.get('content-range'); // e.g. "0-24/270"
      return range ? parseInt(range.split('/')[1], 10) || 0 : 0;
    },

    async create(data) {
      const now = new Date().toISOString();
      const token = getToken();
      const created_by = token ? parseJwt(token)?.sub : null;
      const payload = {
        ...remapPayload(data),
        id:           data.id || generateId(),
        created_date: data.created_date || now,
        updated_date: now,
        ...(created_by && !data.created_by ? { created_by } : {}),
      };
      const rows = await post(`/${table}`, payload);
      return remapRow(Array.isArray(rows) ? rows[0] : rows);
    },

    async update(id, data) {
      const payload = { ...remapPayload(data), updated_date: new Date().toISOString() };
      delete payload.id;
      const rows = await patch(`/${table}?id=eq.${encodeURIComponent(id)}`, payload);
      return remapRow(Array.isArray(rows) ? rows[0] : rows);
    },

    async delete(id) {
      return del(`/${table}?id=eq.${encodeURIComponent(id)}`);
    },

    subscribe(callback) {
      const sb = getClient();
      const channel = sb
        .channel(`public:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          const map = { INSERT: 'create', UPDATE: 'update', DELETE: 'delete' };
          callback({ type: map[payload.eventType], data: payload.new || payload.old, id: (payload.new || payload.old)?.id });
        })
        .subscribe();
      return () => sb.removeChannel(channel);
    },
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const AUTH = `${SUPABASE_URL}/auth/v1`;

async function authFetch(path, body, method = 'POST') {
  const res = await fetch(`${AUTH}${path}`, {
    method,
    headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error_description || data?.msg || data?.message || 'Auth error'), { status: res.status });
  return data;
}

const auth = {
  async me() {
    const token = getToken();
    if (!token) throw Object.assign(new Error('Not authenticated'), { status: 401 });
    const sub = parseJwt(token)?.sub;
    if (!sub) throw Object.assign(new Error('Invalid token'), { status: 401 });

    const rows = await get(`/users?id=eq.${encodeURIComponent(sub)}&limit=1`);
    if (rows?.length) return rows[0];

    // Auto-create user row on first login
    const jwt = parseJwt(token);
    const now = new Date().toISOString();
    const newUser = {
      id:           sub,
      email:        jwt?.email || '',
      full_name:    jwt?.user_metadata?.full_name || '',
      role:         jwt?.app_metadata?.role || jwt?.user_metadata?.role || 'user',
      referral_code: 'ACA-' + sub.slice(-6).toUpperCase(),
      created_date: now,
      updated_date: now,
    };
    try {
      const created = await post('/users', newUser);
      return Array.isArray(created) ? created[0] : created;
    } catch (_) {
      return newUser;
    }
  },

  setToken: saveToken,

  async loginViaEmailPassword(email, password) {
    const data = await authFetch('/token?grant_type=password', { email, password });
    const token = data.access_token;
    if (!token) throw new Error('No token returned');
    saveToken(token);
    return data;
  },

  async register(emailOrObj, password, extra = {}) {
    // Support both register(email, password, extra) and register({ email, password, full_name, ... })
    let email, data;
    if (typeof emailOrObj === 'object' && emailOrObj !== null) {
      const { email: e, password: p, ...rest } = emailOrObj;
      email    = e;
      password = p;
      data     = rest;
    } else {
      email = emailOrObj;
      data  = extra;
    }
    const res = await authFetch('/signup', { email, password, data });
    return res;
  },

  async verifyOtp({ email, otpCode }) {
    const data = await authFetch('/verify', { type: 'email', email, token: otpCode });
    if (data.access_token) saveToken(data.access_token);
    return data;
  },

  async resendOtp(email) {
    return authFetch('/resend', { type: 'signup', email });
  },

  async updateMe(updates) {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');
    const sub = parseJwt(token)?.sub;
    if (!sub) throw new Error('Invalid token');

    // Update public users table
    await patch(`/users?id=eq.${encodeURIComponent(sub)}`,
      { ...updates, updated_date: new Date().toISOString() });

    // Sync relevant fields to auth user_metadata so they survive token refresh
    const metaUpdates = {};
    if (updates.full_name)  metaUpdates.full_name  = updates.full_name;
    if (updates.avatar_url) metaUpdates.avatar_url = updates.avatar_url;
    if (updates.role)       metaUpdates.role        = updates.role;
    if (Object.keys(metaUpdates).length > 0) {
      const authBody = { data: metaUpdates };
      if (updates.role) authBody.app_metadata = { role: updates.role };
      await fetch(`${AUTH}/user`, {
        method: 'PUT',
        headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(authBody),
      }).catch(e => console.warn('Could not sync auth metadata:', e));
    }
    return auth.me();
  },

  async changePassword(newPasswordOrObj) {
    // Accept both changePassword(newPassword) and changePassword({ currentPassword, newPassword })
    const newPassword = (typeof newPasswordOrObj === 'object' && newPasswordOrObj !== null)
      ? newPasswordOrObj.newPassword
      : newPasswordOrObj;

    if (!newPassword) throw new Error('New password is required');
    const token = getToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${AUTH}/user`, {
      method: 'PUT',
      headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.msg || data?.message || 'Password change failed');
    return data;
  },

  async resetPasswordRequest(email, redirectTo) {
    const body = { email };
    if (redirectTo) body.redirect_to = redirectTo;
    return authFetch('/recover', body);
  },

  async resetPassword(newPasswordOrObj, accessToken) {
    // Support resetPassword({ resetToken, newPassword }) and resetPassword(pwd, token)
    let newPassword, token;
    if (typeof newPasswordOrObj === 'object' && newPasswordOrObj !== null) {
      newPassword = newPasswordOrObj.newPassword;
      token       = newPasswordOrObj.resetToken || newPasswordOrObj.accessToken;
    } else {
      newPassword = newPasswordOrObj;
      token       = accessToken;
    }
    if (token) saveToken(token);
    return auth.changePassword(newPassword);
  },

  logout() {
    saveToken(null);
  },
};

// ── Functions (server-side logic, now handled in-client) ─────────────────────
async function getPricingFromSettings() {
  try {
    const rows = await get('/platform_settings?limit=1&order=created_date.asc');
    const cfg = rows?.[0]?.pricing_config || rows?.[0]?.pricing || null;
    if (cfg?.monthly_price) return cfg;
  } catch (_) {}
  return { monthly_price: 10000, annual_price: 80000, biannual_price: 150000 };
}

const functions = {
  async invoke(name, args = {}) {
    switch (name) {
      case 'getPricing': {
        const pricing = await getPricingFromSettings();
        return { data: { pricing } };
      }
      case 'getAdminUsers': {
        try {
          const users = await get('/users?order=created_date.desc&limit=500');
          return { data: { users: users || [] } };
        } catch (_) { return { data: { users: [] } }; }
      }
      case 'savePlatformSettings': {
        try {
          const rows = await get('/platform_settings?limit=1&order=created_date.asc');
          const { planKey, value } = args;
          const now = new Date().toISOString();
          if (rows?.[0]) {
            await patch(`/platform_settings?id=eq.${encodeURIComponent(rows[0].id)}`,
              { [`${planKey}_config`]: value, updated_date: now });
          } else {
            await post('/platform_settings',
              { [`${planKey}_config`]: value, id: generateId(), created_date: now, updated_date: now });
          }
          return { data: { success: true } };
        } catch (e) { return { error: e.message }; }
      }
      case 'trackReferral': {
        try {
          const { referralCode } = args;
          if (!referralCode) return { data: { tracked: false } };
          const token = getToken();
          if (!token) return { data: { tracked: false } };
          const sub = parseJwt(token)?.sub;
          // Find referrer by code
          const refs = await get(`/users?referral_code=eq.${encodeURIComponent(referralCode)}&limit=1`).catch(() => []);
          if (refs?.[0] && refs[0].id !== sub) {
            await post('/referrals', {
              id: generateId(), referrer_id: refs[0].id, referred_id: sub,
              referral_code: referralCode, status: 'pending',
              created_date: new Date().toISOString(), updated_date: new Date().toISOString(),
            }).catch(() => {});
          }
          return { data: { tracked: true } };
        } catch (_) { return { data: { tracked: false } }; }
      }
      case 'backfillStudentProfiles': {
        try {
          const users = await get('/users?role=eq.user&limit=500');
          let created = 0;
          for (const u of (users || [])) {
            const ex = await get(`/student_profiles?student_id=eq.${u.id}&limit=1`).catch(() => []);
            if (!ex?.length) {
              const now = new Date().toISOString();
              await post('/student_profiles', {
                id: generateId(), student_id: u.id, created_date: now, updated_date: now,
              }).catch(() => {});
              created++;
            }
          }
          return { data: { created, total: users?.length || 0 } };
        } catch (e) { return { error: e.message }; }
      }
      case 'createPayChanguSession': {
        // Calls Vercel serverless route → Paychangu API
        const token = getToken();
        const jwt   = token ? parseJwt(token) : null;
        const { plan, return_url } = args;
        const res = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan,
            return_url,
            user_id:    jwt?.sub    || '',
            email:      jwt?.email  || '',
            first_name: jwt?.user_metadata?.full_name?.split(' ')[0] || 'Student',
            last_name:  jwt?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 'User',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Payment initiation failed');
        return { data };
      }

      case 'verifyPayChanguPayment': {
        // Calls Vercel serverless route → Paychangu verify API → creates subscription
        const token = getToken();
        const jwt   = token ? parseJwt(token) : null;
        const { tx_ref } = args;
        const res = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_ref, user_id: jwt?.sub || '' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        return { data };
      }

      case 'cartRecoveryEmails':
      case 'notifyNewBlogPost':
      case 'notifyNewLesson':
      case 'sendWelcomeEmail':
        // These require additional backend setup
        console.info(`[aca] ${name} — not yet configured`);
        return { data: null };
      default:
        console.warn(`[aca] Unknown function: ${name}`);
        return { data: null };
    }
  },
};

// ── Storage helpers ───────────────────────────────────────────────────────────
const storage = {
  getPublicUrl(bucket, path) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  },
  async upload(bucket, path, file) {
    const token = getToken();
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Upload failed');
    }
    const data = await res.json();
    return { file_url: storage.getPublicUrl(bucket, path), ...data };
  },
};

// ── integrations shim (DiscussionsPage uses integrations.Core.UploadFile) ────
const integrations = {
  Core: {
    async UploadFile({ file }) {
      const path = `uploads/${Date.now()}_${file.name || 'file'}`;
      return storage.upload('assets', path, file);
    },
  },
};

// ── Entity proxy ──────────────────────────────────────────────────────────────
const entities = new Proxy({}, { get(_, name) { return entityAPI(name); } });

// ── Main export ───────────────────────────────────────────────────────────────
export const db = { entities, auth, functions, storage, integrations };

// Legacy alias — allows gradual migration: import { db } from '@/api/supabaseClient'
export const base44 = db;
