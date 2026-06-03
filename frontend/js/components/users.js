import { api } from '../api.js';
import { clear, formatDate, h } from '../utils.js';

let currentUser = null;

export function init(user) {
  currentUser = user;
}

export async function render(container) {
  clear(container);

  const header = h('div', { class: 'section-header' },
    h('h2', {}, '👥 成員管理'),
    h('button', { class: 'btn-primary btn-sm', onClick: () => showCreateForm(container) }, '+ 新增成員'),
  );
  container.append(header);

  container.append(h('div', { class: 'loading', id: 'users-loading' },
    h('div', { class: 'spinner' }),
    h('p', {}, '載入成員中…'),
  ));

  let users;
  try {
    users = await api.get('/users');
    document.getElementById('users-loading')?.remove();
  } catch (err) {
    document.getElementById('users-loading')?.remove();
    container.append(h('p', { class: 'error' }, err.message));
    return;
  }

  const officerCount = users.filter(u => u.role === 'officer').length;
  const memberCount = users.filter(u => u.role === 'member').length;

  const stats = h('div', { class: 'stats-bar' },
    h('span', {}, `👤 總計：${users.length} 人`),
    h('span', {}, `⭐ 幹部：${officerCount} 人`),
    h('span', {}, `🎵 一般成員：${memberCount} 人`),
  );
  container.append(stats);

  if (users.length === 0) {
    container.append(
      h('div', { class: 'empty-state' },
        h('div', { class: 'empty-icon' }, '👤'),
        h('p', {}, '目前沒有成員'),
      ),
    );
    return;
  }

  const list = h('div', { class: 'list' });

  for (const u of users) {
    const isSelf = currentUser && (u.id === currentUser.sub || u.id === currentUser.id);
    const isOfficer = u.role === 'officer';

    const roleMap = {
      officer: { class: 'badge-active', label: '幹部', icon: '⭐' },
      member: { class: 'badge-pending', label: '成員', icon: '🎵' },
    };
    const roleInfo = roleMap[u.role] || { class: 'badge-pending', label: u.role, icon: '❓' };

    const card = h('div', { class: 'item-card' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' } },
        h('h3', {}, `${u.username}${isSelf ? ' （你）' : ''}`),
        h('span', { class: `badge ${roleInfo.class}` }, `${roleInfo.icon} ${roleInfo.label}`),
      ),
      h('div', { class: 'meta' },
        h('span', {}, `🕐 加入：${formatDate(u.created_at)}`),
      ),
    );

    if (!isSelf) {
      card.append(
        h('div', { class: 'actions' },
          h('button', { class: 'btn-danger btn-sm', onClick: () => deleteUser(container, u) }, '🗑 刪除'),
        ),
      );
    }

    list.append(card);
  }

  container.append(list);
}

function showCreateForm(container) {
  const existing = container.querySelector('.create-form-card');
  if (existing) { existing.remove(); return; }

  const wrapper = h('div', { class: 'create-form-card' });
  wrapper.innerHTML = `
    <h3>👤 新增成員</h3>
    <form>
      <label>帳號
        <input type="text" name="username" required minlength="3" placeholder="請輸入帳號（至少 3 個字元）">
      </label>
      <div class="form-actions">
        <button type="submit" class="btn-primary btn-sm">🚀 建立帳號</button>
        <button type="button" class="btn-secondary btn-sm" id="cancel-user-form">取消</button>
      </div>
      <p class="error"></p>
    </form>
    <div id="temp-password-result" class="hidden" style="margin-top:1rem">
      <hr class="divider">
      <p style="color:var(--color-text-secondary);margin-bottom:0.5rem">🎉 帳號建立成功！請將以下臨時密碼告知成員：</p>
      <div id="temp-password-value" class="temp-password"></div>
      <p class="success">此密碼僅顯示一次，請妥善保存。</p>
    </div>
  `;

  const header = container.querySelector('.section-header');
  if (header) header.insertAdjacentElement('afterend', wrapper);
  else container.prepend(wrapper);

  wrapper.querySelector('#cancel-user-form').onclick = () => render(container);

  wrapper.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const result = await api.post('/users', { username: fd.get('username') });
      const resultEl = wrapper.querySelector('#temp-password-result');
      resultEl.classList.remove('hidden');
      wrapper.querySelector('#temp-password-value').textContent = result.temporary_password;
      e.target.reset();
      wrapper.querySelector('.error').textContent = '';
    } catch (err) {
      wrapper.querySelector('.error').textContent = err.message;
    }
  });
}

async function deleteUser(container, user) {
  if (!confirm(`確定要刪除成員「${user.username}」嗎？此操作無法復原。`)) return;
  try {
    await api.delete(`/users/${user.id}`);
    await render(container);
  } catch (err) {
    alert(err.message);
  }
}
