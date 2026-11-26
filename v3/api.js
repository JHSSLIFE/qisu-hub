/*
 * QISU HUB V3.3 · 数据适配层（product-v3.3）
 *
 * 作用：把 V3.3 界面原来的「localStorage + 前端模拟账号」换成真实后端。
 * 约定：
 *   - 所有请求同源，带 X-Qisushuo 头（服务端同源校验要求）
 *   - 服务端已经按身份裁剪 records，前端不再自行过滤
 *   - 只有哈希与 id 存在浏览器里，正文与会话都不落 localStorage
 */
(function () {
  'use strict';

  var BASE = '/api/';
  var HEAD = { 'Content-Type': 'application/json', 'X-Qisushuo': 'workspace' };

  function ApiError(message, status) {
    var e = new Error(message);
    e.name = 'ApiError';
    e.status = status || 0;
    return e;
  }

  async function call(path, body, method) {
    var opt = {
      method: method || (body === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin',
      headers: Object.assign({}, HEAD)
    };
    if (body !== undefined) opt.body = JSON.stringify(body);

    var res;
    try {
      res = await fetch(BASE + path, opt);
    } catch (err) {
      throw ApiError('网络不可用，请检查连接后重试', 0);
    }

    var data = null;
    try { data = await res.json(); } catch (err) { /* 非 JSON 响应 */ }

    if (!res.ok) {
      var detail = data && data.detail;
      if (typeof detail !== 'string') detail = '请求失败（' + res.status + '）';
      throw ApiError(detail, res.status);
    }
    return data;
  }

  function q(path) { return encodeURIComponent(path); }

  window.qisuApi = {
    ApiError: ApiError,

    // 身份
    loginPassword: function (username, password) { return call('auth/password', { username: username, password: password }); },
    loginExpertCode: function (code) { return call('auth/expert-code', { code: code }); },
    logout: function () { return call('auth/logout', {}, 'POST'); },
    me: function () { return call('me'); },

    // 资料
    boot: function () { return call('bootstrap'); },
    save: function (record) { return call('records', record, 'POST'); },
    versions: function (id) { return call('records/' + q(id) + '/versions'); },
    search: function (text) { return call('search?q=' + encodeURIComponent(text)); },
    exportAll: function () { return call('export'); },
    importRecords: function (rows) { return call('imports', { records: rows }); },

    // 管理
    adminOverview: function () { return call('admin/overview'); },
    adminAudit: function (limit) { return call('admin/audit?limit=' + (limit || 50)); },
    adminCreateExpert: function (name, days) { return call('admin/experts', { name: name, days: days || 30 }); },
    adminResetCode: function (id, days) { return call('admin/experts/' + q(id) + '/code', { days: days || 30 }); },
    adminRevoke: function (id) { return call('admin/experts/' + q(id) + '/revoke', {}, 'POST'); },
    adminRole: function (id, role) { return call('admin/members/' + q(id), { role: role }, 'PATCH'); },
    adminGrants: function (id, ids) { return call('admin/grants', { user_id: id, record_ids: ids }); }
  };

  // 后端尚未提供 AI 代理前，明确标记，避免界面误判为已连通
  window.QISU_AI_PROXY = false;
})();
