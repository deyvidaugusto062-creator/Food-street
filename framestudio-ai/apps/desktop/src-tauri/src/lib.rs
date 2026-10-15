//! Shell desktop do FrameStudio AI. A interface e o motor de edição são os mesmos do app web;
//! este processo nativo fornece apenas integrações do sistema operacional, com permissões mínimas.

use tauri::ipc::{InvokeBody, Request};
use tauri_plugin_dialog::DialogExt;

/// Salva bytes num arquivo escolhido pelo usuário num diálogo nativo.
/// O nome sugerido vem no cabeçalho `x-file-name`; o conteúdo, como corpo binário bruto.
/// Retorna o caminho gravado, ou `None` se o usuário cancelar.
#[tauri::command]
async fn save_file(app: tauri::AppHandle, request: Request<'_>) -> Result<Option<String>, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("corpo da requisição precisa ser binário".into());
    };
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.replace(['/', '\\'], "_"))
        .unwrap_or_else(|| "framestudio".into());
    let Some(path) = app.dialog().file().set_file_name(&name).blocking_save_file() else {
        return Ok(None);
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| format!("falha ao gravar: {e}"))?;
    Ok(Some(path.display().to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_file])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o FrameStudio AI");
}
