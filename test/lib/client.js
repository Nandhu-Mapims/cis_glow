import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from '../../server/node_modules/dotenv/lib/main.js';
import { config } from '../config.js';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../server');

let envLoaded = false;

function loadServerEnv() {
  if (envLoaded) return;
  dotenv.config({ path: resolve(serverRoot, '.env') });
  envLoaded = true;
}

export class ApiClient {
  constructor() {
    this.token = null;
    this.user = null;
    this.authMode = null;
  }

  async request(method, path, body) {
    const url = `${config.apiBase}${path}`;
    const headers = { Accept: 'application/json' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      return { ok: res.ok, status: res.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  put(path, body) {
    return this.request('PUT', path, body);
  }

  patch(path, body) {
    return this.request('PATCH', path, body);
  }

  async bootstrapFromDb() {
    loadServerEnv();
    const { prisma } = await import('../../server/src/config/prisma.js');
    const { signToken, createSessionId } = await import('../../server/src/utils/jwt.js');

    const user = await prisma.web_account_setup.findFirst({
      where: { member_id: config.username, del: 1 },
    });
    if (!user) {
      throw new Error(`${config.username} not found in database`);
    }

    this.token = signToken({
      id: user.id,
      memberId: user.member_id,
      memberName: user.member_name,
      accessType: user.access_type,
      sessionId: createSessionId(),
    });

    this.user = {
      id: user.id,
      memberId: user.member_id,
      memberName: user.member_name,
      accessType: user.access_type,
    };
    this.authMode = 'bootstrap';
    return { token: this.token, user: this.user };
  }

  async login() {
    if (this.token) {
      return { token: this.token, user: this.user };
    }

    if (config.password) {
      const res = await this.post('/api/auth/login', {
        username: config.username,
        password: config.password,
      });
      if (!res.ok) {
        const msg = res.data?.message || `Login failed (${res.status})`;
        throw new Error(msg);
      }
      this.token = res.data.token;
      this.user = res.data.user;
      this.authMode = 'login';
      return res.data;
    }

    return this.bootstrapFromDb();
  }
}
