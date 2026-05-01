-- =============================================================================
-- Fichier  : src-tauri/migrations/001_initial.sql
-- Auteur   : KREMER Regis
-- Desc.    : Schema initial SimuBudget - profils, simulations, scenarios
-- -----------------------------------------------------------------------------
-- Changelog :
--   2026-04-26 | KREMER Regis | Creation du fichier
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT 'Mon profil',
    data        TEXT NOT NULL,      -- JSON serialise du UserProfile
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS simulations (
    id          TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL REFERENCES profiles(id),
    type        TEXT NOT NULL CHECK(type IN ('budget', 'location', 'purchase', 'scenario')),
    input       TEXT NOT NULL,      -- JSON input
    result      TEXT NOT NULL,      -- JSON result
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenarios (
    id          TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL REFERENCES profiles(id),
    name        TEXT NOT NULL,
    events      TEXT NOT NULL,      -- JSON array d'evenements
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_simulations_profile ON simulations(profile_id);
CREATE INDEX IF NOT EXISTS idx_simulations_type    ON simulations(type, created_at);
