/**
 * base44Client.js — Drop-in Supabase replacement for @base44/sdk
 *
 * Exports the same `base44` object shape used throughout the app:
 *   - base44.entities.EntityName.filter / list / get / create / update / delete / subscribe
 *   - base44.auth.me / loginViaEmailPassword / register / verifyOtp / resendOtp /
 *               setToken / updateMe / changePassword / resetPasswordRequest / resetPassword
 *
 * Zero changes needed in any other file.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Map PascalCase entity names → snake_case table names
const TABLE = {
  AcademicForm:         'academic_forms',
  AffiliateMaterial:    'affiliate_materials',
  Assignment:           'assignments',
  AssignmentSubmission: 'assignment_submissions',
  BlogPost:             'blog_posts',
  Discussion:           'discussions',
  Enrollment:           'enrollments',
  ForumMembership:      'forum_memberships',
  ForumPresence:        'forum_presence',
  Lesson:               'lessons',
  NotFoundLog:          'not_found_logs',
  Notification:         'notifications',
  Payment:              'payments',
  PayoutRequest:        'payout_requests',
  PlatformSettings:     'platform_settings',
  Quiz:                 'quizzes',
  QuizAttempt:          'quiz_attempts',
  Referral:             'referrals',
  RevisionResource:     'revision_resources',
  StudentProfile:       'student_profiles',
  Subject:              'subjects',
  Subscription:         'subscriptions',
  TeacherApplication:   'teacher_applications',
  Topic:                'topics',
  TutorProfile:         'tutor_profiles',
  User:                 'users',
};

// ── Auth token helpers ──────────────────────────────────────────────────────
const TOKEN_KEY = 'base44_access_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

function saveToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('token');
  }
}

// Build a Supabase client — with auth header when a token exists
function getClient() {
  const token = getToken();
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {},
    auth: { persistSession: false },
  });
}

// ── REST helpers ────────────────────────────────────────────────────────────
const API_BASE = `${SUPABASE_URL}/rest/v1`;

async function restGet(path, headers = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      apikey: SUPABASE_ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || `HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
}

async function restPost(path, body, headers = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || `HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
}

async function restPatch(path, body, headers = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || `HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
}

async function restDelete(path, headers = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || `HTTP ${res.status}`), { status: res.status });
  }
  return true;
}

// ── Entity API factory ──────────────────────────────────────────────────────
// Mirrors Base44 SDK: filter(query, sort, limit), list(sort, limit), get(id),
//                     create(data), update(id, data), delete(id), subscribe(cb)

// Column name remapping (Base44 field name → Supabase column name)
const COL_REMAP = {
  order: 'order_num',
};

function buildSort(sortStr) {
  if (!sortStr) return null;
  const desc = sortStr.startsWith('-');
  const rawCol = desc ? sortStr.slice(1) : sortStr;
  const col = COL_REMAP[rawCol] || rawCol;
  return { col, desc };
}

function entityAPI(entityName) {
  const table = TABLE[entityName];
  if (!table) throw new Error(`Unknown entity: ${entityName}`);

  return {
    /**
     * filter(queryObj, sort, limit)
     * queryObj: { field: value, ... }  — all treated as eq
     */
    async filter(queryObj = {}, sort = '-created_date', limit = 100) {
      let qs = `?limit=${limit}`;
      for (const [k, v] of Object.entries(queryObj)) {
        if (v !== undefined && v !== null) {
          qs += `&${encodeURIComponent(k)}=eq.${encodeURIComponent(v)}`;
        }
      }
      const s = buildSort(sort);
      if (s) qs += `&order=${s.col}.${s.desc ? 'desc' : 'asc'}`;
      return restGet(`/${table}${qs}`);
    },

    /**
     * list(sort, limit)
     */
    async list(sort = '-created_date', limit = 100) {
      const s = buildSort(sort);
      const orderPart = s ? `order=${s.col}.${s.desc ? 'desc' : 'asc'}&` : '';
      return restGet(`/${table}?${orderPart}limit=${limit}`);
    },

    /**
     * get(id)
     */
    async get(id) {
      const rows = await restGet(`/${table}?id=eq.${encodeURIComponent(id)}&limit=1`);
      if (!rows || rows.length === 0) {
        throw Object.assign(new Error(`${entityName} not found`), { status: 404 });
      }
      return rows[0];
    },

    /**
     * create(data) → created record
     */
    async create(data) {
      const now = new Date().toISOString();
      const token = getToken();
      const created_by = token ? parseJwt(token)?.sub : null;
      const payload = {
        ...data,
        id: data.id || generateId(),
        created_date: data.created_date || now,
        updated_date: now,
        ...(created_by && !data.created_by ? { created_by } : {}),
      };
      const rows = await restPost(`/${table}`, payload);
      return Array.isArray(rows) ? rows[0] : rows;
    },

    /**
     * update(id, data) → updated record
     */
    async update(id, data) {
      const now = new Date().toISOString();
      const payload = { ...data, updated_date: now };
      delete payload.id; // don't overwrite PK
      const rows = await restPatch(`/${table}?id=eq.${encodeURIComponent(id)}`, payload);
      return Array.isArray(rows) ? rows[0] : rows;
    },

    /**
     * delete(id) → true
     */
    async delete(id) {
      return restDelete(`/${table}?id=eq.${encodeURIComponent(id)}`);
    },

    /**
     * subscribe(callback) → unsubscribe function
     * Mirrors Base44 realtime: callback({ type, data, id })
     * Uses Supabase Realtime under the hood.
     */
    subscribe(callback) {
      const sb = getClient();
      const channel = sb
        .channel(`public:${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              callback({ type: 'create', data: payload.new, id: payload.new.id });
            } else if (payload.eventType === 'UPDATE') {
              callback({ type: 'update', data: payload.new, id: payload.new.id });
            } else if (payload.eventType === 'DELETE') {
              callback({ type: 'delete', data: payload.old, id: payload.old.id });
            }
          }
        )
        .subscribe();

      // Return unsubscribe fn
      return () => sb.removeChannel(channel);
    },
  };
}

// ── Auth API ────────────────────────────────────────────────────────────────

const AUTH_URL = import.meta.env.VITE_SUPABASE_URL + '/auth/v1';

async function authFetch(path, body, method = 'POST') {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(
      new Error(data?.error_description || data?.msg || data?.message || 'Auth error'),
      { status: res.status }
    );
  }
  return data;
}

const auth = {
  /**
   * me() → user object (reads from users table via stored token)
   */
  async me() {
    const token = getToken();
    if (!token) throw Object.assign(new Error('Not authenticated'), { status: 401 });
    const sub = parseJwt(token)?.sub;
    if (!sub) throw Object.assign(new Error('Invalid token'), { status: 401 });

    // Try users table first
    const rows = await restGet(`/users?id=eq.${encodeURIComponent(sub)}&limit=1`);
    if (rows && rows.length > 0) return rows[0];

    // User row missing — auto-create it (handles users who signed up before trigger)
    const jwt = parseJwt(token);
    const now = new Date().toISOString();
    const newUser = {
      id: sub,
      email: jwt?.email || '',
      full_name: jwt?.user_metadata?.full_name || jwt?.email?.split('@')[0] || '',
      // Prefer app_metadata role (set by admin/trigger), then user_metadata, then default
      role: jwt?.app_metadata?.role || jwt?.user_metadata?.role || 'user',
      subscription_plan: 'free',
      total_learning_hours: 0,
      study_streak: 0,
      created_date: now,
      updated_date: now,
    };
    try {
      await restPost('/users', newUser);
    } catch (_) {
      // Ignore conflict errors (row already exists from concurrent request)
    }
    return newUser;
  },

  /**
   * loginViaEmailPassword(email, password)
   */
  async loginViaEmailPassword(email, password) {
    const data = await authFetch('/token?grant_type=password', { email, password });
    saveToken(data.access_token);
    return data;
  },

  /**
   * register({ email, password })
   */
  async register({ email, password, full_name }) {
    // Supabase signup — with OTP email confirmation
    const data = await authFetch('/signup', {
      email,
      password,
      data: { full_name: full_name || email.split('@')[0] },
    });
    // Don't save token yet — user needs to verify OTP first
    return data;
  },

  /**
   * verifyOtp({ email, otpCode })
   */
  async verifyOtp({ email, otpCode }) {
    const data = await authFetch('/verify', {
      type: 'signup',
      email,
      token: otpCode,
    });
    if (data.access_token) {
      saveToken(data.access_token);
    }
    return data;
  },

  /**
   * resendOtp(email)
   */
  async resendOtp(email) {
    return authFetch('/resend', { type: 'signup', email });
  },

  /**
   * setToken(token)
   */
  setToken(token) {
    saveToken(token);
  },

  /**
   * updateMe(data) — updates the current user's row in the users table
   */
  async updateMe(data) {
    const token = getToken();
    if (!token) throw Object.assign(new Error('Not authenticated'), { status: 401 });
    const sub = parseJwt(token)?.sub;
    const now = new Date().toISOString();
    const rows = await restPatch(`/users?id=eq.${encodeURIComponent(sub)}`, {
      ...data,
      updated_date: now,
    });
    return Array.isArray(rows) ? rows[0] : rows;
  },

  /**
   * changePassword({ currentPassword, newPassword })
   */
  async changePassword({ currentPassword, newPassword }) {
    const token = getToken();
    const res = await fetch(`${AUTH_URL}/user`, {
      method: 'PUT',
      headers: {
        apikey: SUPABASE_ANON,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Failed to change password');
    return data;
  },

  /**
   * resetPasswordRequest(email)
   */
  async resetPasswordRequest(email) {
    return authFetch('/recover', { email });
  },

  /**
   * resetPassword({ resetToken, newPassword })
   */
  async resetPassword({ resetToken, newPassword }) {
    // Supabase uses the token from the reset email URL
    const res = await fetch(`${AUTH_URL}/user`, {
      method: 'PUT',
      headers: {
        apikey: SUPABASE_ANON,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resetToken}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Failed to reset password');
    return data;
  },
};

// ── Utilities ───────────────────────────────────────────────────────────────

function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}


// ── Functions API ────────────────────────────────────────────────────────────
// Replaces base44.functions.invoke(name, args) — previously called Base44 cloud
// functions. Now either handled locally (pricing from platform_settings) or
// gracefully stubbed so callers don't crash.

const SUPABASE_URL_F  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_F = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getPricingFromSettings() {
  try {
    const rows = await restGet('/platform_settings?limit=1&order=created_date.asc');
    const settings = rows?.[0] || {};
    const pricing = settings.pricing_config || settings.pricing || null;
    if (pricing && pricing.monthly_price) return pricing;
  } catch (_) {}
  // Fallback defaults
  return { monthly_price: 10000, annual_price: 80000, biannual_price: 150000 };
}

async function getAdminUsersLocal() {
  try {
    const users = await restGet('/users?order=created_date.desc&limit=500');
    return { users: users || [] };
  } catch (_) {
    return { users: [] };
  }
}

const functions = {
  async invoke(name, args = {}) {
    switch (name) {

      // ── Pricing ──────────────────────────────────────────────────────────
      case 'getPricing': {
        const pricing = await getPricingFromSettings();
        return { data: { pricing } };
      }

      // ── Admin users ───────────────────────────────────────────────────────
      case 'getAdminUsers': {
        const result = await getAdminUsersLocal();
        return { data: result };
      }

      // ── Save platform settings ────────────────────────────────────────────
      case 'savePlatformSettings': {
        try {
          const rows = await restGet('/platform_settings?limit=1&order=created_date.asc');
          const existing = rows?.[0];
          const { planKey, value } = args;
          if (existing) {
            await restPatch(`/platform_settings?id=eq.${encodeURIComponent(existing.id)}`,
              { [`${planKey}_config`]: value, updated_date: new Date().toISOString() });
          } else {
            await restPost('/platform_settings',
              { [`${planKey}_config`]: value, id: generateId(),
                created_date: new Date().toISOString(), updated_date: new Date().toISOString() });
          }
          return { data: { success: true } };
        } catch (e) {
          return { error: e.message };
        }
      }

      // ── Referral tracking ─────────────────────────────────────────────────
      case 'trackReferral': {
        try {
          const { referralCode } = args;
          if (!referralCode) return { data: { tracked: false } };
          const token = getToken();
          if (!token) return { data: { tracked: false } };
          const sub = parseJwt(token)?.sub;
          const existing = await restGet(`/referrals?referral_code=eq.${encodeURIComponent(referralCode)}&limit=1`).catch(() => []);
          if (existing?.[0]) {
            await restPost('/referrals', {
              id: generateId(),
              referrer_id: existing[0].created_by || existing[0].student_id,
              referred_id: sub,
              referral_code: referralCode,
              status: 'pending',
              created_date: new Date().toISOString(),
              updated_date: new Date().toISOString(),
            }).catch(() => {});
          }
          return { data: { tracked: true } };
        } catch (_) {
          return { data: { tracked: false } };
        }
      }

      // ── Payment verification (PayChangu) ──────────────────────────────────
      case 'verifyPayChanguPayment':
      case 'createPayChanguSession': {
        // Payment gateway calls — return a safe stub; actual payment logic
        // needs a server-side integration (Vercel Edge Function or similar).
        console.warn(`[base44Client] ${name} is not yet implemented in the Supabase migration. Payment processing requires a backend function.`);
        return { data: null, error: 'Payment processing not yet configured.' };
      }

      // ── Notifications (fire-and-forget — non-fatal) ────────────────────────
      case 'notifyNewBlogPost':
      case 'notifyNewLesson': {
        // Notification dispatch was handled by Base44 cloud functions.
        // For now, silently succeed — notifications can be added via
        // Supabase Edge Functions or a webhook later.
        return { data: { sent: false, reason: 'notifications_not_configured' } };
      }

      // ── Backfill (admin utility) ─────────────────────────────────────────
      case 'backfillStudentProfiles': {
        try {
          const users = await restGet('/users?role=eq.user&limit=500');
          let created = 0;
          for (const u of (users || [])) {
            const existing = await restGet(`/student_profiles?student_id=eq.${u.id}&limit=1`).catch(() => []);
            if (!existing?.length) {
              await restPost('/student_profiles', {
                id: generateId(),
                student_id: u.id,
                created_date: new Date().toISOString(),
                updated_date: new Date().toISOString(),
              }).catch(() => {});
              created++;
            }
          }
          return { data: { created, total: users?.length || 0 } };
        } catch (e) {
          return { error: e.message };
        }
      }

      default:
        console.warn(`[base44Client] Unknown function: ${name}`);
        return { data: null, error: `Function "${name}" not implemented` };
    }
  },
};

// ── Main export — same shape as @base44/sdk createClient() result ───────────

const entities = new Proxy(
  {},
  {
    get(_, entityName) {
      return entityAPI(entityName);
    },
  }
);

export const base44 = { entities, auth, functions };
