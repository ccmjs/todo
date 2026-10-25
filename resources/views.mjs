/** All user-controlled content is escaped before it enters markup. No external fonts or icons. */
export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const paths = {
  check: '<path d="m5 12 4 4L19 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', wallet: '<path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6"/><path d="M20 12h-5v5h5"/>',
  spark: '<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3ZM20 2v4m-2-2h4"/>',
  gift: '<path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12"/><path d="M12 9H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="m14 5 5 5M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  list: '<path d="m3 6 1 1 2-2m-3 8 1 1 2-2m-3 8 1 1 2-2M10 6h10M10 13h10M10 20h10"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  leaf: '<path d="M20 4C5 1 1 13 8 18S23 14 20 4Z"/><path d="m4 21 11-11"/>',
  undo: '<path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5m-5 5 5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
};
export const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
export const money = (minor, currency, locale = 'de-DE') => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 10 ** new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits);
export const number = (value, locale = 'de-DE') => new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(value);
const date = (value, locale, withTime = false) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value));
export const localDateTime = value => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const button = (action, label, glyph, cls = 'button secondary', extra = '') => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${glyph ? icon(glyph) : ''}${label}</button>`;

export function signedOut() {
  return `<section class="signed-out"><span class="empty-icon">${icon('leaf')}</span><h2>Deine Ziele. Dein persönlicher Bereich.</h2><p>Melde dich oben an, um deine Aufgaben und dein Belohnungskonto zu öffnen.</p></section>`;
}

export function main(app) {
  const { state, gui, model, locale } = app;
  const done = state.tasks.filter(task => task.completedAt).length;
  const open = state.tasks.length - done;
  const progress = state.tasks.length ? Math.round(done / state.tasks.length * 100) : 0;
  return `<div class="todo-app ${app.points ? '' : 'without-points'}">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">${icon('check')}</span><span>${escape(app.title)}<span class="brand-dot">.</span></span></div>
      <nav class="main-nav" aria-label="Hauptnavigation">
        ${button('tasks', 'Meine Aufgaben', 'list', `nav-button ${gui.page === 'tasks' ? 'active' : ''}`, `aria-current="${gui.page === 'tasks' ? 'page' : 'false'}"`)}
        ${app.points ? button('account', 'Mein Konto', 'wallet', `nav-button ${gui.page === 'account' ? 'active' : ''}`, `aria-current="${gui.page === 'account' ? 'page' : 'false'}"`) : ''}
      </nav>
      ${app.points ? `<div class="header-account">${button('account', `<strong>${escape(money(model.balanceMinor(state), state.settings.currency, locale))}</strong><span>${number(model.pointUnits(state) / model.POINT_SCALE, locale)} Punkte</span>`, '', 'account-badge', 'aria-label="Guthaben und Punkte: Konto öffnen"')}${button('settings', 'Punkte-Einstellungen', 'settings', 'icon-button settings-button', 'aria-label="Punkte-Einstellungen" title="Punkte-Einstellungen"')}</div>` : '<span></span>'}
    </header>
    <main class="workspace">
      <section class="hero">
        <div><div class="eyebrow"><span class="live-dot"></span> ${new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</div>
          <h1>${gui.page === 'account' ? 'Dein Einsatz.<br><span>Deine Belohnung.</span>' : 'Kleine Schritte.<br><span>Große Erfolge.</span>'}</h1>
          <p>${gui.page === 'account' ? 'Hier wird sichtbar, was du dir erarbeitet und gegönnt hast.' : 'Jeder Haken bringt dich weiter. Mach heute etwas für dich.'}</p></div>
        <div class="hero-progress"><div class="progress-ring" style="--progress:${progress}%"><span>${icon('check')}<strong>${done}<small> / ${state.tasks.length}</small></strong></span></div>
          <div><span class="eyebrow">SCHON GESCHAFFT</span><strong>${done ? 'Das ist dein Fortschritt.' : 'Dein erster Schritt zählt.'}</strong><span>${open ? `${open} ${open === 1 ? 'Aufgabe wartet' : 'Aufgaben warten'} auf deinen Haken.` : state.tasks.length ? 'Alles erledigt. Zeit, stolz zu sein.' : 'Eine kleine Aufgabe ist ein guter Anfang.'}</span></div></div>
      </section>
      ${gui.page === 'account' && app.points ? account(app) : `<div class="dashboard"><section class="task-panel" aria-label="Deine Aufgaben">
        <div class="section-heading"><div><span class="eyebrow">SCHRITT FÜR SCHRITT</span><h2>Deine Aufgaben <span class="count">${open}</span></h2></div>${button('add', 'Neue Aufgabe', 'plus', 'button primary')}</div>
        <div class="list-toolbar"><div class="filters" aria-label="Aufgaben filtern">${[['open', 'Offen', open], ['done', 'Erledigt', done], ['all', 'Alle', state.tasks.length]].map(([value, label, count]) => button('filter', `${label} <span>${count}</span>`, '', `filter ${gui.filter === value ? 'selected' : ''}`, `data-filter="${value}" aria-pressed="${gui.filter === value}"`)).join('')}</div>
          <label class="search">${icon('search')}<input type="search" data-search value="${escape(gui.search)}" placeholder="Suchen" aria-label="Aufgaben durchsuchen"></label></div>
        <div class="task-list">${taskList(app)}</div>
        <div class="list-footer">${icon('leaf')} Ein Schritt nach dem anderen ist auch ein Weg.</div>
      </section>${app.points ? sidebar(app) : ''}</div>`}
      <footer class="app-footer"><span>${icon('check')} Änderungen werden automatisch gespeichert</span><span>In deinem Tempo. Für deine Ziele.</span></footer>
    </main>
  </div>`;
}

export function taskList(app) {
  const tasks = app.state.tasks.filter(task => (app.gui.filter === 'all' || Boolean(task.completedAt) === (app.gui.filter === 'done'))
    && `${task.title} ${task.notes}`.toLocaleLowerCase(app.locale).includes(app.gui.search.toLocaleLowerCase(app.locale)));
  if (!tasks.length) return `<div class="empty-state"><span class="empty-icon">${icon(app.gui.filter === 'done' ? 'check' : 'leaf')}</span><h3>${app.gui.search ? 'Hier ist noch kein Treffer.' : app.gui.filter === 'done' ? 'Hier sammeln sich deine Erfolge.' : app.state.tasks.length ? 'Alles abgehakt. Stark gemacht!' : 'Was möchtest du als Erstes schaffen?'}</h3><p>${app.gui.search ? 'Versuche einen anderen Suchbegriff.' : app.gui.filter === 'done' ? 'Erledige eine Aufgabe und feiere deinen ersten Haken.' : 'Große Ziele beginnen mit einer kleinen Aufgabe.'}</p>${!app.gui.search && app.gui.filter !== 'done' ? button('add', 'Erste Schritte machen', 'plus', 'button secondary') : ''}</div>`;
  return tasks.map(task => taskCard(app, task)).join('');
}

function taskCard(app, task) {
  const done = Boolean(task.completedAt);
  const target = app.model.competition(task);
  const difference = task.progress - (target ?? 0);
  const overdue = !done && task.dueAt && Date.parse(task.dueAt) < Date.now();
  return `<article class="task-card ${done ? 'completed' : ''}" data-task="${escape(task.id)}">
    <div class="task-top"><button type="button" class="check-button ${done ? 'checked' : ''}" data-action="complete" data-id="${escape(task.id)}" role="checkbox" aria-checked="${done}" aria-label="${escape(task.title)}: ${done ? 'wieder öffnen' : 'abhaken'}">${icon('check')}</button>
      <div class="task-copy"><h3>${escape(task.title)}</h3>${task.notes ? `<p>${escape(task.notes)}</p>` : ''}
        <div class="task-meta">${app.competition && task.dueAt ? `<span class="due ${overdue ? 'overdue' : ''}">${icon('clock')}${done ? 'Abgeschlossen' : `${overdue ? 'Fällig seit' : 'Bis'} ${date(task.dueAt, app.locale, true)}`}</span>` : ''}${app.points ? `<span class="points-tag">${icon('spark')}${done && task.rewardId ? '+' : ''}${number(task.points, app.locale)} Punkte</span>` : ''}${done ? `<span class="done-label">${icon('check')} Geschafft${!task.dueAt || !app.competition ? ` am ${date(task.completedAt, app.locale)}` : ''}</span>` : ''}</div>
      </div>${button('edit', '', 'edit', 'icon-button edit-button', `data-id="${escape(task.id)}" aria-label="Aufgabe bearbeiten: ${escape(task.title)}" title="Aufgabe bearbeiten"`)}</div>
    ${app.competition && !done ? `<div class="race"><div class="race-heading"><span>${target === null ? 'Dein Fortschritt' : 'Du & dein Zeitplan'}</span><span class="pace ${difference >= 0 ? 'ahead' : ''}">${target === null ? 'In deinem Tempo' : overdue ? 'Ein nächster Schritt lohnt sich' : difference >= 0 ? `${Math.round(difference)} %-Pkt. voraus` : `${Math.round(-difference)} %-Pkt. bis zum Zeitplan`}</span></div>
      <div class="race-row"><label for="progress-${escape(task.id)}">Du</label><input id="progress-${escape(task.id)}" class="progress-slider" type="range" min="0" max="100" step="1" value="${task.progress}" style="--value:${task.progress}%" data-progress="${escape(task.id)}" aria-label="Fortschritt: ${escape(task.title)}"><output>${task.progress} %</output></div>
      ${target !== null ? `<div class="race-row competitor"><span>Zeitplan</span><div class="bar" role="progressbar" aria-label="Verstrichene Zeit: ${escape(task.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(target)}"><i style="width:${target}%"></i></div><span>${Math.round(target)} %</span></div>` : '<p class="race-hint">Mit einer Fälligkeit erhältst du einen Vergleichsbalken.</p>'}
      </div>` : ''}
  </article>`;
}

function wallet(app, large = false) {
  const { state, model, locale } = app;
  return `<section class="wallet-card ${large ? 'large' : ''}" aria-label="Dein Guthaben"><div class="wallet-heading"><span>${icon('wallet')} DEIN BELOHNUNGSKONTO</span>${icon('spark')}</div>
    <div class="wallet-balance" data-balance>${escape(money(model.balanceMinor(state), state.settings.currency, locale))}</div><div class="wallet-points"><strong data-point-balance>${number(model.pointUnits(state) / model.POINT_SCALE, locale)}</strong> verfügbare Punkte</div>
    <div class="wallet-divider"></div><div class="exchange"><span>Dein Einsatz ist etwas wert.</span><span>1 Punkt = ${escape(money(state.settings.pointValueMinor, state.settings.currency, locale))}</span></div>
    ${button('expense', 'Belohnung eintragen', 'gift', 'button reward', model.balanceMinor(state) <= 0 ? 'disabled' : '')}
    <p class="wallet-footnote">${model.balanceMinor(state) > 0 ? 'Du hast es dir verdient.' : state.transactions.length ? 'Dein nächster Haken füllt dein Konto.' : 'Dein erster Haken füllt dein Konto.'}</p></section>`;
}

function sidebar(app) {
  const rewards = app.state.transactions.filter(entry => entry.kind === 'expense' && !app.state.transactions.some(item => item.reverses === entry.id)).slice(-3).reverse();
  return `<aside class="sidebar">${wallet(app)}<section class="rewards-panel"><div class="mini-heading"><span class="eyebrow">DAS HAST DU DIR GEGÖNNT</span>${icon('gift')}</div>${rewards.length ? rewards.map(entry => `<div class="reward-item"><span class="reward-icon">${icon('gift')}</span><div><strong>${escape(entry.title)}</strong><span>${date(entry.at, app.locale)} · ${escape(money(-entry.amountMinor, entry.currency, app.locale))}</span></div></div>`).join('') : '<p>Der Kaffee nach dem Lernen. Ein Abend im Kino. Hier ist Platz für deine nächsten Belohnungen.</p>'}${button('account', 'Zum Kontoauszug', 'arrow', 'text-button')}</section><div class="motivation-note">${icon('leaf')}<p>Du musst nicht alles auf einmal schaffen.<br><strong>Nur den nächsten Schritt.</strong></p></div></aside>`;
}

function account(app) {
  const { state, model, locale } = app;
  const entries = [...state.transactions].reverse();
  return `<section class="account-overview">${wallet(app, true)}<div class="account-insight">${icon('spark')}<span class="eyebrow">DAS HAST DU DIR ERARBEITET</span><strong>${number(model.earnedPoints(state), locale)} <small>Punkte</small></strong><p>Jeder einzelne steht für eine Aufgabe, die du geschafft hast.</p></div><div class="account-insight peach">${icon('gift')}<span class="eyebrow">DEINE BELOHNUNGSMOMENTE</span><strong>${state.transactions.filter(entry => entry.kind === 'expense' && !state.transactions.some(item => item.reverses === entry.id)).length}</strong><p>Kleine Belohnungen machen den Weg zu deinen Zielen schöner.</p></div></section>
    <section class="ledger-panel"><div class="section-heading"><div><span class="eyebrow">DEIN EINSATZ WIRD SICHTBAR</span><h2>Dein Kontoauszug</h2></div><span class="ledger-count">${entries.length} Buchungen</span></div>
      ${entries.length ? `<div class="table-scroll"><table><thead><tr><th>Buchung</th><th>Datum</th><th>Punkte</th><th>Betrag</th><th><span class="sr-only">Aktion</span></th></tr></thead><tbody>${entries.map(entry => {
        const reversed = state.transactions.some(item => item.reverses === entry.id);
        const positive = entry.pointUnits > 0;
        const label = { income: 'Aufgabe erledigt', expense: reversed ? 'Belohnung · storniert' : 'Belohnung', reversal: 'Aufgabe wieder geöffnet', refund: 'Ausgabe storniert' }[entry.kind];
        return `<tr><td><div class="booking"><span class="booking-icon ${positive ? 'positive' : ''}">${icon(entry.kind === 'expense' ? 'gift' : entry.kind === 'income' ? 'check' : 'undo')}</span><div><strong>${escape(entry.title)}</strong><span>${label}</span></div></div></td><td class="date-cell">${date(entry.at, locale, true)}<small>${new Date(entry.at).getFullYear()}</small></td><td class="numeric ${positive ? 'positive-text' : ''}">${positive ? '+' : '−'}${number(Math.abs(entry.pointUnits) / model.POINT_SCALE, locale)}</td><td class="numeric ${positive ? 'positive-text' : ''}">${positive ? '+' : '−'}${escape(money(Math.abs(entry.amountMinor), entry.currency, locale))}</td><td>${entry.kind === 'expense' && !reversed ? button('refund', 'Stornieren', '', 'text-button', `data-id="${escape(entry.id)}" aria-label="Ausgabe stornieren: ${escape(entry.title)}"`) : ''}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="empty-state"><span class="empty-icon">' + icon('wallet') + '</span><h3>Dein Konto beginnt mit einem Haken.</h3><p>Erledigte Aufgaben und deine Belohnungen erscheinen hier.</p></div>'}
      <p class="ledger-note">Buchungen zeigen den Punktewert und die Währung zum jeweiligen Buchungszeitpunkt. Dein verfügbares Guthaben wird mit dem aktuell eingestellten Punktewert berechnet.</p>
    </section>`;
}

export function dialog(app, type, task) {
  const { state, model } = app;
  const editing = Boolean(task);
  const title = type === 'task' ? editing ? 'Deine Aufgabe' : 'Ein neuer Schritt.' : type === 'expense' ? 'Zeit für eine Belohnung.' : 'Deine Punkte. Deine Regeln.';
  const field = (label, html, hint = '') => `<label class="field"><span>${label}</span>${html}${hint ? `<small>${hint}</small>` : ''}</label>`;
  let body;
  if (type === 'task') {
    body = `${field('Was möchtest du schaffen?', `<input name="title" required maxlength="180" value="${escape(task?.title)}" placeholder="Zum Beispiel: Kapitel 3 durcharbeiten" autofocus>`)}
      ${field('Notiz <span class="optional">optional</span>', `<textarea name="notes" rows="2" maxlength="2000" placeholder="Mach den nächsten Schritt konkret …">${escape(task?.notes)}</textarea>`)}
      ${app.competition ? `<div class="form-grid">${field('Start des Zeitvergleichs', `<input type="datetime-local" name="startAt" required value="${localDateTime(task?.startAt || new Date().toISOString())}">`)}${field('Fällig am <span class="optional">optional</span>', `<input type="datetime-local" name="dueAt" value="${task?.dueAt ? localDateTime(task.dueAt) : ''}">`)}</div>${field('Schon geschafft (%)', `<input type="number" name="progress" min="0" max="100" step="1" required value="${task?.progress ?? 0}" ${task?.completedAt ? 'disabled' : ''}>`, '100 % Fortschritt? Setze anschließend deinen Haken, um die Aufgabe abzuschließen.')}` : ''}
      ${app.points ? field('Deine Belohnung (Punkte)', `<input type="number" name="points" min="0" max="1000000" step="1" required value="${task?.points ?? app.defaultPoints}" ${task?.completedAt ? 'disabled' : ''}>`, 'Die Punkte erhältst du beim Abhaken der Aufgabe.') : ''}
      <div class="dialog-actions">${editing ? button('delete', 'Löschen', 'trash', 'text-button danger', `data-id="${escape(task.id)}"`) : '<span></span>'}<div>${button('close', 'Abbrechen', '', 'button secondary')}<button class="button primary" type="submit">${editing ? 'Speichern' : 'Aufgabe hinzufügen'}${icon('arrow')}</button></div></div>`;
  } else if (type === 'expense') {
    body = `<div class="available"><span>Das kannst du dir gönnen</span><strong>${escape(money(model.balanceMinor(state), state.settings.currency, app.locale))}</strong></div>
      ${field('Womit hast du dich belohnt?', '<input name="title" required maxlength="180" placeholder="Zum Beispiel: Ein Abend im Kino" autofocus>')}
      ${field(`Betrag (${escape(state.settings.currency)})`, '<input name="amount" inputmode="decimal" required placeholder="15,00">', 'Der Betrag wird von deinem verfügbaren Punkteguthaben abgezogen.')}
      <div class="dialog-actions end">${button('close', 'Abbrechen', '', 'button secondary')}<button class="button primary" type="submit">Belohnung eintragen${icon('gift')}</button></div>`;
  } else {
    const digits = model.currencyDigits(state.settings.currency);
    body = `<div class="form-grid">${field('Wert eines Punkts', `<input name="pointValue" inputmode="decimal" required value="${(state.settings.pointValueMinor / 10 ** digits).toFixed(digits).replace('.', ',')}" autofocus>`)}${field('Währung', `<input name="currency" required pattern="[A-Za-z]{3}" maxlength="3" value="${escape(state.settings.currency)}" list="currencies"><datalist id="currencies">${['EUR', 'CHF', 'USD', 'GBP', 'JPY'].map(c => `<option value="${c}"></option>`).join('')}</datalist>`, 'Dreistelliger Code, z. B. EUR oder CHF.')}</div>
      <div class="info-note">${icon('spark')}<p>Du bestimmst, was ein Punkt wert ist. Änderungen bewerten deine <strong>verfügbaren Punkte</strong> neu. Frühere Buchungen behalten ihren damaligen Betrag und ihre Währung. Eine Währungsänderung ist keine Wechselkursumrechnung.</p></div>
      <div class="dialog-actions end">${button('close', 'Abbrechen', '', 'button secondary')}<button class="button primary" type="submit">Einstellungen speichern</button></div>`;
  }
  return `<form data-form="${type}" ${task ? `data-id="${escape(task.id)}"` : ''}><div class="dialog-heading"><div><span class="eyebrow">${type === 'task' ? 'DEIN NÄCHSTER SCHRITT' : 'DEIN BELOHNUNGSKONTO'}</span><h2>${title}</h2></div>${button('close', '', 'close', 'icon-button', 'aria-label="Schließen"')}</div>${body}<p class="form-error" role="alert" hidden></p></form>`;
}

export function confirmation(title, message, action, id, label) {
  return `<div class="dialog-heading"><h2>${escape(title)}</h2>${button('close', '', 'close', 'icon-button', 'aria-label="Schließen"')}</div><p class="confirmation-copy">${escape(message)}</p><div class="dialog-actions end">${button('close', 'Abbrechen', '', 'button secondary')}${button(action, escape(label), '', 'button primary', `data-id="${escape(id)}"`)}</div><p class="form-error" role="alert" hidden></p>`;
}
