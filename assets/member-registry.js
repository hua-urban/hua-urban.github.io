(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HuaMembers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var API_URL = 'https://script.google.com/macros/s/AKfycbxDLC_mhRaLhlycnLWhRmdTdI9HU6BHQEXhdANMZL0aF0yTTrMzvxHi0u-YyHMJCP9Jzg/exec';
  var DISPLAY_ROLES = new Set([
    '主席', '副主席', '秘書財務', '資訊組長', '成長協調', '教育協調', '導師協調', '接待組長', '活動協調'
  ]);

  function failure(status, message, snapshot) {
    return {
      ok: false,
      status: status,
      latestConfirmed: false,
      snapshot: snapshot || null,
      error: {code: status, message: message},
      fetchedAt: null
    };
  }

  function normalizeNameKey(value) {
    return String(value == null ? '' : value)
      .normalize('NFKC')
      .toLocaleLowerCase('zh-TW')
      .replace(/[\p{P}\p{S}\p{Z}\s]+/gu, '');
  }

  function validatePayload(payload) {
    if (!payload || typeof payload !== 'object' || payload.ok !== true ||
        !Array.isArray(payload.members) || payload.members.length === 0 || payload.members.length > 999 || !Array.isArray(payload.groups)) {
      return {status: 'invalid', message: '中央名冊回應格式不正確。'};
    }

    if (typeof payload.rosterVersion !== 'number' || !Number.isFinite(payload.rosterVersion) || payload.rosterVersion < 0) {
      return {status: 'unversioned', message: '尚未接入中央名冊。'};
    }
    if (typeof payload.effectiveAsOf !== 'string' || !payload.effectiveAsOf.trim() ||
        typeof payload.contentHash !== 'string' || !payload.contentHash.trim()) {
      return {status: 'invalid', message: '中央名冊缺少版本日期或內容識別碼。'};
    }

    var ids = new Set();
    var memberIds = new Set();
    var memberNos = new Set();
    var members = [];
    for (var i = 0; i < payload.members.length; i += 1) {
      var source = payload.members[i];
      if (!source || typeof source !== 'object' || typeof source.id !== 'number' || !Number.isFinite(source.id) ||
          typeof source.memberId !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source.memberId) ||
          typeof source.memberNo !== 'string' || !source.memberNo.trim() ||
          typeof source.name !== 'string' || !source.name.trim() ||
          typeof source.profession !== 'string' || typeof source.role !== 'string' ||
          !Array.isArray(source.aliases) || source.aliases.some(function (alias) {
            return typeof alias !== 'string' || !alias.trim();
          })) {
        return {status: 'invalid', message: '中央名冊有欄位格式不正確的會員。'};
      }

      var memberNo = source.memberNo.trim();
      var memberId = source.memberId.toLowerCase();
      var chains = source.chains === undefined ? [] : source.chains;
      if (!Array.isArray(chains) || chains.some(function (code) { return !/^[A-E]$/.test(code); }) ||
          new Set(chains).size !== chains.length) {
        return {status: 'invalid', message: '中央名冊會員分組格式不正確，未套用名冊。'};
      }
      if (ids.has(source.id) || memberIds.has(memberId) || memberNos.has(memberNo)) {
        return {status: 'invalid', message: '中央名冊會員 ID 或會員編號重複，未套用名冊。'};
      }
      ids.add(source.id);
      memberIds.add(memberId);
      memberNos.add(memberNo);
      var role = source.role.trim();
      members.push({
        id: source.id,
        memberId: memberId,
        memberNo: memberNo,
        name: source.name.trim(),
        profession: source.profession.trim(),
        chains: chains.slice().sort(),
        role: DISPLAY_ROLES.has(role) ? role : '',
        aliases: source.aliases.map(function (alias) { return alias.trim(); })
      });
    }

    var groups = [];
    for (var g = 0; g < payload.groups.length; g += 1) {
      var group = payload.groups[g];
      if (!group || typeof group !== 'object' || typeof group.code !== 'string' || !group.code.trim() ||
          typeof group.name !== 'string' || !group.name.trim() ||
          typeof group.leader !== 'string' || typeof group.schedule !== 'string') {
        return {status: 'invalid', message: '中央名冊有欄位格式不正確的小組。'};
      }
      groups.push({
        code: group.code.trim(), name: group.name.trim(),
        leader: group.leader.trim(), schedule: group.schedule.trim()
      });
    }

    return {snapshot: {
      members: members,
      groups: groups,
      rosterVersion: payload.rosterVersion,
      effectiveAsOf: payload.effectiveAsOf.trim(),
      contentHash: payload.contentHash.trim()
    }};
  }

  function createMemberRegistryClient(options) {
    options = options || {};
    var fetcher = options.fetchImpl || (root.fetch && root.fetch.bind(root));
    var apiUrl = options.apiUrl || API_URL;
    var timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 15000;
    var now = options.now || Date.now;
    var lastGoodSnapshot = null;
    var inFlight = null;

    async function requestLatest() {
      if (typeof fetcher !== 'function') {
        return failure('unavailable', '目前無法連線中央名冊；資料未確認最新。', lastGoodSnapshot);
      }
      var controller = new AbortController();
      var timedOut = false;
      var timer;
      var timeout = new Promise(function (_resolve, reject) {
        timer = setTimeout(function () {
          timedOut = true;
          controller.abort();
          var error = new Error('中央名冊連線逾時。');
          error.code = 'timeout';
          reject(error);
        }, timeoutMs);
      });

      try {
        var separator = apiUrl.indexOf('?') === -1 ? '?' : '&';
        var response = await Promise.race([
          (async function () {
            var result = await fetcher(apiUrl + separator + '_huaMembers=' + encodeURIComponent(String(now())), {
              method: 'GET', cache: 'no-store', credentials: 'omit', signal: controller.signal
            });
            if (!result || !result.ok) {
              throw new Error('中央名冊 HTTP ' + (result ? result.status : '連線失敗') + '。');
            }
            return result.json();
          })(),
          timeout
        ]);
        var parsed = validatePayload(response);
        if (!parsed.snapshot) return failure(parsed.status, parsed.message, lastGoodSnapshot);

        lastGoodSnapshot = parsed.snapshot;
        return {
          ok: true,
          status: 'active',
          latestConfirmed: true,
          snapshot: parsed.snapshot,
          error: null,
          fetchedAt: new Date(now()).toISOString()
        };
      } catch (error) {
        if (timedOut || (error && error.code === 'timeout')) {
          return failure('timeout', '中央名冊連線逾時；目前資料未確認最新。', lastGoodSnapshot);
        }
        return failure('unavailable', '無法確認中央名冊最新版；目前資料未確認最新。', lastGoodSnapshot);
      } finally {
        clearTimeout(timer);
      }
    }

    function load(loadOptions) {
      var force = !!(loadOptions && loadOptions.force);
      if (inFlight && !force) return inFlight;
      var current = requestLatest();
      if (!force) {
        inFlight = current;
        current.finally(function () {
          if (inFlight === current) inFlight = null;
        });
      }
      return current;
    }

    return {load: load};
  }

  function reconcileWeeklyRows(members, palmsRows) {
    members = Array.isArray(members) ? members : [];
    palmsRows = Array.isArray(palmsRows) ? palmsRows : [];
    var byAlias = new Map();
    var possibleMatches = new Map();
    var ambiguousIds = new Set();

    members.forEach(function (member) {
      var aliases = [member.name].concat(Array.isArray(member.aliases) ? member.aliases : []);
      aliases.forEach(function (alias) {
        var key = normalizeNameKey(alias);
        if (!key) return;
        if (!byAlias.has(key)) byAlias.set(key, new Set());
        byAlias.get(key).add(member.memberId);
      });
    });

    palmsRows.forEach(function (row, index) {
      var palmsName = Array.isArray(row) ? row[1] : row && row.name;
      var key = normalizeNameKey(palmsName);
      var candidates = key && byAlias.get(key) ? Array.from(byAlias.get(key)) : [];
      if (candidates.length > 1) candidates.forEach(function (id) { ambiguousIds.add(id); });
      if (candidates.length === 1) {
        if (!possibleMatches.has(candidates[0])) possibleMatches.set(candidates[0], []);
        possibleMatches.get(candidates[0]).push(index);
      }
    });

    var records = [];
    var pending = [];
    members.forEach(function (member) {
      var rowIndexes = possibleMatches.get(member.memberId) || [];
      if (ambiguousIds.has(member.memberId) || rowIndexes.length > 1) {
        pending.push({memberId: member.memberId, memberNo: member.memberNo, name: member.name, status: '待核對'});
        return;
      }
      if (!rowIndexes.length) {
        pending.push({memberId: member.memberId, memberNo: member.memberNo, name: member.name, status: '待PALMS資料'});
        return;
      }
      var sourceRow = palmsRows[rowIndexes[0]];
      if (!Array.isArray(sourceRow)) {
        pending.push({memberId: member.memberId, memberNo: member.memberNo, name: member.name, status: '待核對'});
        return;
      }
      var canonicalRow = sourceRow.slice();
      // PALMS 排名不是會員編號；只以中央 memberNo 和顯示姓名輸出。
      canonicalRow[0] = member.memberNo;
      canonicalRow[1] = member.name;
      canonicalRow.memberId = member.memberId;
      canonicalRow.memberNo = member.memberNo;
      records.push(canonicalRow);
    });

    return {members: records, pending: pending};
  }

  var defaultClient = createMemberRegistryClient();
  return {
    apiUrl: API_URL,
    displayRoles: Array.from(DISPLAY_ROLES),
    load: defaultClient.load,
    createMemberRegistryClient: createMemberRegistryClient,
    normalizeNameKey: normalizeNameKey,
    reconcileWeeklyRows: reconcileWeeklyRows
  };
});
