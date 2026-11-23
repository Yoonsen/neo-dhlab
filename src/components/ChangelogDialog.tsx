import React, { useEffect, useRef } from 'react';
import { CHANGELOG_RELEASES, CURRENT_BUILD_ID } from '../changelog';
import { UiLang, UiStrings } from '../i18n';

interface ChangelogDialogProps {
  open: boolean;
  lang: UiLang;
  t: UiStrings;
  updateAvailable: boolean;
  onReloadForUpdate: () => void;
  onClose: () => void;
}

export const ChangelogDialog: React.FC<ChangelogDialogProps> = ({
  open,
  lang,
  t,
  updateAvailable,
  onReloadForUpdate,
  onClose,
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

  return (
    <dialog
      ref={dialogRef}
      className="corpus-modal help-modal"
      aria-label={t.whatsNewTitle}
      onClose={onClose}
    >
      <div className="modal-header">
        <h2>{t.whatsNewTitle}</h2>
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
        {updateAvailable && (
          <div className="info-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <span>
              {lang === 'no'
                ? 'En nyere versjon av appen er rullet ut på serveren.'
                : 'A newer version of the application has been deployed.'}
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={onReloadForUpdate}
            >
              {t.updateAvailableBtn}
            </button>
          </div>
        )}

        {CHANGELOG_RELEASES.map((rel, idx) => (
          <section key={rel.version} className="help-section changelog-card">
            <div className="changelog-card-header">
              <h3>{rel.title[lang]}</h3>
              <span className="badge-mode">
                {rel.date} {idx === 0 ? '· NY' : ''}
              </span>
            </div>
            <ul>
              {rel.items[lang].map((bullet, bIdx) => (
                <li key={bIdx}>{bullet}</li>
              ))}
            </ul>
          </section>
        ))}

        <div className="muted" style={{ fontSize: '0.78rem', textAlign: 'end' }}>
          Build: <code>{CURRENT_BUILD_ID}</code>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-primary" onClick={onClose}>
          {t.closeBtn}
        </button>
      </div>
    </dialog>
  );
};
