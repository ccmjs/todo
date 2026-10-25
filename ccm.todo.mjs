/**
 * Motivating task list with optional time comparison and a points-backed reward account.
 * @author André Kless <andre.kless@web.de>
 * @copyright 2026 André Kless
 * @license MIT
 * @version 1.0.0
 */
export const component = {
  name: 'todo',
  ccm: '././libs/framework/ccm-28.0.0.min.js',
  config: {
    css: ['ccm.load', '././resources/styles.css'],
    views: ['ccm.load', '././resources/views.mjs'],
    /** A CCM datastore accessor. A named store without url persists in IndexedDB. */
    data: { store: ['ccm.store', { name: 'todo' }], key: 'my_todos' },
    /** Optional CCM user instance. Personal data is loaded only while signed in.
     * The effective dataset key is [data.key, identity.realm, identity.key].
     */
    // user: ['ccm.instance', '././libs/user/ccm.user-1.0.0.min.mjs', { url: 'https://example.com/api' }],
    /** Abarbeiter is always active; these two modes can be enabled independently. */
    competition: true,
    points: true,
    title: 'Momentum',
    locale: 'de-DE',
    defaultPoints: 10,
    /** Initial settings only. Saved account settings take precedence on later starts. */
    account: { pointValue: 0.5, currency: 'EUR' },
    /** Optional initial tasks, used only when the configured dataset does not exist. */
    ignore: { tasks: [] },
    /** Optional callback after a committed change: async ({ app, type, value }). */
    // onchange: async ({ app, type, value }) => {},
  },
  Instance: function () {
    // Built-in domain rules shared with the views; not a configurable dependency.
    Object.defineProperty(this, 'model', { value: model });
    let content, modal, notification, timer, toastTimer, confettiTimer, active;
    let destroyed = false;
    let loaded = false;
    let modalTrigger;
    let pendingFocus;
    let userSlot, connectedUser, accountStore;
    let identity = null;
    let sessionVersion = 0;
    let reloadUser = false;
    let cancelStartup;
    const startupCancelled = new Promise(resolve => { cancelStartup = resolve; });
    this.state = null;
    this.gui = { busy: false, page: 'tasks', filter: 'open', search: '' };

    const setBusy = busy => {
      if (busy) rememberFocus();
      this.gui.busy = busy;
      if (content) { content.inert = busy; content.setAttribute('aria-busy', String(busy)); }
      if (modal?.open) { modal.querySelectorAll('button').forEach(button => { button.disabled = busy; }); }
      if (!busy) restoreFocus();
    };

    const run = action => {
      if (active || destroyed) return Promise.resolve();
      setBusy(true);
      active = (async () => {
        try { return await action(); }
        finally {
          active = null;
          setBusy(false);
          if (reloadUser && !destroyed) {
            reloadUser = false;
            queueMicrotask(() => { if (!destroyed) void this.start().catch(showError); });
          }
        }
      })();
      return active;
    };

    /** Reload the dataset. Invalid data and failed reads never create an empty replacement. */
    this.start = () => run(async () => {
      build();
      clearAccount();
      let version = sessionVersion;
      try {
        if (!this.data?.store?.get || !this.data?.store?.set || typeof this.data.key !== 'string' || !this.ccm.helper.isKey(this.data.key))
          throw new Error('Bitte konfiguriere data.store und einen gültigen data.key (z. B. meine_aufgaben).');
        if (!Number.isInteger(this.defaultPoints) || this.defaultPoints < 0 || this.defaultPoints > 1_000_000)
          throw new Error('defaultPoints muss eine ganze Zahl zwischen 0 und 1.000.000 sein.');
        if (this.user) {
          connectUser();
          await Promise.race([this.user.start(), startupCancelled]);
          if (destroyed) return;
        }
        // Login may have completed while user.start() awaited autoLogin.
        reloadUser = false;
        version = sessionVersion;
        identity = readIdentity();
        if (this.user && !identity) { content.innerHTML = this.views.signedOut(); return; }
        const key = identity ? [this.data.key, identity.realm, identity.key] : this.data.key;
        accountStore = await scopedStore(identity);
        assertSession(version, identity);
        const saved = await accountStore.get(key);
        assertSession(version, identity);
        this.state = saved === null ? this.model.createState(key, this.account, this.ignore?.tasks || [])
          : this.model.validateState(saved, key);
        if (identity) {
          if (saved && (saved.realm !== identity.realm || saved.user !== identity.key))
            throw new Error('Der Datensatz gehört nicht zum angemeldeten Benutzer.');
          this.state.realm = identity.realm;
          this.state.user = identity.key;
        }
        loaded = saved !== null;
        if (!loaded) {
          if (this.data._ !== undefined) this.state._ = structuredClone(this.data._);
          else if (identity) this.state._ = { access: { get: 'owner', set: 'owner', del: 'owner' } };
        }
        if (!this.points) this.gui.page = 'tasks';
        render();
        timer = setInterval(refreshTime, 60_000);
      } catch (error) {
        if (version !== sessionVersion || destroyed) return;
        this.state = null;
        if (this.user && error.name === 'AbortError') { content.innerHTML = this.views.signedOut(); return; }
        content.innerHTML = `<div class="load-error" role="alert"><h2>Deine Aufgaben konnten nicht geladen werden.</h2><p>${this.views.escape(error.message)}</p><button type="button" class="button primary" data-action="reload">Erneut laden</button></div>`;
        throw error;
      }
    });

    const readIdentity = () => {
      if (!this.user || !this.user.isLoggedIn()) return null;
      const current = this.user.getState();
      if (!current || !this.ccm.helper.isKey(current.realm, false) || !this.ccm.helper.isKey(current.key, false))
        throw new Error('Die User-Komponente muss einen gültigen Realm und Benutzerschlüssel liefern.');
      return { realm: current.realm, key: current.key };
    };

    const sameIdentity = (a, b) => a?.realm === b?.realm && a?.key === b?.key;
    const assertSession = (version, expected) => {
      if (destroyed || version !== sessionVersion || !sameIdentity(readIdentity(), expected))
        throw new Error('Die Anmeldung hat sich geändert. Bitte warte, bis dein Konto neu geladen ist.');
    };

    /** Separate authenticated remote accessor; never change a shared store's user.
     * The guard also covers CCM's automatic retry after re-authentication: an old
     * request may not be retried with another account's token.
     */
    const scopedStore = async expected => {
      const source = this.data.store.source?.();
      if (!expected || !source?.url) return this.data.store;
      const user = this.user;
      const assertOwner = () => {
        if (!sameIdentity(readIdentity(), expected)) throw new Error('Das Konto wurde während der Anmeldung gewechselt.');
      };
      return this.ccm.store({ ...source, user: {
        isLoggedIn: () => user.isLoggedIn(),
        getToken: () => { assertOwner(); return user.getToken(); },
        login: async () => { const value = await user.login(); assertOwner(); return value; },
        logout: () => user.logout(),
      } });
    };

    const clearAccount = () => {
      clearInterval(timer); clearTimeout(toastTimer); clearTimeout(confettiTimer);
      closeDialog();
      this.state = null;
      loaded = false;
      identity = null;
      pendingFocus = null;
      if (notification) notification.hidden = true;
      this.element.querySelector('.celebration-layer')?.replaceChildren();
      if (content) content.innerHTML = '<p class="loading" role="status">Deine nächsten Schritte werden geladen …</p>';
    };

    const userChanged = ({ type }) => {
      if (destroyed || !['login', 'register', 'logout', 'deleteAccount'].includes(type)) return;
      sessionVersion++;
      clearAccount();
      this.gui.page = 'tasks'; this.gui.filter = 'open'; this.gui.search = '';
      if (!this.user.isLoggedIn()) content.innerHTML = this.views.signedOut();
      // Do not await start() from an awaited user event (autoLogin/store retry).
      reloadUser = true;
      if (!active) {
        reloadUser = false;
        void this.start().catch(showError);
      }
    };

    const connectUser = () => {
      if (connectedUser === this.user) return;
      if (!this.user.host || !['start', 'login', 'logout', 'isLoggedIn', 'getState', 'getToken'].every(method => typeof this.user[method] === 'function'))
        throw new Error('Bitte konfiguriere eine kompatible CCM-User-Instanz.');
      connectedUser = this.user;
      connectedUser.extensions = [].concat(connectedUser.extensions || [], userChanged);
      userSlot.hidden = false;
      userSlot.append(connectedUser.host);
    };

    /** Read a detached, serializable snapshot including settings, tasks, and ledger. */
    this.getValue = () => structuredClone(this.state);

    /** Public mutations share the same persistence and validation path as the UI. */
    this.addTask = input => change('add', draft => this.model.addTask(draft, input));
    this.editTask = (id, input) => change('edit', draft => this.model.editTask(draft, id, input));
    this.setProgress = (id, progress) => change('progress', draft => {
      const task = findTask(draft, id);
      if (task.completedAt) throw new Error('Öffne die Aufgabe zuerst wieder.');
      return this.model.editTask(draft, id, { ...task, progress });
    });
    this.completeTask = (id, done = true) => change('complete', draft => this.model.completeTask(draft, id, done, this.points), result => {
      if (result?.changed && done) celebrate(result);
    });
    this.deleteTask = id => change('delete', draft => {
      findTask(draft, id);
      draft.tasks = draft.tasks.filter(task => task.id !== id);
      // Ledger entries deliberately keep their title and task reference as history.
    });
    this.spend = (title, amount) => change('expense', draft => {
      if (!this.points) throw new Error('Das Punktekonto ist deaktiviert.');
      return this.model.spend(draft, title, this.model.parseMoney(amount, draft.settings.currency));
    });
    this.refund = id => change('refund', draft => {
      if (!this.points) throw new Error('Das Punktekonto ist deaktiviert.');
      return this.model.refund(draft, id);
    });
    this.setAccount = ({ currency, pointValue }) => change('settings', draft => {
      if (!this.points) throw new Error('Das Punktekonto ist deaktiviert.');
      draft.settings = this.model.validateSettings({ currency, pointValueMinor: this.model.parseMoney(pointValue, currency) });
    });

    function findTask(state, id) {
      const task = state.tasks.find(task => task.id === id);
      if (!task) throw new Error('Diese Aufgabe ist nicht mehr vorhanden.');
      return task;
    }

    const change = (type, mutate, after) => run(async () => {
      if (!this.state) throw new Error('Bitte lade die Aufgaben zuerst.');
      const version = sessionVersion, owner = identity, snapshot = this.state, store = accountStore;
      const key = snapshot.key;
      const commit = async () => {
        assertSession(version, owner);
        const previous = await store.get(key);
        assertSession(version, owner);
        // A stale tab may not overwrite a newer account. Remote atomic CAS requires server support.
        if (Boolean(previous) !== loaded || (previous && (previous.revision !== snapshot.revision || previous.updatedAt !== snapshot.updatedAt)))
          throw new Error('Die Liste wurde inzwischen an anderer Stelle geändert. Lade sie über „Neu laden“ neu und versuche es noch einmal.');
        const draft = structuredClone(snapshot);
        // Respect permissions changed on the server since the dataset was loaded.
        if (previous) {
          delete draft._;
          if (previous._ !== undefined) draft._ = structuredClone(previous._);
        }
        const result = mutate(draft);
        draft.revision++;
        draft.updatedAt = new Date().toISOString();
        this.model.validateState(draft, key);
        // One dataset keeps tasks and their corresponding bookings together.
        await store.set(draft);
        assertSession(version, owner);
        this.state = draft;
        loaded = true;
        closeDialog();
        render();
        notify(type === 'complete' && result?.changed && result.task.completedAt ? 'Geschafft! Ein Schritt weiter.' : 'Gespeichert.');
        after?.(result);
        return result;
      };
      // Serialize cooperating same-origin tabs. Still check revision inside the lock.
      const result = globalThis.navigator?.locks
        ? await navigator.locks.request('ccm-todo-write', commit) : await commit();
      if (this.onchange) {
        try { await this.onchange({ app: this, type, value: this.getValue() }); }
        catch (error) { notify(`Gespeichert. Die Anschlussaktion ist fehlgeschlagen: ${error.message}`, true); }
      }
      return result;
    });

    const build = () => {
      if (content?.isConnected) return;
      closeDialog();
      clearTimeout(toastTimer);
      clearTimeout(confettiTimer);
      this.element.innerHTML = '<div class="todo-user-panel" hidden></div><div class="todo-content"></div><dialog class="todo-dialog"></dialog><div class="toast" role="status" aria-live="polite" aria-atomic="true" hidden></div><div class="celebration-layer" aria-hidden="true"></div>';
      userSlot = this.element.querySelector('.todo-user-panel');
      content = this.element.querySelector('.todo-content');
      modal = this.element.querySelector('dialog');
      notification = this.element.querySelector('.toast');
      content.innerHTML = '<p class="loading" role="status">Deine nächsten Schritte werden geladen …</p>';
      this.element.onclick = event => { void onClick(event).catch(showError); };
      this.element.onsubmit = event => { event.preventDefault(); void onSubmit(event).catch(showError); };
      this.element.oninput = event => {
        if (event.target.matches('[data-search]')) {
          this.gui.search = event.target.value;
          content.querySelector('.task-list').innerHTML = this.views.taskList(this);
        }
        if (event.target.matches('[data-progress]')) {
          event.target.style.setProperty('--value', `${event.target.value}%`);
          event.target.nextElementSibling.value = `${event.target.value} %`;
        }
      };
      this.element.onchange = event => {
        if (!event.target.matches('[data-progress]')) return;
        const slider = event.target;
        void this.setProgress(slider.dataset.progress, Number(slider.value)).catch(error => { if (this.state) render(); showError(error); });
      };
      modal.addEventListener('cancel', event => { event.preventDefault(); if (!this.gui.busy) closeDialog(); });
      modal.addEventListener('click', event => {
        if (event.target === modal && !this.gui.busy) {
          const box = modal.getBoundingClientRect();
          if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog();
        }
      });
      setBusy(this.gui.busy);
    };

    const rememberFocus = () => {
      const focused = this.element.getRootNode().activeElement || document.activeElement;
      const control = content?.contains(focused) ? focused : modal?.open ? modalTrigger : null;
      if (!control) return;
      pendingFocus = control.id ? `#${CSS.escape(control.id)}` : control.dataset.action
        ? `[data-action="${control.dataset.action}"]${control.dataset.id ? `[data-id="${CSS.escape(control.dataset.id)}"]` : ''}${control.dataset.filter ? `[data-filter="${control.dataset.filter}"]` : ''}` : null;
    };

    const restoreFocus = () => {
      if (!pendingFocus || modal?.open || this.gui.busy) return;
      const target = content.querySelector(pendingFocus) || content.querySelector('[data-action="add"]');
      pendingFocus = null;
      target?.focus({ preventScroll: true });
    };

    const render = () => {
      rememberFocus();
      content.innerHTML = this.views.main(this);
      restoreFocus();
    };

    const notify = (message, error = false) => {
      clearTimeout(toastTimer);
      notification.replaceChildren();
      const span = document.createElement('span');
      span.textContent = message;
      notification.append(span);
      notification.classList.toggle('error', error);
      notification.setAttribute('role', error ? 'alert' : 'status');
      notification.hidden = false;
      if (error) {
        const reload = document.createElement('button');
        reload.type = 'button'; reload.dataset.action = 'reload'; reload.textContent = 'Neu laden';
        const dismiss = document.createElement('button');
        dismiss.type = 'button'; dismiss.dataset.action = 'dismiss'; dismiss.textContent = 'Schließen';
        notification.append(reload, dismiss);
      } else toastTimer = setTimeout(() => { notification.hidden = true; }, 4400);
    };

    const showError = error => {
      if (destroyed) return;
      const box = modal.open && modal.querySelector('.form-error');
      if (box) { box.textContent = error.message; box.hidden = false; }
      notify(error.message || 'Das Speichern ist fehlgeschlagen. Bitte versuche es erneut.', true);
    };

    const openDialog = (type, task) => {
      modalTrigger = this.element.getRootNode().activeElement || document.activeElement;
      modal.innerHTML = this.views.dialog(this, type, task);
      modal.setAttribute('aria-label', type === 'task' ? 'Aufgabe bearbeiten' : type === 'expense' ? 'Belohnung eintragen' : 'Punkte-Einstellungen');
      if (!modal.open) modal.showModal();
      modal.querySelector('[autofocus]')?.focus();
    };

    const closeDialog = () => {
      if (!modal?.open) return;
      modal.close();
      modalTrigger?.focus({ preventScroll: true });
      modalTrigger = null;
    };

    const onClick = async event => {
      const target = event.target.closest('[data-action]');
      if (!target || this.gui.busy || destroyed) return;
      const { action, id } = target.dataset;
      switch (action) {
        case 'add': openDialog('task'); break;
        case 'edit': openDialog('task', findTask(this.state, id)); break;
        case 'close': closeDialog(); break;
        case 'dismiss': notification.hidden = true; break;
        case 'reload': await this.start(); break;
        case 'tasks': case 'account': this.gui.page = action; render(); break;
        case 'filter': this.gui.filter = target.dataset.filter; render(); break;
        case 'complete': await this.completeTask(id, !findTask(this.state, id).completedAt); break;
        case 'settings': case 'expense': openDialog(action); break;
        case 'delete':
          modal.innerHTML = this.views.confirmation('Aufgabe löschen?', 'Die Aufgabe wird entfernt. Bereits gebuchte Punkte und der Kontoauszug bleiben erhalten.', 'confirm-delete', id, 'Aufgabe löschen');
          modal.querySelector('[data-action="close"]')?.focus();
          break;
        case 'confirm-delete': await this.deleteTask(id); break;
        case 'refund':
          modalTrigger = target;
          modal.innerHTML = this.views.confirmation('Ausgabe stornieren?', 'Die damals ausgegebenen Punkte werden deinem Konto wieder gutgeschrieben. Beide Buchungen bleiben im Kontoauszug sichtbar.', 'confirm-refund', id, 'Ausgabe stornieren');
          modal.setAttribute('aria-label', 'Ausgabe stornieren');
          modal.showModal();
          break;
        case 'confirm-refund': await this.refund(id); break;
      }
    };

    const onSubmit = async event => {
      if (this.gui.busy) return;
      const form = event.target;
      if (!form.matches('[data-form]') || !form.reportValidity()) return;
      const input = new FormData(form);
      switch (form.dataset.form) {
        case 'task': {
          const task = form.dataset.id ? findTask(this.state, form.dataset.id) : null;
          const value = { title: input.get('title'), notes: input.get('notes'),
            points: this.points && !task?.completedAt ? Number(input.get('points')) : task?.points ?? 0,
            progress: this.competition && !task?.completedAt ? Number(input.get('progress')) : task?.progress ?? 0,
            startAt: this.competition ? new Date(input.get('startAt')).toISOString() : task?.startAt || new Date().toISOString(),
            dueAt: this.competition ? input.get('dueAt') ? new Date(input.get('dueAt')).toISOString() : null : task?.dueAt || null };
          if (task) await this.editTask(task.id, value); else await this.addTask(value);
          break;
        }
        case 'expense': await this.spend(input.get('title'), input.get('amount')); break;
        case 'settings': await this.setAccount({ currency: input.get('currency').trim().toUpperCase(), pointValue: input.get('pointValue') }); break;
      }
    };

    const refreshTime = () => {
      if (this.gui.busy || !this.state || destroyed || !this.competition) return;
      for (const task of this.state.tasks) {
        if (!task.dueAt || task.completedAt) continue;
        const card = content.querySelector(`[data-task="${CSS.escape(task.id)}"]`);
        if (!card) continue;
        const target = this.model.competition(task);
        const bar = card.querySelector('[role="progressbar"]');
        bar?.setAttribute('aria-valuenow', String(Math.round(target)));
        if (bar) { bar.firstElementChild.style.width = `${target}%`; bar.nextElementSibling.textContent = `${Math.round(target)} %`; }
        const pace = card.querySelector('.pace');
        const difference = task.progress - target;
        if (pace) {
          pace.classList.toggle('ahead', difference >= 0);
          pace.textContent = Date.parse(task.dueAt) < Date.now() ? 'Ein nächster Schritt lohnt sich'
            : difference >= 0 ? `${Math.round(difference)} %-Pkt. voraus` : `${Math.round(-difference)} %-Pkt. bis zum Zeitplan`;
        }
      }
    };

    const celebrate = ({ task, awarded }) => {
      const layer = this.element.querySelector('.celebration-layer');
      clearTimeout(confettiTimer);
      const escaped = this.views.escape;
      layer.innerHTML = `<div class="achievement"><span class="achievement-check">${this.views.icon('check')}</span><div><strong>Yes! Das hast du geschafft.</strong><span>${escaped(task.title)}</span></div>${awarded ? `<b>+${this.views.number(awarded, this.locale)}<small>Punkte</small></b>` : ''}</div>${Array.from({ length: 18 }, (_, i) => `<i class="confetti" style="--i:${i};--x:${(i * 37 % 100) - 50};--color:${['#409b79', '#e4b865', '#c2d9ed', '#e9ae9d'][i % 4]}"></i>`).join('')}`;
      if (awarded) {
        notify(`Geschafft! ${task.title}. Plus ${awarded} Punkte.`);
        const balance = content.querySelector('[data-balance]');
        const points = content.querySelector('[data-point-balance]');
        balance?.classList.add('balance-pop');
        if (balance && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const end = this.model.balanceMinor(this.state);
          const begin = end - awarded * this.state.settings.pointValueMinor;
          const endPoints = this.model.pointUnits(this.state) / this.model.POINT_SCALE;
          const start = performance.now();
          const frame = now => {
            if (!balance.isConnected || destroyed) return;
            const fraction = Math.min(1, (now - start) / 850);
            const eased = 1 - (1 - fraction) ** 3;
            balance.textContent = this.views.money(Math.round(begin + (end - begin) * eased), this.state.settings.currency, this.locale);
            if (points) points.textContent = this.views.number(fraction === 1 ? endPoints : Math.floor(endPoints - awarded + awarded * eased), this.locale);
            if (fraction < 1) requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        }
      }
      confettiTimer = setTimeout(() => layer.replaceChildren(), 3000);
    };

    /** Stop timers/listeners; wait for an already accepted save to settle first. */
    this.destroy = async () => {
      destroyed = true;
      cancelStartup();
      sessionVersion++;
      if (connectedUser) connectedUser.extensions = [].concat(connectedUser.extensions || []).filter(extension => extension !== userChanged);
      clearAccount();
      try { await active; } catch { /* The caller of the mutation receives its error. */ }
      clearInterval(timer); clearTimeout(toastTimer); clearTimeout(confettiTimer);
      closeDialog();
      this.element.onclick = this.element.onsubmit = this.element.oninput = this.element.onchange = null;
      this.element.replaceChildren();
      this.state = null;
    };
  },
};

/** Pure domain logic. Money uses currency minor units; point balances use millionths. */
export const POINT_SCALE = 1_000_000;
const MAX_POINTS = 1_000_000;
const fail = message => { throw new Error(message); };
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const id = () => crypto.randomUUID();
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const text = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    fail('Bitte prüfe die Texteingabe.');
  return value.trim();
};

export function currencyDigits(currency) {
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) fail('Bitte gib einen dreistelligen Währungscode ein, z. B. EUR.');
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
}

/** Accept decimal input, including German decimal commas, without float arithmetic. */
export function parseMoney(value, currency) {
  const digits = currencyDigits(currency);
  const input = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(input)) fail('Bitte gib einen gültigen Betrag ein (z. B. 15,00).');
  const [whole, fraction = ''] = input.split('.');
  if (fraction.length > digits) fail(`Diese Währung erlaubt ${digits} Nachkommastellen.`);
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  if (!integer(minor, 1, 1_000_000_000)) fail('Der Betrag muss größer als null und kleiner als eine Milliarde Untereinheiten sein.');
  return minor;
}

export function validateSettings(settings) {
  if (!settings || !integer(settings.pointValueMinor, 1, 1000 * 10 ** currencyDigits(settings.currency)))
    fail('Ein Punkt muss mehr als 0 und höchstens 1.000 Währungseinheiten wert sein.');
  return settings;
}

export function createState(key, { currency = 'EUR', pointValue = 0.5 } = {}, tasks = [], now = new Date().toISOString()) {
  const state = { key: structuredClone(key), schema: 1, revision: 0, updatedAt: now,
    settings: validateSettings({ currency, pointValueMinor: parseMoney(pointValue, currency) }), tasks: [], transactions: [] };
  for (const task of tasks) addTask(state, task, now);
  return state;
}

function taskInput(input, previous, now) {
  const task = { id: previous?.id || id(), title: text(input.title, 180, true),
    notes: text(input.notes ?? '', 2000), points: input.points ?? 0,
    progress: input.progress ?? 0, startAt: input.startAt || previous?.startAt || now,
    dueAt: input.dueAt || null, createdAt: previous?.createdAt || now,
    completedAt: previous?.completedAt || null, rewardId: previous?.rewardId || null };
  if (!integer(task.points, 0, MAX_POINTS)) fail('Punkte müssen eine ganze Zahl zwischen 0 und 1.000.000 sein.');
  if (!integer(task.progress, 0, 100)) fail('Der Fortschritt muss zwischen 0 und 100 % liegen.');
  if (!timestamp(task.startAt) || (task.dueAt && (!timestamp(task.dueAt) || Date.parse(task.dueAt) <= Date.parse(task.startAt))))
    fail('Die Fälligkeit muss nach dem Start liegen.');
  if (previous?.completedAt) {
    task.progress = 100;
    task.points = previous.points;
  }
  return task;
}

export function addTask(state, input, now = new Date().toISOString()) {
  const task = taskInput(input, null, now);
  state.tasks.push(task);
  return task;
}

export function editTask(state, taskId, input, now = new Date().toISOString()) {
  const index = state.tasks.findIndex(task => task.id === taskId);
  if (index < 0) fail('Diese Aufgabe ist nicht mehr vorhanden.');
  state.tasks[index] = taskInput(input, state.tasks[index], now);
  return state.tasks[index];
}

export function pointUnits(state) {
  return state.transactions.reduce((sum, entry) => sum + entry.pointUnits, 0);
}

export function balanceMinor(state) {
  return Math.round(pointUnits(state) / POINT_SCALE * state.settings.pointValueMinor);
}

export function earnedPoints(state) {
  return state.transactions.filter(entry => entry.kind === 'income' || entry.kind === 'reversal')
    .reduce((sum, entry) => sum + entry.pointUnits, 0) / POINT_SCALE;
}

function book(state, entry, now) {
  const result = { id: id(), at: now, currency: state.settings.currency,
    pointValueMinor: state.settings.pointValueMinor, ...entry };
  state.transactions.push(result);
  return result;
}

/** Idempotent completion: repeated true/false calls never mint duplicate rewards. */
export function completeTask(state, taskId, done, pointsEnabled, now = new Date().toISOString()) {
  const task = state.tasks.find(task => task.id === taskId);
  if (!task) fail('Diese Aufgabe ist nicht mehr vorhanden.');
  if (Boolean(task.completedAt) === done) return { task, awarded: 0, changed: false };
  let awarded = 0;
  if (done) {
    task.previousProgress = task.progress;
    task.progress = 100;
    task.completedAt = now;
    if (pointsEnabled && task.points > 0) {
      if (pointUnits(state) + task.points * POINT_SCALE > 1_000_000_000_000_000)
        fail('Das maximale Punkteguthaben ist erreicht.');
      const entry = book(state, { kind: 'income', title: task.title, taskId: task.id,
        pointUnits: task.points * POINT_SCALE, amountMinor: task.points * state.settings.pointValueMinor }, now);
      task.rewardId = entry.id;
      awarded = task.points;
    }
  } else {
    if (task.rewardId) {
      const income = state.transactions.find(entry => entry.id === task.rewardId);
      if (!income) fail('Die ursprüngliche Punktebuchung fehlt.');
      if (pointUnits(state) < income.pointUnits)
        fail('Diese Punkte wurden bereits ausgegeben. Storniere zuerst die entsprechende Ausgabe im Kontoauszug.');
      book(state, { kind: 'reversal', title: `Wieder geöffnet: ${task.title}`, taskId: task.id,
        reverses: income.id, pointUnits: -income.pointUnits, amountMinor: -income.amountMinor,
        currency: income.currency, pointValueMinor: income.pointValueMinor }, now);
    }
    task.rewardId = null;
    task.completedAt = null;
    task.progress = task.previousProgress ?? 0;
    delete task.previousProgress;
  }
  return { task, awarded, changed: true };
}

export function spend(state, title, amountMinor, now = new Date().toISOString()) {
  title = text(title, 180, true);
  if (!integer(amountMinor, 1, 1_000_000_000)) fail('Bitte gib einen gültigen positiven Betrag ein.');
  const available = balanceMinor(state);
  if (amountMinor > available) fail('Dafür reicht dein Guthaben noch nicht.');
  // A full redemption consumes the exact remaining balance, including rounding dust.
  const units = amountMinor === available ? pointUnits(state)
    : Math.round(amountMinor / state.settings.pointValueMinor * POINT_SCALE);
  if (units <= 0 || units > pointUnits(state)) fail('Dafür reicht dein Guthaben noch nicht.');
  return book(state, { kind: 'expense', title, pointUnits: -units, amountMinor: -amountMinor }, now);
}

export function refund(state, entryId, now = new Date().toISOString()) {
  const entry = state.transactions.find(entry => entry.id === entryId && entry.kind === 'expense');
  if (!entry) fail('Diese Ausgabe wurde nicht gefunden.');
  if (state.transactions.some(item => item.reverses === entryId)) fail('Diese Ausgabe wurde bereits storniert.');
  return book(state, { kind: 'refund', title: `Storno: ${entry.title}`, reverses: entryId,
    pointUnits: -entry.pointUnits, amountMinor: -entry.amountMinor,
    currency: entry.currency, pointValueMinor: entry.pointValueMinor }, now);
}

export function competition(task, now = Date.now()) {
  if (!task.dueAt) return null;
  return Math.max(0, Math.min(100, (now - Date.parse(task.startAt)) / (Date.parse(task.dueAt) - Date.parse(task.startAt)) * 100));
}

/** Fail closed on unsupported/corrupt data; never replace it with an empty account. */
export function validateState(state, key) {
  const sameKey = (a, b) => Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((part, i) => typeof part === 'string' && part === b[i]) : typeof a === 'string' && a === b;
  if (!state || !sameKey(state.key, key) || state.schema !== 1 || !integer(state.revision, 0, Number.MAX_SAFE_INTEGER)
    || !Array.isArray(state.tasks) || !Array.isArray(state.transactions)) fail('Der gespeicherte Datensatz hat ein nicht unterstütztes Format.');
  validateSettings(state.settings);
  const taskIds = new Set();
  const transactionIds = new Set();
  for (const task of state.tasks) {
    if (typeof task.id !== 'string' || taskIds.has(task.id)) fail('Ungültige Aufgaben-IDs.');
    taskIds.add(task.id);
    taskInput(task, task, state.updatedAt);
    if (!integer(task.progress, 0, 100) || (task.completedAt && (!timestamp(task.completedAt) || task.progress !== 100)))
      fail('Ungültiger Aufgabenfortschritt.');
  }
  for (const entry of state.transactions) {
    if (!entry || typeof entry.id !== 'string' || transactionIds.has(entry.id) || !timestamp(entry.at)
      || !['income', 'expense', 'reversal', 'refund'].includes(entry.kind)
      || !integer(entry.pointUnits, -1_000_000_000_000_000, 1_000_000_000_000_000)
      || !Number.isSafeInteger(entry.amountMinor) || entry.pointUnits === 0 || entry.amountMinor === 0)
      fail('Der Kontoauszug enthält eine ungültige Buchung.');
    text(entry.title, 220, true);
    validateSettings(entry);
    const positive = entry.kind === 'income' || entry.kind === 'refund';
    if ((entry.pointUnits > 0) !== positive || (entry.amountMinor > 0) !== positive) fail('Ungültiges Buchungsvorzeichen.');
    transactionIds.add(entry.id);
  }
  const reversed = new Set();
  for (const entry of state.transactions) {
    if (entry.kind !== 'refund' && entry.kind !== 'reversal') continue;
    const original = state.transactions.find(item => item.id === entry.reverses);
    if (!original || reversed.has(original.id) || original.kind !== (entry.kind === 'refund' ? 'expense' : 'income')
      || original.pointUnits !== -entry.pointUnits || original.amountMinor !== -entry.amountMinor
      || original.currency !== entry.currency || original.pointValueMinor !== entry.pointValueMinor)
      fail('Ungültige Stornobuchung.');
    reversed.add(original.id);
  }
  for (const task of state.tasks) {
    if (!task.rewardId) continue;
    const reward = state.transactions.find(entry => entry.id === task.rewardId);
    if (!task.completedAt || !reward || reward.kind !== 'income' || reward.taskId !== task.id || reversed.has(reward.id))
      fail('Eine Aufgabenbelohnung ist ungültig.');
  }
  if (!integer(pointUnits(state), 0, 1_000_000_000_000_000)) fail('Das Punkteguthaben ist ungültig.');
  return state;
}

/** Internal, immutable facade for instance actions and configurable views. */
const model = Object.freeze({
  POINT_SCALE, currencyDigits, parseMoney, validateSettings, createState, addTask, editTask, pointUnits, balanceMinor, earnedPoints, completeTask, spend, refund, competition, validateState
});
