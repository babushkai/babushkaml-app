fn main() {
    tauri_build::build();
    
    // Note: runner.py is copied by the Makefile after the build completes
    // This is because the bundle location is only known after Tauri creates it
}





