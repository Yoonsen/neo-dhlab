import React, { useEffect, useRef } from 'react';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  onTryQuery?: (q: string) => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({
  open,
  onClose,
  onTryQuery,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const tryExample = (q: string) => {
    if (onTryQuery) {
      onTryQuery(q);
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="corpus-modal help-modal"
      aria-label="Om Korpusmotoren og søkesyntaks"
      onClose={onClose}
    >
      <div className="modal-header">
        <h2>Om DHLAB Korpusmotor</h2>
        <button
          type="button"
          className="btn-icon"
          aria-label="Lukk hjelp"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="help-content">
        <p>
          Korpusmotoren søker i hele Nasjonalbibliotekets digitaliserte boksamling (
          <strong>713 913 bøker</strong> og <strong>38,5 milliarder ord</strong>). Alle
          tellinger og trender beregnes eksakt uten utvalg ved hjelp av Roaring-bitmaps og
          arena-indekser.
        </p>

        <section className="help-section">
          <h3>1. Bygge og bruke korpus («korpus i lomma»)</h3>
          <p>
            Som standard søker du i hele boksamlingen. Klikk på{' '}
            <strong>«Definer korpus…»</strong> øverst for å avgrense hvilke bøker det
            søkes i:
          </p>
          <ul>
            <li>
              <strong>Fra fil (.xlsx eller .csv):</strong> Last opp et regneark med en
              kolonne kalt <code>dhlabid</code> eller <code>urn</code> (
              <code>URN:NBN:no-nb_...</code>).
            </li>
            <li>
              <strong>Fra katalogmetadata:</strong> Filtrer på utgivelsesår, språk,
              litterær form, forfatter eller emneord.
            </li>
            <li>
              <strong>Fra søkeuttrykk i teksten:</strong> Velg alle bøker som inneholder et
              ord, et nærhetssøk eller en frase (kan også kjedes med <code>AND</code>).
            </li>
          </ul>
          <p>
            Korpuset komprimeres til et bærbart Roaring-bitmap (<code>corpusToken</code>)
            og lagres automatisk i nettleseren under <strong>«Mine korpus ▾»</strong>. Jo
            mindre korpuset er, desto raskere går søket.
          </p>
        </section>

        <section className="help-section">
          <h3>2. Søkesyntaks (klikk på et eksempel for å prøve)</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th scope="col">Type søk</th>
                  <th scope="col">Syntaks</th>
                  <th scope="col">Hva som telles (`countMode`)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Enkeltord</th>
                  <td>
                    <button
                      type="button"
                      className="btn-link-inline"
                      onClick={() => tryExample('demokrati')}
                    >
                      <code>demokrati</code>
                    </button>
                  </td>
                  <td>Totalt antall forekomster av ordet (<code>tf</code>).</td>
                </tr>
                <tr>
                  <th scope="row">Ordpar i nærhet</th>
                  <td>
                    <button
                      type="button"
                      className="btn-link-inline"
                      onClick={() => tryExample('demokrati diktatur')}
                    >
                      <code>demokrati diktatur</code>
                    </button>
                  </td>
                  <td>
                    Alle par innenfor vinduet <em>W</em>, symmetrisk (<code>pairs</code>).
                  </td>
                </tr>
                <tr>
                  <th scope="row">Anker (<code>^ord</code>)</th>
                  <td>
                    <button
                      type="button"
                      className="btn-link-inline"
                      onClick={() => tryExample('demokrati ^diktatur')}
                    >
                      <code>demokrati ^diktatur</code>
                    </button>
                  </td>
                  <td>
                    Forekomster av <code>diktatur</code> med <code>demokrati</code>{' '}
                    innenfor <em>W</em> ord (<code>anchor</code>).
                  </td>
                </tr>
                <tr>
                  <th scope="row">3+ ord i nærhet</th>
                  <td>
                    <button
                      type="button"
                      className="btn-link-inline"
                      onClick={() => tryExample('krig fred Europa')}
                    >
                      <code>krig fred Europa</code>
                    </button>
                  </td>
                  <td>
                    Ikke-overlappende minimale spenn ≤ <em>W</em> ord der alle ordene står
                    sammen (<code>spans</code>).
                  </td>
                </tr>
                <tr>
                  <th scope="row">Eksakt frase</th>
                  <td>
                    <button
                      type="button"
                      className="btn-link-inline"
                      onClick={() => tryExample('"i forhold til"')}
                    >
                      <code>"i forhold til"</code>
                    </button>
                  </td>
                  <td>Ordene rett etter hverandre i rekkefølge (<code>sequence</code>).</td>
                </tr>
                <tr>
                  <th scope="row">Sammenlign flere (komma)</th>
                  <td>
                    <button
                      type="button"
                      className="btn-link-inline"
                      onClick={() => tryExample('demokrati, diktatur')}
                    >
                      <code>demokrati, diktatur</code>
                    </button>
                  </td>
                  <td>
                    Kjører uttrykkene etter hverandre og viser dem i tabell eller som
                    flere trendkurver.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Wildcard og OR-grupper</th>
                  <td>
                    <button
                      type="button"
                      className="btn-link-inline"
                      onClick={() => tryExample('(skib OR skip) storm')}
                    >
                      <code>(skib OR skip) storm</code>
                    </button>
                  </td>
                  <td>
                    Union av ordvarianter per gruppe (støtter også <code>demokrati*</code>{' '}
                    og <code>skib+skip</code>).
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="help-section">
          <h3>3. FTS5- og Elastic-syntaks</h3>
          <p>
            Søkemotoren forstår også eldre FTS5-uttrykk (fra notebooks) og
            Elastic-nærhet (fra Nettbiblioteket). Dialekter kan ikke blandes i samme søk:
          </p>
          <ul>
            <li>
              <strong>FTS5 <code>NEAR</code>:</strong>{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() => tryExample('NEAR(skib storm, 10)')}
              >
                <code>NEAR(skib storm, 10)</code>
              </button>{' '}
              (symmetrisk),{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() => tryExample('NEAR(skib storm, +10)')}
              >
                <code>NEAR(skib storm, +10)</code>
              </button>{' '}
              eller <code>NEAR(skib storm, 10, asym)</code> (ordnet <em>A → B</em>), og{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() => tryExample('NEAR(skib ^storm, 10)')}
              >
                <code>NEAR(skib ^storm, 10)</code>
              </button>{' '}
              (med anker).
            </li>
            <li>
              <strong>Kjedet <code>AND</code> på boknivå:</strong>{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() =>
                  tryExample('NEAR(skib storm, 5) AND NEAR(hav vind, 10)')
                }
              >
                <code>NEAR(skib storm, 5) AND NEAR(hav vind, 10)</code>
              </button>{' '}
              snitter bøkene som inneholder begge uttrykkene (sett <code>^</code> på det
              leddet du vil telle/vise konkordans for).
            </li>
            <li>
              <strong>Elastic / Nettbiblioteket:</strong>{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() => tryExample('"demokrati diktatur"~10')}
              >
                <code>"demokrati diktatur"~10</code>
              </button>{' '}
              eller <code>demokrati NEAR/10 diktatur</code>.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>4. Måltall i Trender og Telling</h3>
          <ul>
            <li>
              <strong>Per million ord (ppm):</strong> Relativ frekvens i korpuset (
              <code>(treff / tokens) × 1 000 000</code>).
            </li>
            <li>
              <strong>Kohort (%):</strong> Hver kurves andel av kurvegruppens samlede
              frekvens hvert år (summerer til 100 %).
            </li>
            <li>
              <strong>Dekning (andel bøker %):</strong> Prosentandel av bøkene i korpuset (
              <code>docs / books</code>) som inneholder uttrykket.
            </li>
            <li>
              <strong>Intensitet (treff/bok):</strong> Gjennomsnittlig antall treff per bok
              blant bøkene der uttrykket faktisk forekommer (<code>total / docs</code>).
            </li>
          </ul>
          <p className="muted" style={{ fontSize: '0.82rem', marginBlockEnd: 0 }}>
            Konkordansvisningen følger Nasjonalbibliotekets rammer for opphavsrett: maks 25
            ord per utdrag (klippet ved avsnitt), maks 200 linjer og maks 10 % av hver bok.
          </p>
        </section>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-primary" onClick={onClose}>
          Lukk
        </button>
      </div>
    </dialog>
  );
};
