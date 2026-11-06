
    (function () {
      'use strict';
      var state = null;
      var pendingCommand = null;
      var busy = false;
      var lastFocus = null;
      var byId = function (id) { return document.getElementById(id); };
      var groupCodesDefault = ['A', 'B', 'C', 'D', 'E'];
      var operationLabels = {
        addMember: '新增會員', updateMember: '修改會員資料', retireMember: '會員退會',
        rejoinMember: '會員重入會', setGroupMembership: '設定分組成員', handoffLeader: '組長交接'
      };
      var auditLabels = {
        initialize: '啟用正本', addMember: '新增會員', updateMember: '修改資料',
        retireMember: '會員退會', rejoinMember: '會員重入會',
        setGroupMembership: '分組異動', handoffLeader: '組長交接'
      };

      function node(tag, text, className) {
        var item = document.createElement(tag);
        if (text !== undefined && text !== null) item.textContent = String(text);
        if (className) item.className = className;
        return item;
      }
      function empty(nodeToClear) {
        while (nodeToClear.firstChild) nodeToClear.removeChild(nodeToClear.firstChild);
      }
      function setStatus(message, kind) {
        var bar = byId('statusline');
        bar.classList.remove('status-success', 'status-error');
        if (kind === 'success') bar.classList.add('status-success');
        if (kind === 'error') bar.classList.add('status-error');
        byId('statusText').textContent = message;
      }
      function errorMessage(error) {
        if (error && typeof error.message === 'string' && error.message.trim()) return error.message.trim();
        return '發生連線或服務錯誤，請稍後重試。';
      }
      function setBusy(value) {
        busy = value;
        byId('initializeButton').disabled = value;
        byId('reloadButton').disabled = value;
        byId('openOperation').disabled = value;
        byId('submitCommand').disabled = value || !!pendingCommand;
        byId('retryCommand').disabled = value;
      }
      function memberIsCurrent(member) {
        // The server snapshot already applies effective membership dates. Do not
        // reinterpret nullable legacy periods after the registryBackend wire.
        return (state.snapshot.members || []).some(function (entry) {
          return entry.memberId === member.memberId;
        });
      }
      function memberName(member) {
        var profile = member.profiles || member;
        return String(profile.displayName || '（未命名）');
      }
      function memberById(id) {
        return (state.members || []).find(function (member) { return member.memberId === id; }) || null;
      }
      function publicMemberById(id) {
        return (state.snapshot.members || []).find(function (member) { return member.memberId === id; }) || null;
      }
      function setVisible(element, visible) { element.hidden = !visible; }
      function safeDate(date) { return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''; }
      function optionsForOperations() {
        var select = byId('operationSelect');
        empty(select);
        var choices = state.actor.role === 'admin'
          ? ['addMember', 'updateMember', 'retireMember', 'rejoinMember', 'setGroupMembership', 'handoffLeader']
          : ['setGroupMembership'];
        choices.forEach(function (type) {
          var option = node('option', operationLabels[type]);
          option.value = type;
          select.appendChild(option);
        });
        byId('permissionNote').textContent = state.actor.role === 'admin'
          ? '管理員可新增、修改、退會、重入會、設定分組與交接組長。'
          : '依已授權組別提供分組操作；會員與組別均以目前正本資料為準。';
      }
      function renderGroups() {
        var list = byId('groupList');
        empty(list);
        var groups = state.snapshot.groups || [];
        if (!roleIsAdmin()) {
          var allowed = state.actor.groupCodes || [];
          groups = groups.filter(function (group) { return allowed.indexOf(group.groupCode) >= 0; });
        }
        if (!groups.length) {
          list.appendChild(node('li', '目前沒有分組資料。', 'muted'));
          return;
        }
        groups.forEach(function (group) {
          var row = node('li');
          var leader = group.leaderMemberId ? memberById(group.leaderMemberId) : null;
          if (!leader) leader = publicMemberById(group.leaderMemberId);
          var title = node('strong', group.groupCode + ' 組');
          row.appendChild(title);
          row.appendChild(document.createTextNode('　組長：' + (leader ? memberName(leader) : '尚未設定')));
          list.appendChild(row);
        });
      }
      function renderMembers() {
        var list = byId('memberList');
        empty(list);
        var isAdmin = state.actor.role === 'admin';
        setVisible(byId('memberPanel'), isAdmin);
        if (!isAdmin) return;
        var members = isAdmin ? (state.members || []) : (state.snapshot.members || []);
        var includeRetired = isAdmin && byId('includeRetired').checked;
        if (isAdmin && !includeRetired) members = members.filter(memberIsCurrent);
        byId('retiredToggleLabel').hidden = !isAdmin;
        byId('memberListNote').textContent = isAdmin
          ? (includeRetired ? '顯示目前與已退會會員；名冊依編號排序。' : '預設顯示截至 ' + state.asOf + ' 的現任會員。')
          : '僅顯示目前會員及您已授權組別的分組資料。';
        if (!members.length) {
          list.appendChild(node('li', '沒有符合條件的會員。', 'empty'));
          return;
        }
        members.slice().sort(function (a, b) { return String(a.memberNo).localeCompare(String(b.memberNo)); }).forEach(function (member) {
          var card = node('li', null, 'member-card');
          var profile = member.profiles || member;
          var info = node('div');
          info.appendChild(node('p', profile.displayName || '（未命名）', 'member-name'));
          var details = String(member.memberNo || '') + (profile.profession ? '　·　' + profile.profession : '');
          var active = !isAdmin || memberIsCurrent(member);
          if (isAdmin && !active) details += '　·　已退會';
          info.appendChild(node('p', details, 'member-meta'));
          card.appendChild(info);
          if (profile.role) card.appendChild(node('span', profile.role, 'badge'));
          var currentMember = publicMemberById(member.memberId);
          var currentGroups = currentMember ? (currentMember.groups || []) : [];
          var chips = node('div', null, 'member-groups');
          currentGroups.forEach(function (code) { chips.appendChild(node('span', code + ' 組', 'group-chip')); });
          if (!currentGroups.length) chips.appendChild(node('span', '未列分組', 'muted small'));
          card.appendChild(chips);
          list.appendChild(card);
        });
      }
      function renderAudit() {
        var audit = state.audit || [];
        setVisible(byId('auditPanel'), state.actor.role === 'admin');
        if (state.actor.role !== 'admin') return;
        var list = byId('auditList');
        empty(list);
        if (!audit.length) {
          list.appendChild(node('li', '尚無異動紀錄。', 'muted'));
          return;
        }
        audit.slice(0, 20).forEach(function (entry) {
          var row = node('li');
          row.appendChild(node('span', auditLabels[entry.type] || '名冊異動', 'audit-type'));
          var member = entry.memberId ? memberById(entry.memberId) : null;
          var detail = '版本 ' + String(entry.version || '') + '　' + String(entry.at || '').replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
          if (member) detail += '　' + String(member.memberNo) + ' ' + memberName(member);
          else if (entry.groupCode) detail += '　' + String(entry.groupCode) + ' 組';
          row.appendChild(document.createTextNode(detail));
          if (entry.actorId) row.appendChild(node('div', '操作者：' + entry.actorId, 'muted small'));
          list.appendChild(row);
        });
      }
      function renderServices() {
        var services = Array.isArray(state.services) ? state.services : [];
        setVisible(byId('servicesPanel'), state.actor.role === 'admin' && services.length > 0);
        var list = byId('servicesList');
        empty(list);
        services.forEach(function (service) {
          if (!service || typeof service.name !== 'string' || typeof service.url !== 'string') return;
          var url;
          try { url = new URL(service.url); } catch (ignore) { return; }
          if (url.protocol !== 'https:') return;
          var row = node('li');
          var link = node('a', service.name);
          link.href = url.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.setAttribute('aria-label', service.name + '（在新分頁開啟）');
          row.appendChild(link);
          list.appendChild(row);
        });
      }
      function renderApp() {
        setVisible(byId('loadError'), false);
        setVisible(byId('notInitialized'), !state.initialized);
        setVisible(byId('app'), !!state.initialized);
        byId('versionBadge').textContent = state.initialized ? '正本版本 ' + state.version : '';
        setVisible(byId('versionBadge'), !!state.initialized);
        if (!state.initialized) {
          var initAdmin = state.actor.role === 'admin';
          byId('initIdentity').textContent = '已取得管理權限：' + state.actor.actorId + '（' + (initAdmin ? '管理員' : '分組組長') + '）';
          byId('initializeButton').textContent = '啟用既有會員正本';
          setVisible(byId('initializeButton'), initAdmin);
          setVisible(byId('initPermissionNote'), !initAdmin);
          setStatus(initAdmin ? '已驗證管理員帳號；等待啟用既有會員正本。' : '會員正本尚未啟用。');
          return;
        }
        setVisible(byId('initializeButton'), false);
        setVisible(byId('initPermissionNote'), false);
        var admin = state.actor.role === 'admin';
        byId('identity').textContent = state.actor.actorId;
        byId('roleBadge').textContent = admin ? '管理員' : '分組組長 · ' + (state.actor.groupCodes || []).join('、');
        byId('asOfBadge').textContent = '資料日期 ' + state.asOf;
        var activeMembers = state.snapshot.members || [];
        var visibleGroups = state.snapshot.groups || [];
        if (!admin) {
          var permittedGroups = state.actor.groupCodes || [];
          activeMembers = activeMembers.filter(function (member) { return (member.groups || []).some(function (code) { return permittedGroups.indexOf(code) >= 0; }); });
          visibleGroups = visibleGroups.filter(function (group) { return permittedGroups.indexOf(group.groupCode) >= 0; });
        }
        byId('activeMetricLabel').textContent = admin ? '目前會員' : '授權組內會員';
        byId('groupMetricLabel').textContent = admin ? '分組' : '授權組別';
        byId('activeCount').textContent = String(activeMembers.length);
        byId('groupCount').textContent = String(visibleGroups.length);
        byId('summaryVersion').textContent = String(state.version);
        byId('versionBadge').textContent = '正本版本 ' + state.version;
        optionsForOperations();
        renderGroups();
        renderMembers();
        renderAudit();
        renderServices();
        setStatus('會員正本已載入。');
      }
      function handleLoad(result) {
        state = result;
        setBusy(false);
        renderApp();
      }
      function handleLoadFailure(error) {
        setBusy(false);
        setVisible(byId('app'), false);
        setVisible(byId('notInitialized'), false);
        setVisible(byId('loadError'), true);
        byId('loadErrorText').textContent = errorMessage(error);
        setStatus('載入失敗，尚未顯示會員資料。', 'error');
      }
      function loadState() {
        if (busy) return;
        setBusy(true);
        setStatus('正在驗證管理權限並載入會員資料…');
        registryBackend.withSuccessHandler(handleLoad).withFailureHandler(handleLoadFailure).registryAdminLoad();
      }
      function roleIsAdmin() { return state && state.actor && state.actor.role === 'admin'; }
      function createUuid() {
        var bytes = new Uint8Array(16);
        if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
        else for (var i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        var hex = Array.prototype.map.call(bytes, function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
        return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
      }
      function addField(container, labelText, id, type, value, required, maxLength) {
        var wrap = node('div', null, 'field');
        var label = node('label', labelText);
        label.htmlFor = id;
        var input = node(type === 'textarea' ? 'textarea' : 'input');
        input.id = id;
        if (type !== 'textarea') input.type = type;
        input.setAttribute('aria-label', labelText);
        if (value !== undefined && value !== null) input.value = String(value);
        if (required) input.required = true;
        if (maxLength) input.maxLength = maxLength;
        wrap.appendChild(label);
        wrap.appendChild(input);
        container.appendChild(wrap);
        return input;
      }
      function appendReadOnlyNo(container, member) {
        var input = addField(container, '會員編號（不可修改）', 'readonlyMemberNo', 'text', member.memberNo, false, 3);
        input.readOnly = true;
        input.setAttribute('aria-readonly', 'true');
      }
      function appendProfileFields(container, profile, prefix, full) {
        var fields = [
          ['displayName', '顯示姓名', 80], ['englishName', '英文姓名', 80],
          ['profession', '專業別', 120], ['role', '職務', 80]
        ];
        fields.forEach(function (spec) {
          var input = addField(container, spec[1], prefix + spec[0], 'text', profile ? profile[spec[0]] : '',
            spec[0] === 'displayName' || spec[0] === 'profession', spec[2]);
          input.dataset.profileKey = spec[0];
          if (spec[0] === 'displayName') {
            input.autocomplete = 'name';
            var nameHint = node('p', '請沿用會員名單現有的顯示方式，保留完整姓名、暱稱及中英文之間原有的空格；不要自行截短或改寫格式。', 'muted small field-hint');
            nameHint.id = prefix + 'displayNameHint';
            input.setAttribute('aria-describedby', nameHint.id);
            input.parentNode.appendChild(nameHint);
          } else if (spec[0] === 'englishName') {
            var englishHint = node('p', '英文若已寫在顯示姓名中，這欄毋須重填。', 'muted small field-hint');
            englishHint.id = prefix + 'englishNameHint';
            input.setAttribute('aria-describedby', englishHint.id);
            input.parentNode.appendChild(englishHint);
          }
        });
      }
      function appendGroupChecks(container, selected) {
        var wrap = node('fieldset', null, 'field member-group-fieldset');
        var legend = node('legend', '所屬組別（可複選）', 'field-label');
        wrap.appendChild(legend);
        var options = node('div', null, 'group-options');
        var known = (state.snapshot.groups || []).map(function (group) { return group.groupCode; });
        var codes = known.length ? known : groupCodesDefault;
        codes.forEach(function (code) {
          var label = node('label', null, 'check-option');
          var check = node('input');
          check.type = 'checkbox';
          check.value = code;
          check.dataset.groupCode = code;
          check.checked = (selected || []).indexOf(code) >= 0;
          check.setAttribute('aria-label', code + ' 組');
          label.appendChild(check);
          label.appendChild(node('span', code + ' 組'));
          options.appendChild(label);
        });
        wrap.appendChild(options);
        container.appendChild(wrap);
      }
      function selectedGroupCodes(container) {
        return Array.prototype.map.call(container.querySelectorAll('input[data-group-code]:checked'), function (input) { return input.value; });
      }
      function memberLabel(member) { return String(member.memberNo || '') + '　' + memberName(member); }
      function appendMemberSelect(container, candidates, labelText, selectedId) {
        var wrap = node('div', null, 'field');
        var label = node('label', labelText);
        label.htmlFor = 'memberId';
        var select = node('select');
        select.id = 'memberId';
        select.required = true;
        select.setAttribute('aria-label', labelText);
        var blank = node('option', '請選擇會員');
        blank.value = '';
        blank.disabled = true;
        blank.selected = !selectedId;
        select.appendChild(blank);
        candidates.forEach(function (member) {
          var option = node('option', memberLabel(member));
          option.value = member.memberId;
          if (member.memberId === selectedId) option.selected = true;
          select.appendChild(option);
        });
        wrap.appendChild(label);
        wrap.appendChild(select);
        container.appendChild(wrap);
        return select;
      }
      function appendGroupSelect(container, labelText, allowedCodes) {
        var wrap = node('div', null, 'field');
        var label = node('label', labelText);
        label.htmlFor = 'groupCode';
        var select = node('select');
        select.id = 'groupCode';
        select.required = true;
        select.setAttribute('aria-label', labelText);
        var blank = node('option', '請選擇組別');
        blank.value = '';
        blank.disabled = true;
        blank.selected = true;
        select.appendChild(blank);
        (state.snapshot.groups || []).forEach(function (group) {
          var code = group.groupCode;
          if (allowedCodes && allowedCodes.indexOf(code) < 0) return;
          var option = node('option', code + ' 組');
          option.value = code;
          select.appendChild(option);
        });
        wrap.appendChild(label);
        wrap.appendChild(select);
        container.appendChild(wrap);
        return select;
      }
      function appendEffectiveDate(container, labelText, dateValue) {
        return addField(container, labelText, 'effectiveDate', 'date', safeDate(dateValue || state.asOf), true);
      }
      function allMembers() { return (state.members || []).slice(); }
      function membersWithAnyGroup(code) {
        return allMembers().filter(function (member) {
          return (member.groupMemberships || []).some(function (period) { return period.groupCode === code; });
        });
      }
      function membersInPublicSnapshot() { return (state.snapshot.members || []).map(function (entry) {
        return { memberId: entry.memberId, memberNo: entry.memberNo, profiles: {
          displayName: entry.displayName, englishName: entry.englishName, profession: entry.profession, role: entry.role
        }, groups: entry.groups || [] };
      }); }
      function currentMemberCandidates() {
        return roleIsAdmin() ? allMembers() : membersInPublicSnapshot();
      }
      function appendProfileUpdate(container, member) {
        appendReadOnlyNo(container, member);
        appendProfileFields(container, member.profiles, 'profile_', false);
      }
      function createOperationForm(type) {
        var body = byId('dialogBody');
        empty(body);
        empty(byId('formFeedback'));
        byId('retryCommand').hidden = true;
        byId('submitCommand').hidden = false;
        byId('closeDialog').disabled = false;
        byId('submitCommand').textContent = type === 'retireMember' ? '確認退會' : '確認送出';
        byId('submitCommand').classList.toggle('button-danger', type === 'retireMember');
        byId('dialogTitle').textContent = operationLabels[type] || '管理操作';
        var form = byId('commandForm');
        form.dataset.type = type;
        if (type === 'addMember') {
          var no = addField(body, '會員編號（三位數，歷史不可重用）', 'memberNo', 'text', '', true, 3);
          no.inputMode = 'numeric';
          no.placeholder = '例如 056';
          no.pattern = '(?!000)[0-9]{3}';
          no.title = '請輸入 001 至 999 的三位數編號';
          no.autocomplete = 'off';
          appendProfileFields(body, null, 'profile_', true);
          addField(body, '入會生效日', 'joinedAt', 'date', state.asOf, true);
          appendGroupChecks(body, []);
        } else if (type === 'updateMember') {
          appendMemberSelect(body, allMembers(), '選擇會員');
          var memberSelect = byId('memberId');
          var profileBox = node('div');
          profileBox.id = 'profileEditBox';
          body.appendChild(profileBox);
          memberSelect.addEventListener('change', function () {
            empty(profileBox);
            var selected = memberById(memberSelect.value);
            if (selected) appendProfileUpdate(profileBox, selected);
          });
        } else if (type === 'retireMember') {
          var activeMembers = allMembers().filter(memberIsCurrent);
          appendMemberSelect(body, activeMembers, '選擇現任會員');
          appendEffectiveDate(body, '退會生效日', state.asOf);
          addField(body, '退會原因', 'reason', 'textarea', '', true, 500);
        } else if (type === 'rejoinMember') {
          var retired = allMembers().filter(function (member) { return !memberIsCurrent(member); });
          appendMemberSelect(body, retired, '選擇已退會會員');
          addField(body, '重入會日期', 'joinedAt', 'date', state.asOf, true);
          appendGroupChecks(body, []);
        } else if (type === 'setGroupMembership') {
          var permitted = roleIsAdmin() ? null : (state.actor.groupCodes || []);
          var groupSelect = appendGroupSelect(body, '授權組別', permitted);
          var memberWrap = node('div');
          memberWrap.id = 'groupMemberSelectWrap';
          body.appendChild(memberWrap);
          function updateCandidates() {
            empty(memberWrap);
            var candidates = roleIsAdmin() ? allMembers() : membersInPublicSnapshot();
            appendMemberSelect(memberWrap, candidates, '選擇會員');
          }
          groupSelect.addEventListener('change', updateCandidates);
          updateCandidates();
          var activeWrap = node('div', null, 'field');
          var activeLabel = node('label', '分組動作');
          activeLabel.htmlFor = 'active';
          var activeSelect = node('select');
          activeSelect.id = 'active';
          activeSelect.setAttribute('aria-label', '分組動作');
          activeSelect.required = true;
          [['true', '加入此組'], ['false', '退出此組']].forEach(function (pair) {
            var option = node('option', pair[1]); option.value = pair[0]; activeSelect.appendChild(option);
          });
          activeWrap.appendChild(activeLabel); activeWrap.appendChild(activeSelect); body.appendChild(activeWrap);
          appendEffectiveDate(body, '生效日期', state.asOf);
        } else if (type === 'handoffLeader' && roleIsAdmin()) {
          var handoffGroup = appendGroupSelect(body, '交接組別');
          var leaderWrap = node('div');
          leaderWrap.id = 'leaderSelectWrap';
          body.appendChild(leaderWrap);
          function updateLeaderCandidates() {
            empty(leaderWrap);
            var code = handoffGroup.value;
            appendMemberSelect(leaderWrap, code ? membersWithAnyGroup(code) : [], '新任組長');
          }
          handoffGroup.addEventListener('change', updateLeaderCandidates);
          updateLeaderCandidates();
          appendEffectiveDate(body, '交接生效日', state.asOf);
        }
        if (!body.childNodes.length) body.appendChild(node('p', '目前帳號無權執行此操作。', 'muted'));
        if (pendingCommand) lockPendingForm();
      }
      function lockPendingForm() {
        Array.prototype.forEach.call(byId('dialogBody').querySelectorAll('input, select, textarea'), function (control) { control.disabled = true; });
        byId('submitCommand').disabled = true;
        byId('submitCommand').hidden = true;
        byId('retryCommand').hidden = false;
        byId('closeDialog').disabled = true;
        empty(byId('formFeedback'));
        byId('formFeedback').className = 'dialog-body';
        var message = node('p', '送出未取得成功回應。可重送同一筆資料；系統會沿用原 requestId 與原內容。', 'feedback status-error');
        message.setAttribute('role', 'alert');
        byId('formFeedback').appendChild(message);
      }
      function openOperation() {
        if (busy || pendingCommand) return;
        var type = byId('operationSelect').value;
        if (type === 'handoffLeader' && !roleIsAdmin()) return;
        lastFocus = document.activeElement;
        createOperationForm(type);
        byId('commandDialog').showModal();
        var first = byId('dialogBody').querySelector('input:not([readonly]), select, textarea');
        if (first) first.focus();
      }
      function formValue(id) {
        var control = byId(id);
        return control ? control.value.trim() : '';
      }
      function profileText(key, value) {
        var minimum = key === 'displayName' || key === 'profession' ? 1 : 0;
        var maximum = key === 'profession' ? 120 : 80;
        var length = Array.from(value).length;
        if (length < minimum || length > maximum) throw new Error('請檢查姓名、英文姓名、專業別與職務的必填狀態及字數。');
        if (/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/.test(value) || /^[=+\-@]/.test(value)) {
          throw new Error('欄位含有不支援的控制字元或試算表公式起始符號。');
        }
        return value;
      }
      function requiredValue(value, label) {
        if (!value) throw new Error(label + '為必填欄位。');
        return value;
      }
      function collectCommand(type) {
        var command = { type: type, requestId: createUuid(), expectedVersion: state.version };
        if (type === 'addMember') {
          command.memberNo = requiredValue(formValue('memberNo'), '會員編號');
          if (!/^(?!000)[0-9]{3}$/.test(command.memberNo)) throw new Error('會員編號須為 001 至 999 的三位數。');
          command.profiles = {
            displayName: profileText('displayName', formValue('profile_displayName')),
            englishName: profileText('englishName', formValue('profile_englishName')),
            profession: profileText('profession', formValue('profile_profession')),
            role: profileText('role', formValue('profile_role'))
          };
          command.joinedAt = requiredValue(formValue('joinedAt'), '入會生效日');
          command.groupCodes = selectedGroupCodes(byId('dialogBody'));
        } else if (type === 'updateMember') {
          command.memberId = formValue('memberId');
          var member = memberById(command.memberId);
          if (!member) throw new Error('請選擇會員。');
          var changed = {};
          Array.prototype.forEach.call(byId('dialogBody').querySelectorAll('[data-profile-key]'), function (input) {
            var key = input.dataset.profileKey;
            if (input.value.trim() !== String(member.profiles[key] || '')) changed[key] = profileText(key, input.value.trim());
          });
          if (!Object.keys(changed).length) throw new Error('資料沒有變更，請修改至少一個欄位。');
          command.profiles = changed;
        } else if (type === 'retireMember') {
          command.memberId = requiredValue(formValue('memberId'), '會員');
          command.effectiveDate = requiredValue(formValue('effectiveDate'), '退會生效日');
          command.reason = requiredValue(formValue('reason'), '退會原因');
          if (Array.from(command.reason).length > 500 || /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/.test(command.reason) || /^[=+\-@]/.test(command.reason)) {
            throw new Error('退會原因最多 500 字，且不可含控制字元或試算表公式起始符號。');
          }
        } else if (type === 'rejoinMember') {
          command.memberId = requiredValue(formValue('memberId'), '會員');
          command.joinedAt = requiredValue(formValue('joinedAt'), '重入會日期');
          command.groupCodes = selectedGroupCodes(byId('dialogBody'));
        } else if (type === 'setGroupMembership') {
          command.memberId = requiredValue(formValue('memberId'), '會員');
          command.groupCode = requiredValue(formValue('groupCode'), '授權組別');
          command.effectiveDate = requiredValue(formValue('effectiveDate'), '生效日期');
          command.active = formValue('active') === 'true';
          if (!roleIsAdmin() && (state.actor.groupCodes || []).indexOf(command.groupCode) < 0) throw new Error('所選組別不在目前帳號的授權範圍。');
        } else if (type === 'handoffLeader' && roleIsAdmin()) {
          command.groupCode = requiredValue(formValue('groupCode'), '交接組別');
          command.memberId = requiredValue(formValue('memberId'), '新任組長');
          command.effectiveDate = requiredValue(formValue('effectiveDate'), '交接生效日');
        } else throw new Error('目前帳號無權執行此操作。');
        return command;
      }
      function displayFormError(message) {
        empty(byId('formFeedback'));
        var item = node('p', message, 'feedback status-error');
        item.setAttribute('role', 'alert');
        byId('formFeedback').appendChild(item);
      }
      function submitCurrent(event) {
        event.preventDefault();
        if (busy || pendingCommand) return;
        var form = byId('commandForm');
        if (!form.reportValidity()) return;
        var command;
        try { command = collectCommand(form.dataset.type); }
        catch (error) { displayFormError(errorMessage(error)); return; }
        pendingCommand = command;
        submitPendingCommand();
      }
      function submitPendingCommand() {
        if (busy || !pendingCommand) return;
        busy = true;
        Array.prototype.forEach.call(byId('dialogBody').querySelectorAll('input, select, textarea'), function (control) { control.disabled = true; });
        byId('submitCommand').disabled = true;
        byId('retryCommand').disabled = true;
        byId('closeDialog').disabled = true;
        setStatus('正在儲存會員正本…');
        registryBackend.withSuccessHandler(function (result) {
          state = result;
          pendingCommand = null;
          busy = false;
          byId('commandDialog').close();
          setBusy(false);
          renderApp();
          setStatus('儲存成功，會員正本版本已更新至第 ' + state.version + ' 版。', 'success');
          if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
        }).withFailureHandler(function (error) {
          busy = false;
          lockPendingForm();
          byId('retryCommand').disabled = false;
          setStatus('儲存未完成確認；可在表單中重送同一筆資料。', 'error');
          if (byId('commandDialog').open) byId('retryCommand').focus();
          var detail = errorMessage(error);
          if (detail) {
            var extra = node('p', detail, 'muted small');
            byId('formFeedback').appendChild(extra);
          }
        }).registryAdminSubmit(pendingCommand, state.csrf);
      }
      function initializeRegistry() {
        if (busy || !state || state.initialized || !roleIsAdmin()) return;
        setBusy(true);
        setVisible(byId('initError'), false);
        setStatus('正在啟用既有會員正本…');
        registryBackend.withSuccessHandler(function (result) {
          state = result;
          setBusy(false);
          renderApp();
          setStatus('會員正本已啟用，版本 1。', 'success');
        }).withFailureHandler(function (error) {
          setBusy(false);
          byId('initError').textContent = errorMessage(error);
          setVisible(byId('initError'), true);
          setStatus('啟用未完成，會員資料未顯示為已啟用。', 'error');
        }).registryAdminInitialize(state.csrf);
      }

      byId('reloadButton').addEventListener('click', loadState);
      byId('initializeButton').addEventListener('click', initializeRegistry);
      byId('includeRetired').addEventListener('change', function () { if (state && state.initialized) renderMembers(); });
      byId('openOperation').addEventListener('click', openOperation);
      byId('commandForm').addEventListener('submit', submitCurrent);
      byId('retryCommand').addEventListener('click', submitPendingCommand);
      byId('closeDialog').addEventListener('click', function () {
        if (pendingCommand || busy) return;
        byId('commandDialog').close();
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      });
      byId('commandDialog').addEventListener('cancel', function (event) {
        if (pendingCommand || busy) event.preventDefault();
      });
      window.registryAdminReload = loadState;
      if (window.registryAdminSessionReady()) loadState();
    })();
