import http.server
import socketserver
import os
import sys
from pathlib import Path

DIRECTORY = Path(__file__).resolve().parent / "build"

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)

    def do_GET(self):
        full_path = self.translate_path(self.path)
        # If the requested path is not an existing file or directory with index.html, serve index.html
        if not os.path.exists(full_path) or (os.path.isdir(full_path) and not os.path.exists(os.path.join(full_path, "index.html"))):
            self.path = "/index.html"
        return super().do_GET()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", port), SPAHandler) as httpd:
        print(f"Serving Ember SPA on http://localhost:{port}", flush=True)
        httpd.serve_forever()
