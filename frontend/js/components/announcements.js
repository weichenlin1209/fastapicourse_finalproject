import { api } from '../api.js';
import { clear, formatDate, h } from '../utils.js';

let currentUser = null;

export function init(user) {
  currentUser = user;
}

export async function render(container) {
  clear(container);

  const isOfficer = currentUser?.role === 'officer';
  const header = h('div', { class: 'section-header' },
    h('h2', {}, 'Announcements'),
  );

  if (isOfficer) {
    header.append(
      h('button', { class: 'btn-primary btn-sm', onClick: () => showCreateForm(container) }, '+ New'),
    );
  }

  container.append(header);

  try {
    const items = await api.get('/announcements');
    const list = h('div', { class: 'list' });

    for (const item of items) {
      const card = h('div', { class: 'item-card' },
        h('h3', {}, item.title),
        h('div', { class: 'meta' }, `${formatDate(item.created_at)}`),
        h('p', {}, item.content),
      );

      if (isOfficer) {
        const actions = h('div', { class: 'actions' },
          h('button', { class: 'btn-secondary btn-sm', onClick: () => showEditForm(container, item) }, 'Edit'),
          h('button', { class: 'btn-danger btn-sm', onClick: () => deleteItem(container, item) }, 'Delete'),
        );
        card.append(actions);
      }

      list.append(card);
    }

    container.append(list);
  } catch (err) {
    container.append(h('p', { class: 'error' }, err.message));
  }
}

async function showCreateForm(container) {
  const form = createForm(null);
  container.append(form);

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
  const form = createForm(item);
  container.append(form);

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

function createForm(item) {
  const form = h('div', { class: 'card', style: { marginBottom: '1rem' } },
    h('form', {},
      h('label', {}, 'Title',
        h('input', { name: 'title', value: item?.title || '', required: true }),
      ),
      h('label', {}, 'Content',
        h('textarea', { name: 'content', required: true }, item?.content || ''),
      ),
      h('div', { style: { display: 'flex', gap: '0.5rem' } },
        h('button', { type: 'submit', class: 'btn-primary btn-sm' }, 'Save'),
        h('button', { type: 'button', class: 'btn-secondary btn-sm', onClick: () => render(container) }, 'Cancel'),
      ),
      h('p', { class: 'error' }),
    ),
  );
  return form;
}

async function deleteItem(container, item) {
  if (!confirm(`Delete announcement "${item.title}"?`)) return;
  try {
    await api.delete(`/announcements/${item.id}`);
    await render(container);
  } catch (err) {
    alert(err.message);
  }
}
