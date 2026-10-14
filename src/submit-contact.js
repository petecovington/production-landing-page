// Real enquiry contents go only to Formspree. Analytics receives a fixed outcome vocabulary.
export async function submitContact(formData, { request = fetch, track, attemptId }) {
  // A measurement failure must never stop or alter real delivery.
  const measure = (...args) => { try { track(...args); } catch { /* analytics is optional */ } };
  measure('form', 'Attempt', { attempt_id: attemptId });
  try {
    const response = await request('https://formspree.io/f/mbdlpyno', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
    });
    if (!response.ok) {
      measure('form', 'Error', { attempt_id: attemptId, error_code: 'http', status: response.status });
      return false;
    }
    measure('form', 'Accepted', { attempt_id: attemptId });
    return true;
  } catch {
    measure('form', 'Error', { attempt_id: attemptId, error_code: 'network' });
    return false;
  }
}
