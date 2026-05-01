// =============================================================================
// Fichier  : src-tauri/src/db/mod.rs
// Auteur   : KREMER Regis
// Desc.    : Connexion SQLite globale + initialisation des migrations au demarrage
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

pub mod profile_repo;

use rusqlite::{Connection, Result as SqlResult};
use std::path::PathBuf;
use std::sync::Mutex;

/// Connexion SQLite globale protegee par un Mutex (Tauri est multi-thread)
pub struct DbState(pub Mutex<Connection>);

/// Initialise la connexion SQLite et execute les migrations
#[allow(dead_code)]
pub fn init_db(app_data_dir: PathBuf) -> SqlResult<Connection> {
    std::fs::create_dir_all(&app_data_dir).ok();
    let db_path = app_data_dir.join("simubudget.db");

    let conn = Connection::open(&db_path)?;

    // Performance : WAL mode pour eviter les locks en lecture
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    run_migrations(&conn)?;

    log::info!("SQLite initialise : {:?}", db_path);
    Ok(conn)
}

/// Execute les migrations SQL dans l'ordre
#[allow(dead_code)]
fn run_migrations(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id         INTEGER PRIMARY KEY,
            name       TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL
        );"
    )?;

    let migrations: &[(&str, &str)] = &[
        ("001_initial", include_str!("../../migrations/001_initial.sql")),
    ];

    for (name, sql) in migrations {
        let already_applied: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM _migrations WHERE name = ?1",
            [name],
            |row| row.get(0),
        ).unwrap_or(false);

        if !already_applied {
            conn.execute_batch(sql)?;
            conn.execute(
                "INSERT INTO _migrations (name, applied_at) VALUES (?1, datetime('now'))",
                [name],
            )?;
            log::info!("Migration appliquee : {}", name);
        }
    }

    Ok(())
}
