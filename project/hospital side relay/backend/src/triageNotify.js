/**
 * Tell the Triage Relay (paramedic side) what the hospital did.
 * Fire-and-forget: a failure is logged but never breaks the hospital screen.
 */

const TIMEOUT_MS = 4000;

async function notifyTriage(caseObj, event, extra = {}) {
  try {
    if (!caseObj || caseObj.source !== 'TRIAGE_RELAY') return { skipped: true };

    const base = process.env.TRIAGE_URL;
    const secret = process.env.RELAY_SHARED_SECRET;
    if (!base || !secret) return { skipped: true, reason: 'not configured' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/api/v1/integrations/hospital-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Relay-Key': secret },
        body: JSON.stringify({
          incidentId: caseObj.case_id,
          event,
          status: caseObj.response_status,
          ...extra
        }),
        signal: controller.signal
      });
      if (!res.ok) {
        console.warn(`[Triage Notify] Triage Relay answered ${res.status} for ${event} on ${caseObj.case_id}`);
        return { ok: false, status: res.status };
      }
      return { ok: true };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn(`[Triage Notify] Could not reach Triage Relay for ${event}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

module.exports = { notifyTriage };
