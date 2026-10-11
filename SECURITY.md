# Security

## Reporting

Please report vulnerabilities privately through
[GitHub security advisories](https://github.com/Amtb8788/BigViz/security/advisories/new),
not public issues.

## API keys

BigViz reads `BIGVIZ_API_KEY` from the environment only and never prints or writes it.
Never commit keys or `.env` files; CI runs gitleaks on every push. If a key leaks, revoke it
with your provider first.
