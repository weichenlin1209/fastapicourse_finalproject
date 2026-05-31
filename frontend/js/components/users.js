import { api } from '../api.js';
import { clear, formatDate, h } from '../utils.js';

let currentUser = null;

export function init(user) {
  currentUser = user;
}

export async function render(container) {
  clear(container);

  let users;
  try {
    users = await api.get('/users');
  } catch (err) {
    container.append(h('p', { class: 'error' }, err.message));
    return;
  }

  const header = h('div', { class: 'section-header' },
    h('h2', {}, 'User Management'),
    h('button', { class: 'btn-primary btn-sm', onClick: () => showCreateForm(container) }, '+ Create User'),
  );
  container.append(header);

  const stats = h('div', { class: 'stats-bar' },
    h('span', {}, `Total: ${users.length} user${users.length !== 1 ? 's' : ''}`),
    h('span', {}, `Admins: ${users.filter(u => u.role === 'officer').length}`),
    h('span', {}, `Members: ${users.filter(u => u.role === 'member').length}`),
  );
  container.append(stats);

  const list = h('div', { class: 'list' });

  for (const u of users) {
    const isSelf = currentUser && u.id === currentUser.sub;

    const metaParts = [`Role: ${u.role}`, `Created: ${formatDate(u.created_at)}`];
    if (isSelf) metaParts.push('(you)');

    const card = h('div', { class: 'item-card' },
      h('div', { class: 'item-info' },
        h('h3', {}, u.username + (isSelf ? ' (you)' : '')),
        h('div', { class: 'meta' }, metaParts.join('  |  ')),
      ),
    );

    if (!isSelf) {
      card.append(
        h('div', { class: 'actions' },
          h('button', { class: 'btn-danger btn-sm', onClick: () => deleteUser(container, u) }, 'Delete'),
        ),
      );
    }

    list.append(card);
  }

  container.append(list);
}

function showCreateForm(container) {
  const wrapper = h('div', { class: 'card', style: { marginBottom: '1rem' } });
  wrapper.innerHTML = `
    <form>
      <label>Username
        <input type="text" name="username" required minlength="3" placeholder="Choose a username">
      </label>
      <div style="display:flex;gap:0.5rem">
        <button type="submit" class="btn-primary btn-sm">Create</button>
        <button type="button" class="btn-secondary btn-sm" id="cancel-user-form">Cancel</button>
      </div>
      <p class="error"></p>
    </form>
    <div id="temp-password-result" class="hidden">
      <hr style="margin:1rem 0">
      <p><strong>User created.</strong> Share the temporary password below:</p>
      <div id="temp-password-value" class="temp-password"></div>
      <p class="success">This password will not be shown again.</p>
    </div>
  `;

  container.prepend(wrapper);

  wrapper.querySelector('#cancel-user-form').onclick = () => render(container);

  wrapper.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { username: fd.get('username') };

    try {
      const result = await api.post('/users', data);

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
  if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
  try {
    await api.delete(`/users/${user.id}`);
    await render(container);
  } catch (err) {
    alert(err.message);
  }
}
