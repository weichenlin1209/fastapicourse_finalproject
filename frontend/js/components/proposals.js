import { api } from '../api.js';
import { clear, formatDate, h } from '../utils.js';

let currentUser = null;

export function init(user) {
  currentUser = user;
}

export async function render(container) {
  clear(container);

  const header = h('div', { class: 'section-header' },
    h('h2', {}, '🎸 歌曲提案'),
    h('button', { class: 'btn-primary btn-sm', onClick: () => showCreateForm(container) }, '+ 新增提案'),
  );
  container.append(header);

  container.append(h('div', { class: 'loading', id: 'proposals-loading' },
    h('div', { class: 'spinner' }),
    h('p', {}, '載入提案中…'),
  ));

  try {
    const items = await api.get('/song-proposals');
    document.getElementById('proposals-loading')?.remove();

    if (items.length === 0) {
      container.append(
        h('div', { class: 'empty-state' },
          h('div', { class: 'empty-icon' }, '🎶'),
          h('p', {}, '還沒有歌曲提案，來新增第一首吧！'),
        ),
      );
      return;
    }

    const list = h('div', { class: 'list' });

    for (const item of items) {
      const isOwner = item.initiator_id === currentUser?.sub || item.initiator_id === currentUser?.id;

      const card = h('div', { class: 'item-card' },
        h('h3', {}, `🎵 ${item.song_name}`),
        h('div', { class: 'meta' },
          h('span', {}, `👤 提案者 ID: ${item.initiator_id}`),
          h('span', {}, `🕐 ${formatDate(item.created_at)}`),
        ),
      );

      if (item.members && item.members.length > 0) {
        const chips = h('div', { class: 'members' });
        for (const m of item.members) {
          chips.append(h('span', { class: 'member-chip' }, `🎼 ${m.instrument}`));
        }
        card.append(chips);
      } else {
        card.append(h('p', { style: { color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '0.5rem' } }, '尚無成員加入'));
      }

      list.append(card);
    }

    container.append(list);
  } catch (err) {
    document.getElementById('proposals-loading')?.remove();
    container.append(h('p', { class: 'error' }, err.message));
  }
}

function showCreateForm(container) {
  const existing = container.querySelector('.create-form-card');
  if (existing) { existing.remove(); return; }

  const wrapper = h('div', { class: 'create-form-card' },
    h('h3', {}, '🎵 新增歌曲提案'),
    h('form', {},
      h('label', {}, '歌曲名稱',
        h('input', { name: 'song_name', required: true, placeholder: '例：Bohemian Rhapsody' }),
      ),
      h('div', { class: 'form-actions' },
        h('button', { type: 'submit', class: 'btn-primary btn-sm' }, '🚀 建立提案'),
        h('button', { type: 'button', class: 'btn-secondary btn-sm', onClick: () => render(container) }, '取消'),
      ),
      h('p', { class: 'error' }),
    ),
  );

  const header = container.querySelector('.section-header');
  if (header) {
    header.insertAdjacentElement('afterend', wrapper);
  } else {
    container.prepend(wrapper);
  }

  wrapper.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await api.post('/song-proposals', data);
      await render(container);
    } catch (err) {
      wrapper.querySelector('.error').textContent = err.message;
    }
  });
}