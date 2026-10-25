# CCM ToDo · Momentum

Eine motivierende ToDo-Webkomponente für **ccmjs 28**. Ohne Build-Schritt, ohne externe UI-, Font- oder Icon-Dienste. Die deutsche Oberfläche passt sich an Desktop und Smartphone an und wird von CCM im Shadow DOM gekapselt.

## Ausprobieren

```sh
node test/serve.mjs
```

Anschließend **http://localhost:8080** öffnen. Alternativ das Repository mit einem beliebigen HTTP-Server bereitstellen. `index.html` enthält eine Demo mit drei Beispielaufgaben und einem eigenen persistenten CCM-Datastore (`todo_demo`). Die eigentliche Komponente startet standardmäßig mit einer leeren Liste.

## Einbetten

```html
<div id="todo"></div>
<script src="./libs/framework/ccm-28.0.0.min.js"></script>
<script type="module">
  const app = await ccm.start('./ccm.todo.mjs', {
    competition: true,
    points: true,
    account: { pointValue: 0.50, currency: 'EUR' },
    data: {
      store: ['ccm.store', { name: 'my_todos' }],
      key: 'my_list'
    }
  }, document.querySelector('#todo'));
</script>
```

Auch die deklarative CCM-Webkomponente ist möglich:

```html
<ccm-app component="./ccm.todo.mjs"
  config='{"competition":true,"points":true}'></ccm-app>
```

CCM muss zuvor geladen sein. Die Ressourcenpfade mit `././` entsprechen der Konvention der übrigen Komponenten und sind für die Release-Pipeline vorgesehen. Lokal ohne Build liegt `ccm.todo.mjs` neben `index.html`; bei Einbettung von einem anderen Basispfad die Ressourcen per absoluter URL konfigurieren bzw. eine durch die Release-Pipeline aufgelöste Fassung verwenden.

## Motivationsmodi

| Modus | Konfiguration | Verhalten |
| --- | --- | --- |
| Abarbeiter | Immer aktiv | Aufgaben anlegen, bearbeiten, abhaken, wieder öffnen und löschen; Suche und Filter; animiertes Häkchen, Konfetti und Erfolgsmeldung. |
| Konkurrenzdenker | `competition: true` | Startzeit, optionale Fälligkeit, eigener Fortschritt und linear wachsender Zeitplan-Balken. |
| Punktesammler | `points: true` | Punkte pro Aufgabe, sichtbare Punkte- und Geldbilanz, animiertes Guthaben, Belohnungen und Kontoauszug. |

Die beiden optionalen Modi sind unabhängig. `false` blendet die jeweiligen Bereiche und Eingabefelder aus. Vorhandene Daten bleiben erhalten. Abgeschlossene Aufgaben erhalten beim späteren Einschalten des Punktesammlers keine nachträglichen Punkte. Beim Wiederöffnen einer zuvor belohnten Aufgabe wird deren Gutschrift auch bei inzwischen deaktiviertem Punktesammler korrekt zurückgebucht.

### Konkurrenzbalken

```text
Zeitplan (%) = clamp((jetzt − Startzeit) / (Fälligkeit − Startzeit) × 100, 0, 100)
```

Bei exakt 14 Tagen Laufzeit steht der Balken nach 7 Tagen bei 50 %. Vor dem Start bleibt er bei 0 %, nach Fälligkeit bei 100 %. Ein laufender Vergleich aktualisiert sich jede Minute. Der Startzeitpunkt wird separat gespeichert und beim Ändern des Fortschritts nicht zurückgesetzt. Zeiten werden als ISO-Zeitstempel gespeichert und lokal dargestellt; Eingaben erfolgen in der lokalen Zeitzone.

Der eigene Fortschritt lässt sich direkt am Balken oder im Aufgabenformular ändern. **100 % allein schließt die Aufgabe noch nicht ab**: Erst der Haken löst den Abschluss und die Punktegutschrift aus. Eine Aufgabe ohne Fälligkeit hat nur den eigenen Fortschrittsbalken.

### Punkte und Belohnungen

- Beispiel: 30 verdiente Punkte × 0,50 EUR = 15,00 EUR verfügbares Guthaben.
- Eine Belohnung „Kino, 15,00 EUR“ bucht bei diesem Kurs 30 Punkte ab. Teilbeträge können anteilige Punkte verbrauchen; der Kontoauszug zeigt auch diese Abbuchung.
- Der aktuelle Kontostand ist **verfügbare Punkte × aktueller Punktewert**. Der Konto-Bereich zeigt zusätzlich die insgesamt verdienten Punkte nach Rückbuchungen.
- Punktewert und Währung sind in den Einstellungen änderbar. Eine Änderung bewertet nur die verfügbaren Punkte neu. Historische Buchungen behalten Betrag, Währung und Punktewert zum Buchungszeitpunkt. Eine Änderung des Währungscodes führt keine Wechselkursumrechnung durch.
- Geldbeträge werden in kleinsten Währungseinheiten gespeichert (z. B. Cent), Punkte in Millionsteln. Die Anzeige verwendet bis zu vier Nachkommastellen für Punkte. Der Punktewert liegt zwischen einer kleinsten Währungseinheit und 1.000 Währungseinheiten; Aufgaben belohnen mit 0 bis 1.000.000 ganzen Punkten.
- Währungen mit abweichenden Nachkommastellen, z. B. JPY oder KWD, werden berücksichtigt. Dezimalkomma und Dezimalpunkt sind als Eingabe möglich; keine Tausendertrennzeichen.
- Mehrfaches Abhaken schreibt keine zusätzlichen Punkte gut. Wiederöffnen erzeugt eine Gegenbuchung und stellt den vorherigen Fortschritt wieder her. Sind die Punkte bereits ausgegeben, muss zuerst eine entsprechende Ausgabe storniert werden.
- Ausgaben dürfen den Kontostand nicht überschreiten. Ihr Storno erstattet die ursprünglich verbrauchten Punkte genau einmal. Stornos bleiben als eigene Buchungen sichtbar.
- Löschen einer Aufgabe löscht keine bereits erfolgten Buchungen. Die Punktezahl einer erledigten Aufgabe ist nicht nachträglich editierbar.

## Konfiguration

| Eigenschaft | Standard | Bedeutung |
| --- | --- | --- |
| `title` | `"Momentum"` | Name im Kopfbereich. |
| `competition` | `true` | Zeitvergleich aktivieren. |
| `points` | `true` | Punktekonto aktivieren. |
| `defaultPoints` | `10` | Vorgabe für neue Aufgaben im Formular. |
| `account` | `{ pointValue: 0.5, currency: 'EUR' }` | Initiale Kontoeinstellungen; gespeicherte Einstellungen haben Vorrang. |
| `locale` | `"de-DE"` | Zahlen-, Währungs- und Datumsformatierung; Oberflächentexte sind deutsch. |
| `user` | nicht gesetzt | Optionale CCM-User-Instanz. Aktiviert persönliche Datensätze und zeigt Anmeldung/Profil an. |
| `data.store` | `['ccm.store', { name: 'todo' }]` | Beliebiger kompatibler CCM-Datastore. |
| `data.key` | `"my_todos"` | Gültiger CCM-Datensatzschlüssel, Kleinbuchstabe am Anfang, danach Kleinbuchstaben, Ziffern und Unterstriche; maximal 32 Zeichen. |
| `data._` | ohne User: nicht gesetzt; mit User: Eigentümerrechte | CCM-Rechte für einen neuen Datensatz; vorhandene Rechte werden beibehalten. |
| `ignore.tasks` | `[]` | Optionale Startaufgaben; nur wenn noch kein Datensatz existiert. |
| `onchange` | nicht gesetzt | Optionaler asynchroner Callback `({ app, type, value })` nach erfolgreichem Speichern. |
| `css`, `views` | lokale CCM-Abhängigkeiten | Anpassbare Styles und Ansichten. |

Beispiel für eine Startaufgabe:

```js
ignore: {
  tasks: [{
    title: 'Kapitel 3 durcharbeiten',
    notes: 'Die wichtigsten Gedanken notieren.',
    points: 30,
    progress: 25,
    startAt: '2026-10-01T12:00:00.000Z',
    dueAt: '2026-10-15T12:00:00.000Z'
  }]
}
```

`title` ist Pflicht; alle anderen Felder sind optional. Neue Startaufgaben sind offen. Initiale Aufgaben und Kontoeinstellungen werden mit der ersten Änderung gespeichert.

## Speicherung

Aufgaben, Kontoeinstellungen und Buchungen liegen gemeinsam in **einem Datensatz** unter `data.key` (ohne User) bzw. `[data.key, realm, userKey]` (mit User). Abschluss und Punktegutschrift werden damit in einem `store.set()` geschrieben. Ein Wechsel des Datastores benötigt keine Anpassung der Komponentenlogik:

```js
// Flüchtig im Arbeitsspeicher:
data: { store: ['ccm.store', {}], key: 'example_list' }

// Im Browser persistent (IndexedDB):
data: { store: ['ccm.store', { name: 'todo' }], key: 'my_list' }

// Auf einem CCM-Server:
data: {
  store: ['ccm.store', { name: 'todo', url: 'https://example.com/api' }],
  key: 'learner_123'
}
```

### Optionale User-Komponente

```js
await ccm.start('./ccm.todo.mjs', {
  user: ['ccm.instance', '././libs/user/ccm.user-1.0.0.min.mjs', {
    url: 'https://example.com/api',
    realm: 'ccm',
    autoLogin: false
  }],
  data: {
    store: ['ccm.store', { name: 'todo', url: 'https://example.com/api' }],
    key: 'learning_tasks'
  }
}, document.querySelector('#todo'));
```

Die mitgelieferte User-Version lädt ihre eigenen UI-Ressourcen von ihren versionierten CDN-Adressen, wie bei den übrigen CCM-Komponenten. Es kann auch eine andere kompatible User-Instanz übergeben werden. Erwartet werden `host`, `start()`, `login()`, `logout()`, `isLoggedIn()`, `getState()`, `getToken()` und die CCM-User-`extensions`-Ereignisse `login`, `register`, `logout` und `deleteAccount`. Bestehende Extensions bleiben erhalten; die ToDo-Extension wird bei `destroy()` wieder entfernt.

Mit `user` werden Aufgaben und Konto erst nach der Anmeldung geladen. Ohne Anmeldung erscheint nur ein Hinweis mit der eingebetteten User-Oberfläche. `autoLogin: true` öffnet beim ersten Start unmittelbar deren Anmeldedialog; ein Abbruch liest oder erzeugt keinen anonymen Datensatz. Ohne `user` bzw. mit `user: false` bleibt die bisherige Nutzung ohne Anmeldung erhalten.

Für die Identität `{ realm: 'ccm', key: 'alice', user: 'Alice' }` lautet der effektive Schlüssel `['learning_tasks', 'ccm', 'alice']`. Verwendet wird die stabile Benutzer-ID, nicht der Anzeigename. Aufgaben, Punkte, Einstellungen und Kontoauszug sind je Liste, Realm und Benutzer getrennt; `realm` und `user` stehen zusätzlich als abfragbare Felder im Datensatz. Tokens und Passwörter werden nicht darin gespeichert. Vorhandene anonyme Listen werden nicht automatisch einem Benutzer zugeordnet.

Abmelden entfernt den sichtbaren Kontostand und alle Aufgabendaten sofort. Beim Benutzerwechsel wird das passende Konto neu geladen. Noch laufende Antworten dürfen den Zustand des neuen Benutzers nicht überschreiben. Ein bereits abgeschickter Speichervorgang kann für sein ursprüngliches Konto noch abschließen. Ein CCM-Server-Accessor wird pro Identität mit der User-Anmeldung verbunden; bei automatischer erneuter Anmeldung darf eine alte Anfrage nicht mit dem Token eines anderen Kontos wiederholt werden. Der ursprünglich übergebene Datastore wird dabei nicht verändert.

Neue persönliche Datensätze erhalten standardmäßig `_: { access: { get: 'owner', set: 'owner', del: 'owner' } }`. Der CCM-Server setzt und prüft den Eigentümer anhand des Tokens. Mit `data._` können explizit andere Rechte für neue Datensätze vorgegeben werden; bei bestehenden Datensätzen bleiben die serverseitigen Rechte erhalten. IndexedDB und InMemoryStore trennen die Konten nach Schlüssel, erzwingen jedoch keine serverseitige Zugriffskontrolle. Für Zugriffe über mehrere Geräte einen entsprechend konfigurierten CCM-Server verwenden.

Die Oberfläche bestätigt Änderungen erst nach erfolgreichem Speichern. Bei Fehlern bleiben Zustand und Formulareingaben erhalten. Lesefehler oder unbekannte Datenformate überschreiben keine vorhandenen Daten mit einer leeren Liste. Jeder Schreibvorgang prüft die geladene Revision; veraltete Ansichten fordern zum Neuladen auf. Kooperierende Tabs derselben Origin werden zusätzlich über Web Locks serialisiert.

**Grenze der portablen Datastore-API:** Gleichzeitige Schreibzugriffe von unterschiedlichen Geräten sind ohne atomare Vergleichsoperation auf dem Server nicht vollständig konfliktfrei. Diese Version ist für ein persönlich geführtes Konto gedacht; sie implementiert keine Echtzeit-Zusammenarbeit. Für verbindliche Mehrgeräte-Transaktionen muss der Server atomare Revisionsprüfungen und Rechte erzwingen. Das Belohnungskonto ist ein persönliches Motivationskonto, keine Zahlungsabwicklung.

## Instanz-API

Alle Änderungen liefern Promises, validieren Eingaben und speichern vor der sichtbaren Bestätigung:

```js
await app.start();                       // Neu aus dem konfigurierten Datastore laden
const snapshot = app.getValue();         // Unabhängige Kopie, keine DOM-Referenzen
const task = await app.addTask({ title: 'Üben', points: 10 });
await app.editTask(task.id, { ...task, notes: 'Teil 1 und 2' });
await app.setProgress(task.id, 50);
await app.completeTask(task.id);         // Abschluss inkl. Belohnung, sofern aktiviert
await app.completeTask(task.id, false);  // Wieder öffnen und ggf. Punkte zurückbuchen
await app.spend('Kaffee', '2,50');         // Betrag in aktueller Währung
await app.refund(expenseId);             // Ursprüngliche Punkte einer Ausgabe erstatten
await app.setAccount({ currency: 'EUR', pointValue: '0,50' });
await app.deleteTask(task.id);           // Kontoauszug bleibt erhalten
await app.destroy();                    // Timer und Ereignisbehandlung aufräumen
```

Während eines laufenden Vorgangs werden weitere Aktionen ignoriert (Promise mit `undefined`). Programmatische Aufrufer müssen Änderungen daher nacheinander `await`en. `onchange` läuft innerhalb dieser Sperre; von dort keine weiteren Änderungen oder `destroy()` aufrufen. Callback-Fehler melden sich separat, ohne erfolgreich gespeicherte Buchungen zurückzunehmen. Nach `destroy()` eine neue CCM-Instanz erstellen.

Entwicklungs- und Prüfanleitung: [test/README.md](test/README.md).

## Dateien

Die Fachregeln für Aufgaben, Zeitvergleich, Punkte und Buchungen sind direkt in `ccm.todo.mjs` integriert. Sie bleiben als reine Funktionen von DOM und Datastore unabhängig. Die Instanz stellt sie den konfigurierbaren Ansichten über das unveränderliche `app.model` bereit; ein austauschbarer `model`-Konfigurationswert ist nicht vorgesehen.

- `ccm.todo.mjs`: CCM-Konfiguration, Lifecycle, Interaktion, Persistenz, Animationen und integrierte Fachlogik.
- `resources/views.mjs`: Escapte Ansichten und Formulare.
- `resources/styles.css`: Responsive Gestaltung und Animationen, inklusive `prefers-reduced-motion`.
- `resources/configs.mjs`: Beispielkonfigurationen für alle Moduskombinationen.
- `libs/framework/`: Lokal gebündeltes CCM 28.0.0 mit Lizenz und Source Map.
- `libs/user/`: Optionale User-Komponente 1.0.0 mit Lizenz und Source Map.

MIT-Lizenz, siehe [LICENSE](LICENSE).
