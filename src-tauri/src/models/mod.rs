// =============================================================================
// Fichier  : src-tauri/src/models/mod.rs
// Auteur   : KREMER Regis
// Desc.    : Module models - re-exports des structs de donnees
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

pub mod profile;
pub mod purchase;
pub mod simulation;

// Réexports désactivés : les modules sont importés explicitement dans les commandes.
// Cela évite les warnings unused_imports en build strict.
// pub use profile::*;
// pub use purchase::*;
// pub use simulation::*;
