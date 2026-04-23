-- MIRA — seed commercial_calendar with upcoming 2026 retail + cultural events.
-- Feeds calendar_posture_v1 and seasonal_prediction_v1 templates.
-- Idempotent: ON CONFLICT DO NOTHING on (region, event_name, event_date).
-- Growth factors are seasonal assumptions when real historical data is thin.

INSERT INTO public.commercial_calendar (region, event_name, event_date, impact_tag, magnitude_hint, notes) VALUES
  ('FR', 'Fête des Mères',         '2026-05-25', 'gift',     'medium', 'Pic décoration + petits objets'),
  ('FR', 'Soldes été FR',          '2026-06-24', 'sale',     'high',   'Démarrage officiel soldes été 2026'),
  ('IT', 'Saldi estivi IT',        '2026-07-04', 'sale',     'high',   'Avvio saldi estate 2026'),
  ('DE', 'Sommerschlussverkauf',   '2026-07-27', 'sale',     'medium', 'Fin juillet, pic stocks'),
  ('IT', 'Ferragosto',             '2026-08-15', 'cultural', 'low',    'Fermeture Italie — logistique ralentie'),
  ('FR', 'Rentrée scolaire',       '2026-09-01', 'seasonal', 'medium', 'Back to school FR'),
  ('DE', 'Oktoberfest',            '2026-09-19', 'cultural', 'low',    'Pic régional Bavière'),
  ('FR', 'Black Friday',           '2026-11-27', 'sale',     'very_high', 'Pic mondial vente en ligne'),
  ('IT', 'Black Friday IT',        '2026-11-27', 'sale',     'very_high', 'Pic vente en ligne'),
  ('DE', 'Black Friday DE',        '2026-11-27', 'sale',     'very_high', 'Pic vente en ligne'),
  ('FR', 'Cyber Monday',           '2026-11-30', 'sale',     'high',   'Prolongement Black Friday'),
  ('FR', 'Semaine Noël',           '2026-12-20', 'gift',     'high',   'Dernière semaine avant Noël')
ON CONFLICT (region, event_name, event_date) DO NOTHING;
