/* Star Vision — automatic central database synchronization */
const SV_SYNC_KEY = 'starVisionDB';
const SV_SYNC_INTERVAL = 5000;
let svSyncTimer = null;
let svSyncBusy = false;

function svReadLocalDB() {
  try {
    return JSON.parse(localStorage.getItem(SV_SYNC_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

async function svGetCentral() {
  const r = await fetch('/api/db?ts=' + Date.now(), {
    method: 'GET',
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return await r.json();
}

function svApplyCentral(remote) {
  if (!remote || typeof remote !== 'object') return false;

  const local = svReadLocalDB();
  const remoteVersion = Number(remote._version || 0);
  const localVersion = Number(local?._version || 0);

  if (remoteVersion <= 0) return false;
  if (remoteVersion <= localVersion) return false;

  localStorage.setItem(SV_SYNC_KEY, JSON.stringify(remote));
  window.db = remote;

  if (typeof normalizeDB === 'function') normalizeDB();
  if (typeof render === 'function') render();

  return true;
}

async function svSyncNow() {
  if (svSyncBusy) return;
  svSyncBusy = true;

  try {
    const remote = await svGetCentral();
    svApplyCentral(remote);
  } catch (e) {
    console.warn('Star Vision central sync:', e);
  } finally {
    svSyncBusy = false;
  }
}

function svStartAutoSync() {
  if (svSyncTimer) clearInterval(svSyncTimer);

  svSyncNow();
  svSyncTimer = setInterval(svSyncNow, SV_SYNC_INTERVAL);

  window.addEventListener('online', svSyncNow);
  window.addEventListener('focus', svSyncNow);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) svSyncNow();
  });
}

window.svSyncNow = svSyncNow;
window.svStartAutoSync = svStartAutoSync;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', svStartAutoSync, { once: true });
} else {
  svStartAutoSync();
}

/* =========================================================
   STATUS DE PENDÊNCIAS NOS EVENTOS
========================================================= */

function svPendingMaintenanceForMovement(movementId) {
  if (!window.db || !Array.isArray(db.maintenance)) return [];

  const movement = db.movements?.find(m => m.id === movementId);
  if (!movement) return [];

  const pending = db.maintenance.filter(mt => {
    if (mt.status === 'Concluída') return false;

    // Vínculo oficial com a movimentação.
    if (mt.movementId === movementId) return true;

    // Compatibilidade com registros antigos.
    if (mt.movementName && mt.movementName === movement.name) return true;

    // Último fallback: manutenção ligada a um case que pertence ao evento.
    return movement.cases?.some(ec =>
      ec.caseId && (mt.caseId === ec.caseId || mt.case === ec.caseId)
    );
  });

  // Proteção: se houve falta/dano registrado no retorno, o evento nunca
  // pode aparecer como "SEM PENDÊNCIAS" antes de existir uma manutenção
  // concluída correspondente.
  const unresolvedReturnIssues = [];

  (movement.cases || []).forEach(ec => {
    (ec.items || []).forEach(item => {
      if (item.returnStatus === 'falta' || item.returnStatus === 'dano') {
        const issueType = item.returnStatus === 'falta' ? 'Falta' : 'Dano';
        const itemName = String(item.name || '').trim();

        const relatedMaintenance = db.maintenance.some(mt =>
          mt.status === 'Concluída' &&
          (mt.movementId === movementId ||
           mt.movementName === movement.name ||
           mt.caseId === ec.caseId ||
           mt.case === ec.caseId) &&
          mt.issueType === issueType &&
          String(mt.itemName || '').trim() === itemName
        );

        if (!relatedMaintenance) {
          unresolvedReturnIssues.push({
            movementId,
            caseId: ec.caseId,
            itemName,
            issueType
          });
        }
      }
    });
  });

  return pending.concat(unresolvedReturnIssues);
}

function renderEvents() {
  const target = document.getElementById('eventList');
  if (!target) return;

  if (!db.movements.length) {
    target.innerHTML = `<div class="empty">
      Nenhum evento ou empréstimo cadastrado.
    </div>`;
    return;
  }

  target.innerHTML = `
    <div class="grid">
      ${[...db.movements].reverse().map(m => {
        const pending = m.status === 'Retornado'
          ? svPendingMaintenanceForMovement(m.id)
          : [];

        const pendingBadge = m.status === 'Retornado'
          ? (pending.length
              ? `<span class="badge bad" style="font-weight:bold">
                   EXISTEM PENDÊNCIAS
                 </span>`
              : `<span class="badge ok" style="font-weight:bold">
                   SEM PENDÊNCIAS
                 </span>`)
          : '';

        return `
          <div class="card">
            <div class="between">
              <div>
                <h3>${esc(m.name)}</h3>
                <div class="muted">
                  ${esc(m.id)} • ${esc(m.type)}
                </div>
              </div>

              <span class="status-pill ${
                m.status === 'Retornado'
                  ? 'status-return'
                  : m.status === 'Cancelado'
                    ? 'status-cancel'
                    : 'status-out'
              }">
                ${esc(m.status)}
              </span>
            </div>

            ${pendingBadge ? `<div style="margin-top:8px">${pendingBadge}</div>` : ''}

            <p class="muted">
              Responsável:
              ${esc(m.responsible || '—')}
              <br>
              Saída:
              ${formatDate(m.date)}
              <br>
              Retorno previsto:
              ${formatDate(m.returnDate)}
              <br>
              Cases:
              ${m.cases.length}
            </p>

            <div class="row">
              <button onclick="openMovement('${m.id}')">
                ${m.status === 'Retornado' ? 'Ver conferência' : 'Abrir / conferir'}
              </button>

              ${m.status !== 'Cancelado'
                ? `<button class="danger" onclick="deleteMovement('${m.id}')">
                     Excluir
                   </button>`
                : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

window.svPendingMaintenanceForMovement = svPendingMaintenanceForMovement;
