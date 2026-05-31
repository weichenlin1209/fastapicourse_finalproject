import { api } from '../api.js';
import { clear, formatDate, h } from '../utils.js';

let currentUser = null;

export function init(user) {
  currentUser = user;
}

export async function render(container) {
  clear(container);

  const header = h('div', { class: 'section-header' },
    h('h2', {}, 'Song Proposals'),
    h('button', { class: 'btn-primary btn-sm', onClick: () => showCreateForm(container) }, '+ New Proposal'),
  );
  container.append(header);

  try {
    const items = await api.get('/song-proposals');
    const list = h('div', { class: 'list' });

    for (const item of items) {
      const card = h('div', { class: 'item-card' },
        h('h3', {}, item.song_name),
        h('div', { class: 'meta' }, `Proposed by User ${item.initiator_id} on ${formatDate(item.created_at)}`),
      );

      if (item.members && item.members.length > 0) {
        const chips = h('div', { class: 'members' });
        for (const m of item.members) {
          chips.append(h('span', { class: 'member-chip' }, `${m.instrument}`));
        }
        card.append(chips);
      }

      list.append(card);
    }

    container.append(list);
  } catch (err) {
    container.append(h('p', { class: 'error' }, err.message));
  }
}

function showCreateForm(container) {
  const wrapper = h('div', { class: 'card', style: { marginBottom: '1rem' } },
    h('form', {},
      h('label', {}, 'Song Name',
        h('input', { name: 'song_name', required: true, placeholder: 'e.g. Wonderwall' }),
      ),
      h('div', { style: { display: 'flex', gap: '0.5rem' } },
        h('button', { type: 'submit', class: 'btn-primary btn-sm' }, 'Create'),
        h('button', { type: 'button', class: 'btn-secondary btn-sm', onClick: () => render(container) }, 'Cancel'),
      ),
      h('p', { class: 'error' }),
    ),
  );
  container.append(wrapper);

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
