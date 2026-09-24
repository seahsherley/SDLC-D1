# Snip CLI

A zero-dependency Node.js CLI for the Snip URL shortener backend.

## Usage

```bash
snip add <url>    # shorten a URL, prints the shortUrl
snip ls           # list all links as an aligned code/hits/url table
snip open <code>  # resolve a short code and open it in the browser
snip help         # usage text (also shown with no args)
```

Run directly with Node if the wrapper isn't on your PATH:

```bash
node cli.js add https://example.com
```

## Config

- `SNIP_API` — base URL of the Snip backend (default `http://localhost:3000`).

Errors (invalid input, unknown code, unreachable backend) are printed to stderr
and exit with status code 1.
