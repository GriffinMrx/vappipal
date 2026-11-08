/**
 * The shared shell for every Vappi email: table-based HTML with inline styles
 * (mail apps ignore most CSS), max 560px and fluid below that, light theme,
 * the text wordmark, then the body rows and a small footer. Escape every
 * user value with `esc` before it goes into a row.
 */

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The purple call-to-action button (already-escaped label and href inside). */
export function button(href: string, label: string) {
  return `<a href="${esc(href)}" style="display:inline-block;background:#53219e;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px">${esc(label)}</a>`;
}

/** Heading + intro paragraph row. */
export function introRow(heading: string, intro: string) {
  return `
      <tr><td style="padding:8px 24px 4px">
        <h1 style="margin:0;font-size:20px;line-height:1.3;color:#161616">${esc(heading)}</h1>
        <p style="margin:8px 0 0;font-size:15px;line-height:1.5;color:#4b4b52">${esc(intro)}</p>
      </td></tr>`;
}

/** A grey card (title, text, optional purple note) and the gap after it, for use inside `cardsRow`. */
export function card(title: string, text: string, note?: string | null) {
  return `
        <tr><td style="padding:14px 16px;border:1px solid #e7e7ea;border-radius:12px;background:#fafafa">
          <div style="font-size:15px;font-weight:700;color:#161616;word-break:break-word">${esc(title)}</div>
          <div style="font-size:14px;color:#4b4b52;margin-top:4px;line-height:1.5">${esc(text)}</div>
          ${note ? `<div style="font-size:12px;font-weight:600;color:#53219e;margin-top:6px">${esc(note)}</div>` : ""}
        </td></tr>
        <tr><td style="height:10px;line-height:10px;font-size:0">&nbsp;</td></tr>`;
}

export function cardsRow(cards: string) {
  return `
      <tr><td style="padding:18px 24px 4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>
      </td></tr>`;
}

export function buttonRow(href: string, label: string) {
  return `
      <tr><td style="padding:10px 24px 28px">
        ${button(href, label)}
      </td></tr>`;
}

/**
 * The whole document. `rows` are body `<tr>`s (from the helpers above);
 * `footer` is already-safe HTML (escape any values in it).
 */
export function emailShell({ title, preheader, rows, footer }: { title: string; preheader: string; rows: string; footer: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f1f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1f3">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
      <tr><td style="padding:28px 24px 8px">
        <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#161616">Vappi</div>
      </td></tr>${rows}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
      <tr><td style="padding:16px 24px;font-size:12px;line-height:1.6;color:#7a7a82;text-align:center">
        ${footer}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
