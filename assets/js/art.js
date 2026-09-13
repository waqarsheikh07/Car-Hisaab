/* =============================================================================
   art.js — hand-drawn SVG, inlined rather than loaded.
   Inline (not <img>) so every illustration inherits currentColor and re-themes
   with light/dark instantly, and so an empty screen costs zero extra requests.
   ============================================================================= */
(function (root) {
  'use strict';

  // Side-profile car. `tint` is a CSS colour (usually a status colour) so the
  // placeholder reads differently for in-stock / repair / listed / sold.
  function carSilhouette(tint) {
    var c = tint || 'currentColor';
    return '' +
    '<svg class="ph" viewBox="0 0 200 100" fill="none" aria-hidden="true">' +
      '<ellipse cx="100" cy="88" rx="78" ry="5" fill="' + c + '" opacity="0.10"/>' +
      '<path d="M20 76C16 76 14 73 14 69L15 57C15.5 51 19 47 25 46L64 40L84 28' +
             'C88 25.5 92 24.5 97 24.5L124 24.5C131 24.5 137 27 141 32L152 45' +
             'L172 49C179 50.5 184 56 184 63L184 69C184 73 181 76 177 76Z" ' +
             'fill="' + c + '" opacity="0.14"/>' +
      '<path d="M20 76C16 76 14 73 14 69L15 57C15.5 51 19 47 25 46L64 40L84 28' +
             'C88 25.5 92 24.5 97 24.5L124 24.5C131 24.5 137 27 141 32L152 45' +
             'L172 49C179 50.5 184 56 184 63L184 69C184 73 181 76 177 76Z" ' +
             'stroke="' + c + '" stroke-width="3" stroke-linejoin="round" opacity="0.75"/>' +
      '<path d="M70 43L86 31.5C88.5 30 91 29 94 29H106V43Z" fill="' + c + '" opacity="0.28"/>' +
      '<path d="M112 29H124C129 29 133 31 136 34.5L143 43H112Z" fill="' + c + '" opacity="0.28"/>' +
      '<path d="M168 57h9c2 0 3.5 1.5 3.5 3.5S179 64 177 64h-9z" fill="' + c + '" opacity="0.55"/>' +
      '<path d="M96 55h18" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round" opacity="0.4"/>' +
      '<circle cx="56" cy="76" r="15" fill="' + c + '" opacity="0.16"/>' +
      '<circle cx="56" cy="76" r="15" stroke="' + c + '" stroke-width="3" opacity="0.75"/>' +
      '<circle cx="56" cy="76" r="5.5" stroke="' + c + '" stroke-width="2.5" opacity="0.5"/>' +
      '<circle cx="150" cy="76" r="15" fill="' + c + '" opacity="0.16"/>' +
      '<circle cx="150" cy="76" r="15" stroke="' + c + '" stroke-width="3" opacity="0.75"/>' +
      '<circle cx="150" cy="76" r="5.5" stroke="' + c + '" stroke-width="2.5" opacity="0.5"/>' +
    '</svg>';
  }

  // Empty parking bay — no cars recorded yet.
  var emptyCars = '' +
    '<svg class="art" viewBox="0 0 260 170" fill="none" aria-hidden="true">' +
      '<path d="M40 140h180" stroke="var(--line-strong)" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M62 140V74a6 6 0 0 1 6-6h124a6 6 0 0 1 6 6v66" stroke="var(--line-strong)" ' +
            'stroke-width="3" stroke-linecap="round" stroke-dasharray="10 11"/>' +
      '<path d="M130 140V68" stroke="var(--line-strong)" stroke-width="3" stroke-dasharray="10 11"/>' +
      '<circle cx="130" cy="52" r="21" fill="var(--accent-soft)"/>' +
      '<path d="M121 52h18M130 43v18" stroke="var(--accent)" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M34 112h14M212 112h14" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" opacity="0.45"/>' +
    '</svg>';

  // Banknote with nothing in it — no payouts recorded yet.
  var emptyPayouts = '' +
    '<svg class="art" viewBox="0 0 260 170" fill="none" aria-hidden="true">' +
      '<rect x="46" y="52" width="168" height="88" rx="12" fill="var(--surface-sunken)" ' +
            'stroke="var(--line-strong)" stroke-width="3" stroke-dasharray="11 10"/>' +
      '<circle cx="130" cy="96" r="24" fill="var(--accent-soft)" stroke="var(--accent-line)" stroke-width="2.5"/>' +
      '<path d="M130 84v24M124 89.5c0-3.3 2.7-5 6-5s6 1.4 6 4.6c0 6.4-12 3.8-12 10 ' +
             'C124 96.8 126.7 99 130 99s6-1.7 6-5" stroke="var(--accent)" stroke-width="2.8" ' +
            'stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M64 68h18M178 124h18" stroke="var(--line-strong)" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M112 34l7 12h-14z" fill="var(--accent)" opacity="0.5"/>' +
      '<path d="M148 34l7 12h-14z" fill="var(--accent)" opacity="0.25"/>' +
    '</svg>';

  // A calendar with one quiet month — nothing happened in this period.
  var emptyMonth = '' +
    '<svg class="art" viewBox="0 0 260 170" fill="none" aria-hidden="true">' +
      '<rect x="54" y="40" width="152" height="106" rx="12" fill="var(--surface-sunken)" ' +
            'stroke="var(--line-strong)" stroke-width="3"/>' +
      '<path d="M54 70h152" stroke="var(--line-strong)" stroke-width="3"/>' +
      '<path d="M86 28v22M174 28v22" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>' +
      '<g fill="var(--line-strong)">' +
        '<rect x="74" y="86" width="20" height="9" rx="4.5"/>' +
        '<rect x="106" y="86" width="20" height="9" rx="4.5"/>' +
        '<rect x="138" y="86" width="20" height="9" rx="4.5"/>' +
        '<rect x="170" y="86" width="18" height="9" rx="4.5"/>' +
        '<rect x="74" y="110" width="20" height="9" rx="4.5"/>' +
        '<rect x="138" y="110" width="20" height="9" rx="4.5"/>' +
        '<rect x="170" y="110" width="18" height="9" rx="4.5"/>' +
      '</g>' +
      '<rect x="102" y="104" width="28" height="21" rx="7" fill="var(--accent-soft)" ' +
            'stroke="var(--accent)" stroke-width="2.5"/>' +
      '<path d="M110 114.5l4 4.5 8-9" stroke="var(--accent)" stroke-width="2.8" ' +
            'stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  // Stack of coins — no capital entries yet.
  var emptyCapital = '' +
    '<svg class="art" viewBox="0 0 260 170" fill="none" aria-hidden="true">' +
      '<ellipse cx="130" cy="140" rx="72" ry="10" fill="var(--line)" opacity="0.5"/>' +
      '<g stroke="var(--line-strong)" stroke-width="3" fill="var(--surface-sunken)">' +
        '<rect x="76" y="112" width="108" height="22" rx="11"/>' +
        '<rect x="76" y="88" width="108" height="22" rx="11"/>' +
      '</g>' +
      '<rect x="76" y="64" width="108" height="22" rx="11" fill="var(--accent-soft)" ' +
            'stroke="var(--accent)" stroke-width="3"/>' +
      '<path d="M130 46V26M118 34l12-12 12 12" stroke="var(--accent)" stroke-width="3.4" ' +
            'stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  // Brand mark: a wheel that doubles as a coin.
  var logoMark = '' +
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>' +
      '<circle cx="12" cy="12" r="3.2" fill="currentColor"/>' +
      '<path d="M12 3v4.2M12 16.8V21M3 12h4.2M16.8 12H21" stroke="currentColor" ' +
            'stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';

  root.Art = {
    carSilhouette: carSilhouette,
    emptyCars: emptyCars,
    emptyPayouts: emptyPayouts,
    emptyMonth: emptyMonth,
    emptyCapital: emptyCapital,
    logoMark: logoMark
  };
}(window));
