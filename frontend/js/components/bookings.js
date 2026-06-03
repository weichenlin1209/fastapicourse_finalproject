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
    h('h2', {}, '📅 場地預約'),
    h('button', { class: 'btn-primary btn-sm', onClick: () => showCreateForm(container) }, '+ 新增預約'),
  );
  container.append(header);

  container.append(h('div', { class: 'loading', id: 'bookings-loading' },
    h('div', { class: 'spinner' }),
    h('p', {}, '載入預約中…'),
  ));

  try {
    const [bookings, proposals] = await Promise.all([
      api.get('/bookings'),
      api.get('/song-proposals'),
    ]);

    document.getElementById('bookings-loading')?.remove();

    if (bookings.length === 0) {
      container.append(
        h('div', { class: 'empty-state' },
          h('div', { class: 'empty-icon' }, '📆'),
          h('p', {}, '目前沒有預約，點擊右上角新增！'),
        ),
      );
      return;
    }

    const list = h('div', { class: 'list' });

    for (const b of bookings) {
      const proposal = proposals.find(p => p.id === b.proposal_id);
      const songName = proposal ? proposal.song_name : '未知歌曲';

      const statusMap = {
        active: { class: 'badge-active', label: '進行中', icon: '✅' },
        cancelled: { class: 'badge-cancelled', label: '已取消', icon: '❌' },
        pending: { class: 'badge-pending', label: '待確認', icon: '⏳' },
      };
      const statusInfo = statusMap[b.status] || { class: 'badge-pending', label: b.status, icon: '❓' };

      const card = h('div', { class: 'item-card' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' } },
          h('h3', {}, `🎵 ${songName}`),
          h('span', { class: `badge ${statusInfo.class}` }, `${statusInfo.icon} ${statusInfo.label}`),
        ),
        h('div', { class: 'meta' },
          h('span', {}, `📅 開始：${formatDate(b.start_time)}`),
          h('span', {}, `⏰ 結束：${formatDate(b.end_time)}`),
        ),
      );

      const canCancel = b.status === 'active' && (isOfficer || b.user_id === currentUser?.id);
      if (canCancel) {
        card.append(
          h('div', { class: 'actions' },
            h('button', { class: 'btn-danger btn-sm', onClick: () => cancelBooking(container, b) }, '取消預約'),
          ),
        );
      }

      list.append(card);
    }

    container.append(list);
  } catch (err) {
    document.getElementById('bookings-loading')?.remove();
    container.append(h('p', { class: 'error' }, err.message));
  }
}

async function showCreateForm(container) {
  const existing = container.querySelector('.create-form-card');
  if (existing) { existing.remove(); return; }

  let proposals;
  try {
    proposals = await api.get('/song-proposals');
  } catch {
    return;
  }

  const myProposals = proposals.filter(p => p.initiator_id === currentUser?.sub || p.initiator_id === currentUser?.id);

  if (myProposals.length === 0) {
    const msg = h('div', { class: 'create-form-card' },
      h('p', { style: { color: 'var(--color-warning)', fontSize: '0.9rem' } },
        '⚠️ 您尚無歌曲提案，請先到「歌曲提案」頁面建立提案後再預約。',
      ),
      h('div', { class: 'form-actions' },
        h('button', { class: 'btn-secondary btn-sm', onClick: () => msg.remove() }, '關閉'),
      ),
    );
    const header = container.querySelector('.section-header');
    if (header) header.insertAdjacentElement('afterend', msg);
    else container.prepend(msg);
    return;
  }

  const optionsHtml = myProposals.map(p => `<option value="${p.id}">${p.song_name}</option>`).join('');

  const wrapper = h('div', { class: 'create-form-card' });
  wrapper.innerHTML = `
    <h3>📅 新增預約</h3>
    <form>
      <label>歌曲提案
        <select name="proposal_id" required>
          ${optionsHtml}
        </select>
      </label>
      <div class="form-row">
        <label>開始時間
          <input type="datetime-local" name="start_time" required>
        </label>
        <label>結束時間
          <input type="datetime-local" name="end_time" required>
        </label>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary btn-sm">📌 確認預約</button>
        <button type="button" class="btn-secondary btn-sm" id="cancel-booking-form">取消</button>
      </div>
      <p class="error"></p>
    </form>
  `;

  const header = container.querySelector('.section-header');
  if (header) header.insertAdjacentElement('afterend', wrapper);
  else container.prepend(wrapper);

  wrapper.querySelector('#cancel-booking-form').onclick = () => wrapper.remove();

  wrapper.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const startStr = fd.get('start_time');
    const endStr = fd.get('end_time');

    const durationMs = new Date(endStr) - new Date(startStr);
    if (durationMs <= 0) {
      wrapper.querySelector('.error').textContent = '結束時間必須在開始時間之後。';
      return;
    }
    if (durationMs > 3 * 3600_000) {
      wrapper.querySelector('.error').textContent = '預約時間不能超過 3 小時。';
      return;
    }

    const data = {
      proposal_id: fd.get('proposal_id'),
      start_time: startStr,
      end_time: endStr,
    };

    try {
      await api.post('/bookings', data);
      await render(container);
    } catch (err) {
      wrapper.querySelector('.error').textContent = err.message;
    }
  });
}

async function cancelBooking(container, booking) {
  if (!confirm('確定要取消這個預約嗎？')) return;
  try {
    await api.patch(`/bookings/${booking.id}/cancel`);
    await render(container);
  } catch (err) {
    alert(err.message);
  }
}