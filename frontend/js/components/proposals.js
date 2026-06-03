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
      const currentUserId = currentUser?.sub || currentUser?.id;

      const approvedMembers = (item.members || []).filter(m => m.status === 'approved');
      const pendingMembers = (item.members || []).filter(m => m.status === 'pending');
      const userMember = (item.members || []).find(m => m.user_id === currentUserId);

      const card = h('div', { class: 'item-card' },
        h('h3', {}, `🎵 ${item.song_name}`),
        item.description ? h('p', { class: 'description' }, `📝 ${item.description}`) : null,
        h('div', { class: 'meta' },
          h('span', {}, `👤 提案者 ID: ${item.initiator_id}`),
          h('span', {}, `🕐 ${formatDate(item.created_at)}`),
        ),
      );

      if (approvedMembers.length > 0) {
        const chips = h('div', { class: 'members', style: { marginTop: '0.5rem' } });
        for (const m of approvedMembers) {
          chips.append(h('span', { class: 'member-chip' }, `🎼 ${m.username}（${m.instrument}）`));
        }
        card.append(chips);
      } else {
        card.append(h('p', { style: { color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '0.5rem' } }, '尚無成員加入'));
      }

      if (isOwner && pendingMembers.length > 0) {
        const reqSection = h('div', { style: { marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' } },
          h('p', { style: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.4rem' } }, '⏳ 待審核的加入申請：'),
        );
        for (const m of pendingMembers) {
          const row = h('div', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' } },
            h('span', { style: { fontSize: '0.85rem', flex: 1 } }, `${m.username}（${m.instrument}）`),
            h('button', { class: 'btn-primary btn-sm', style: { padding: '0.2rem 0.6rem', fontSize: '0.75rem' }, onClick: () => approveMember(item.id, m.user_id, container) }, '✓ 同意'),
            h('button', { class: 'btn-danger btn-sm', style: { padding: '0.2rem 0.6rem', fontSize: '0.75rem' }, onClick: () => rejectMember(item.id, m.user_id, container) }, '✗ 拒絕'),
          );
          reqSection.append(row);
        }
        card.append(reqSection);
      }

      if (!isOwner && !userMember) {
        const joinSection = h('div', { style: { marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem', alignItems: 'center' } },
          h('input', { name: 'instrument', placeholder: '你的樂器', style: { flex: 1, margin: 0, padding: '0.4rem 0.7rem', fontSize: '0.82rem' } }),
          h('button', { class: 'btn-primary btn-sm', style: { whiteSpace: 'nowrap' }, onClick: (e) => joinProposal(item.id, e.target.closest('div').querySelector('input'), container) }, '申請加入'),
        );
        card.append(joinSection);
      }

      if (userMember && userMember.status === 'pending') {
        card.append(h('p', { style: { color: 'var(--color-warning)', fontSize: '0.8rem', marginTop: '0.5rem' } }, '⏳ 已送出加入申請，等待提案者審核'));
      }
      if (userMember && userMember.status === 'rejected') {
        card.append(h('p', { style: { color: 'var(--color-error)', fontSize: '0.8rem', marginTop: '0.5rem' } }, '❌ 加入申請已被拒絕'));
      }

      list.append(card);
    }

    container.append(list);
  } catch (err) {
    document.getElementById('proposals-loading')?.remove();
    container.append(h('p', { class: 'error' }, err.message));
  }
}

async function joinProposal(proposalId, inputEl, container) {
  const instrument = inputEl.value.trim();
  if (!instrument) { inputEl.focus(); return; }
  try {
    await api.post(`/song-proposals/${proposalId}/join`, { instrument });
    await render(container);
  } catch (err) {
    alert(err.message);
  }
}

async function approveMember(proposalId, userId, container) {
  try {
    await api.patch(`/song-proposals/${proposalId}/members/${userId}/approve`);
    await render(container);
  } catch (err) {
    alert(err.message);
  }
}

async function rejectMember(proposalId, userId, container) {
  try {
    await api.patch(`/song-proposals/${proposalId}/members/${userId}/reject`);
    await render(container);
  } catch (err) {
    alert(err.message);
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
      h('label', {}, '你的樂器',
        h('input', { name: 'instrument', placeholder: '例：吉他、鋼琴、主唱' }),
      ),
      h('label', {}, '需求描述',
        h('textarea', { name: 'description', rows: 3, placeholder: '需要什麼樂器？例如：需要鼓手和貝斯手' }),
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
