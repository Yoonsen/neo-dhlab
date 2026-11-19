import React, { useEffect, useRef } from 'react';
import { UiStrings } from '../i18n';

interface HelpDialogProps {
  open: boolean;
  t: UiStrings;
  onClose: () => void;
  onTryQuery?: (q: string) => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({
  open,
  t,
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
      aria-label={t.helpTitle}
      onClose={onClose}
    >
      <div className="modal-header">
        <h2>{t.helpTitle}</h2>
        <button
          type="button"
          className="btn-icon"
          aria-label={t.closeBtn}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="help-content">
        <p>{t.helpIntro}</p>

        <section className="help-section">
          <h3>{t.helpSec1Title}</h3>
          <p>{t.helpSec1Desc}</p>
        </section>

        <section className="help-section">
          <h3>{t.helpSec2Title}</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.colCountMode}</th>
                  <th scope="col">{t.colExpression}</th>
                  <th scope="col">Payload / countMode</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Single (tf)</th>
                  <td>
                    <button
                      type="button"
                      className="btn-link-inline"
                      onClick={() => tryExample('demokrati')}
                    >
                      <code>demokrati</code>
                    </button>
                  </td>
                  <td>
                    <code>countMode: "tf"</code>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Pairs (W)</th>
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
                    <code>countMode: "pairs"</code>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Anchor (<code>^</code>)</th>
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
                    <code>countMode: "anchor"</code>
                  </td>
                </tr>
                <tr>
                  <th scope="row">3+ Spans</th>
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
                    <code>countMode: "spans"</code>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Phrase</th>
                  <td>
                    <button
                      type="button"
                      className="btn-link-inline"
                      onClick={() => tryExample('"i forhold til"')}
                    >
                      <code>"i forhold til"</code>
                    </button>
                  </td>
                  <td>
                    <code>countMode: "sequence"</code>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Multi (<code>,</code>)</th>
                  <td>
                    <button
                      type="button"
                      className="btn-link-inline"
                      onClick={() => tryExample('demokrati, diktatur')}
                    >
                      <code>demokrati, diktatur</code>
                    </button>
                  </td>
                  <td>Sequential multi-query</td>
                </tr>
                <tr>
                  <th scope="row">OR / Wildcard</th>
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
                    <code>termGroups</code> / <code>demokrati*</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="help-section">
          <h3>{t.helpSec3Title}</h3>
          <p>{t.helpSec3Desc}</p>
          <ul>
            <li>
              <strong>
                <code>WHERE</code> / <code>{'{ x | P(x) }'}</code>:
              </strong>{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() =>
                  tryExample('demokrati WHERE NEAR(demokrati diktatur, 10)')
                }
              >
                <code>demokrati WHERE NEAR(demokrati diktatur, 10)</code>
              </button>
              ,{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() =>
                  tryExample(
                    'demokrati WHERE NEAR(demokrati diktatur krig, 10)'
                  )
                }
              >
                <code>demokrati WHERE NEAR(demokrati diktatur krig, 10)</code>
              </button>
              ,{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() =>
                  tryExample('{demokrati | NEAR(demokrati diktatur, 10) AND krig}')
                }
              >
                <code>{'{demokrati | NEAR(demokrati diktatur, 10) AND krig}'}</code>
              </button>
            </li>
            <li>
              <strong>FTS5 <code>NEAR</code>:</strong>{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() => tryExample('NEAR(skib storm, 10)')}
              >
                <code>NEAR(skib storm, 10)</code>
              </button>
              ,{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() => tryExample('NEAR(skib storm, +10)')}
              >
                <code>NEAR(skib storm, +10)</code>
              </button>{' '}
              (<em>A → B</em>),{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() => tryExample('NEAR(skib ^storm, 10)')}
              >
                <code>NEAR(skib ^storm, 10)</code>
              </button>
            </li>
            <li>
              <strong>
                <code>AND</code>:
              </strong>{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() =>
                  tryExample('NEAR(skib storm, 5) AND NEAR(hav vind, 10)')
                }
              >
                <code>NEAR(skib storm, 5) AND NEAR(hav vind, 10)</code>
              </button>
            </li>
            <li>
              <strong>Elastic:</strong>{' '}
              <button
                type="button"
                className="btn-link-inline"
                onClick={() => tryExample('"demokrati diktatur"~10')}
              >
                <code>"demokrati diktatur"~10</code>
              </button>{' '}
              / <code>demokrati NEAR/10 diktatur</code>
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>{t.helpSec4Title}</h3>
          <ul>
            <li>
              <strong>{t.metricPpm}:</strong>{' '}
              <code>(total / tokens) × 1,000,000</code>
            </li>
            <li>
              <strong>{t.metricCohort}:</strong>{' '}
              <code>f_i(y) / Σ f_j(y) × 100%</code>
            </li>
            <li>
              <strong>{t.metricCoverage}:</strong>{' '}
              <code>docs / books × 100%</code>
            </li>
            <li>
              <strong>{t.metricIntensity}:</strong> <code>total / docs</code>
            </li>
          </ul>
          <p className="muted" style={{ fontSize: '0.82rem', marginBlockEnd: 0 }}>
            {t.helpCopyright}
          </p>
        </section>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-primary" onClick={onClose}>
          {t.closeBtn}
        </button>
      </div>
    </dialog>
  );
};
