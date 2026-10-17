"""Start Optima locally using only Python 3 standard library."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser


def main():
    root = Path(__file__).resolve().parent / 'dist'
    if not (root / 'index.html').is_file() or not (root / 'next' / 'index.html').is_file():
        raise SystemExit('Missing dist/index.html or dist/next/index.html. Run git pull in the frontend branch.')
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    server = None
    for port in range(4173, 4193):
        try:
            server = ThreadingHTTPServer(('127.0.0.1', port), handler)
            break
        except OSError:
            continue
    if server is None:
        raise SystemExit('Ports 4173-4192 are busy. Close old Optima windows and try again.')
    url = f'http://127.0.0.1:{server.server_port}/next/'
    print('\nOPTIMA NEXT - local demo\n')
    print(f'Open in your browser: {url}')
    print('Keep this window open. Press Ctrl+C to stop.\n')
    timer = threading.Timer(0.8, lambda: webbrowser.open_new_tab(url))
    timer.daemon = True
    timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nOptima stopped.')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
