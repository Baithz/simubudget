// =============================================================================
// Fichier  : src-tauri/src/db/profile_repo.rs
// Auteur   : KREMER Regis
// Desc.    : Repository SQLite pour les profils utilisateur (CRUD complet)
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

use rusqlite::{Connection, Result as SqlResult};
use crate::models::profile::UserProfile;

/// Sauvegarde ou met a jour un profil (upsert par id)
pub fn save(conn: &Connection, profile: &UserProfile) -> SqlResult<()> {
    let data = serde_json::to_string(profile)
        .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;

    conn.execute(
        "INSERT INTO profiles (id, name, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name       = excluded.name,
           data       = excluded.data,
           updated_at = datetime('now')",
        rusqlite::params![profile.id, "Mon profil", data],
    )?;
    Ok(())
}

/// Charge un profil par son id
#[allow(dead_code)]
pub fn load(conn: &Connection, id: &str) -> SqlResult<Option<UserProfile>> {
    let mut stmt = conn.prepare(
        "SELECT data FROM profiles WHERE id = ?1"
    )?;

    let result = stmt.query_row([id], |row| {
        let json: String = row.get(0)?;
        Ok(json)
    });

    match result {
        Ok(json) => {
            let profile: UserProfile = serde_json::from_str(&json)
                .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;
            Ok(Some(profile))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Charge le profil le plus recent (ou le profil "default")
pub fn load_latest(conn: &Connection) -> SqlResult<Option<UserProfile>> {
    let mut stmt = conn.prepare(
        "SELECT data FROM profiles ORDER BY updated_at DESC LIMIT 1"
    )?;

    let result = stmt.query_row([], |row| {
        let json: String = row.get(0)?;
        Ok(json)
    });

    match result {
        Ok(json) => {
            let profile: UserProfile = serde_json::from_str(&json)
                .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;
            Ok(Some(profile))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Liste tous les profils (id + nom + date)
#[allow(dead_code)]
pub fn list(conn: &Connection) -> SqlResult<Vec<(String, String, String)>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, updated_at FROM profiles ORDER BY updated_at DESC"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    rows.collect()
}

/// Supprime un profil par son id
#[allow(dead_code)]
pub fn delete(conn: &Connection, id: &str) -> SqlResult<()> {
    conn.execute("DELETE FROM profiles WHERE id = ?1", [id])?;
    Ok(())
}
