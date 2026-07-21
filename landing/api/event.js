// Privacy-light analytics sink: no cookies, no IDs, fire-and-forget.
// Events: reserve_view, reserve_submit, docs_click, lab_apply_submit,
// notify_submit, dataset_download_click, demo_video_play.
// Forwards to ANALYTICS_WEBHOOK_URL when configured; otherwise 204s so the
// client never sees analytics fail.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const url = process.env.ANALYTICS_WEBHOOK_URL;
  if (url) {
    try {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
      // drop oversized payloads instead of truncating into invalid JSON
      if (body.length <= 2000) {
        await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
      }
    } catch (err) {
      console.error('event forward failed:', err);
    }
  }
  return res.status(204).end();
}
