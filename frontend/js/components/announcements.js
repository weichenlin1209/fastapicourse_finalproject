import { api } from '../api.js';
import { clear, formatDate, h } from '../utils.js';

let currentUser = null;

export function init(user) {
  currentUser = user;
}

function getAnnouncementMeta(title) {
  if (title.startsWith('【置頂】')) return { type: 'pinned', label: '📌 置頂', cls: 'badge-pinned' };
  if (title.startsWith('【重要】')) return { type: 'important', label: '⚠️ 重要', cls: 'badge-important' };
  if (title.startsWith('【活動】')) return { type: 'event', label: '🎪 活動', cls: 'badge-event' };
  return null;
}

export async function render(container) {
  clear(container);

  const isOfficer = currentUser?.role === 'officer';

  const header = h('div', { class: 'section-header' },
    h('h2', {}, '📢 公告欄'),
  );

  if (isOfficer) {
    header.append(
      h('button', { class: 'btn-primary btn-sm', onClick: () => showCreateForm(container) }, '+ 新增公告'),
    );
  }

  container.append(header);

  container.append(h('div', { class: 'loading', id: 'announcements-loading' },
    h('div', { class: 'spinner' }),
    h('p', {}, '載入公告中…'),
  ));

  try {
    const items = await api.get('/announcements');
    document.getElementById('announcements-loading')?.remove();

    if (items.length === 0) {
      container.append(
        h('div', { class: 'empty-state' },
          h('div', { class: 'empty-icon' }, '📭'),
          h('p', {}, '目前沒有公告'),
        ),
      );
      return;
    }

    const list = h('div', { class: 'list' });

    for (const item of items) {
      const meta = getAnnouncementMeta(item.title);
      const cardClasses = ['item-card', meta?.type === 'pinned' ? 'pinned' : ''].filter(Boolean).join(' ');

      const titleRow = h('div', { class: 'ann-title-row' },
        h('h3', {}, item.title),
      );

      if (meta) {
        titleRow.prepend(h('span', { class: `badge ${meta.cls} badge-ann` }, meta.label));
      }

      const card = h('div', { class: cardClasses },
        titleRow,
        h('div', { class: 'meta' },
          h('span', {}, `🕐 ${formatDate(item.created_at)}`),
        ),
        h('p', { class: 'ann-content' }, item.content),
      );

      if (isOfficer) {
        const actions = h('div', { class: 'actions' },
          h('button', { class: 'btn-secondary btn-sm', onClick: () => showEditForm(container, item) }, '✏️ 編輯'),
          h('button', { class: 'btn-danger btn-sm', onClick: () => deleteItem(container, item) }, '🗑 刪除'),
        );
        card.append(actions);
      }

      list.append(card);
    }

    container.append(list);
  } catch (err) {
    document.getElementById('announcements-loading')?.remove();
    container.append(h('p', { class: 'error' }, err.message));
  }
}

async function showCreateForm(container) {
  const form = createForm(null, container);
  container.insertBefore(form, container.querySelector('.list') || container.firstChild?.nextSibling);

  form.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await api.post('/announcements', data);
      await render(container);
    } catch (err) {
      form.querySelector('.error').textContent = err.message;
    }
  });
}

async function showEditForm(container, item) {
  const form = createForm(item, container);
  container.insertBefore(form, container.querySelector('.list') || null);

  form.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await api.patch(`/announcements/${item.id}`, data);
      await render(container);
    } catch (err) {
      form.querySelector('.error').textContent = err.message;
    }
  });
}

function createForm(item, container) {
  const form = h('div', { class: 'create-form-card' },
    h('h3', {}, item ? '✏️ 編輯公告' : '📝 新增公告'),
    h('p', { class: 'form-hint' }, '提示：標題可加上 【置頂】、【重要】、【活動】 前綴以顯示對應標記'),
    h('form', {},
      h('label', {}, '標題',
        h('input', { name: 'title', value: item?.title || '', required: true, placeholder: '例：【重要】本週社課地點異動' }),
      ),
      h('label', {}, '內容',
        h('textarea', { name: 'content', required: true, placeholder: '公告內容…' }, item?.content || ''),
      ),
      h('div', { class: 'form-actions' },
        h('button', { type: 'submit', class: 'btn-primary btn-sm' }, '💾 儲存'),
        h('button', { type: 'button', class: 'btn-secondary btn-sm', onClick: () => render(container) }, '取消'),
      ),
      h('p', { class: 'error' }),
    ),
  );
  return form;
}

async function deleteItem(container, item) {
  if (!confirm(`確定要刪除公告「${item.title}」嗎？`)) return;
  try {
    await api.delete(`/announcements/${item.id}`);
    await render(container);
  } catch (err) {
    alert(err.message);
  }
}
