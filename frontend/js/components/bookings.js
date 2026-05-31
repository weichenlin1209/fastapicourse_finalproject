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
    h('h2', {}, 'Bookings'),
    h('button', { class: 'btn-primary btn-sm', onClick: () => showCreateForm(container) }, '+ New Booking'),
  );
  container.append(header);

  try {
    const [bookings, proposals] = await Promise.all([
      api.get('/bookings'),
      api.get('/song-proposals'),
    ]);

    const list = h('div', { class: 'list' });

    for (const b of bookings) {
      const proposal = proposals.find(p => p.id === b.proposal_id);
      const songName = proposal ? proposal.song_name : 'Unknown';

      const card = h('div', { class: 'item-card' },
        h('h3', {}, songName),
        h('div', { class: 'meta' },
          `${formatDate(b.start_time)} — ${formatDate(b.end_time)} ` +
          `| ${b.status}`,
        ),
      );

      const canCancel = b.status === 'active' && (isOfficer || b.user_id === currentUser?.id);
      if (canCancel) {
        card.append(
          h('div', { class: 'actions' },
            h('button', { class: 'btn-danger btn-sm', onClick: () => cancelBooking(container, b) }, 'Cancel'),
          ),
        );
      }

      list.append(card);
    }

    container.append(list);
  } catch (err) {
    container.append(h('p', { class: 'error' }, err.message));
  }
}

async function showCreateForm(container) {
  let proposals;
  try {
    proposals = await api.get('/song-proposals');
  } catch {
    return;
  }

  const myProposals = proposals.filter(p => p.initiator_id === currentUser?.sub);

  if (myProposals.length === 0) {
    container.append(h('p', { class: 'error' }, 'You have no song proposals. Create one first before booking.'));
    return;
  }

  const wrapper = h('div', { class: 'card', style: { marginBottom: '1rem' } });
  wrapper.innerHTML = `
    <form>
      <label>Song Proposal
        <select name="proposal_id" required>
          ${myProposals.map(p => `<option value="${p.id}">${p.song_name}</option>`).join('')}
        </select>
      </label>
      <div class="form-row">
        <label>Start Time
          <input type="datetime-local" name="start_time" required>
        </label>
        <label>End Time
          <input type="datetime-local" name="end_time" required>
        </label>
      </div>
      <div style="display:flex;gap:0.5rem">
        <button type="submit" class="btn-primary btn-sm">Book</button>
        <button type="button" class="btn-secondary btn-sm" id="cancel-booking-form">Cancel</button>
      </div>
      <p class="error"></p>
    </form>
  `;

  container.append(wrapper);

  wrapper.querySelector('#cancel-booking-form').onclick = () => render(container);

  wrapper.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const startStr = fd.get('start_time');
    const endStr = fd.get('end_time');

    const data = {
      proposal_id: fd.get('proposal_id'),
      start_time: startStr,
      end_time: endStr,
    };

    // Client-side validation: duration ≤ 3 hours (parse as local dates)
    const durationMs = new Date(endStr) - new Date(startStr);
    if (durationMs <= 0) {
      wrapper.querySelector('.error').textContent = 'End time must be after start time.';
      return;
    }
    if (durationMs > 3 * 3600_000) {
      wrapper.querySelector('.error').textContent = 'Booking cannot exceed 3 hours.';
      return;
    }

    try {
      await api.post('/bookings', data);
      await render(container);
    } catch (err) {
      wrapper.querySelector('.error').textContent = err.message;
    }
  });
}

async function cancelBooking(container, booking) {
  if (!confirm('Cancel this booking?')) return;
  try {
    await api.patch(`/bookings/${booking.id}/cancel`);
    await render(container);
  } catch (err) {
    alert(err.message);
  }
}
