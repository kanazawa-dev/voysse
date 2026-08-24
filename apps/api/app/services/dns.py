"""DNS helpers for custom-domain verification.

Isolated behind a thin function so it can be monkeypatched in tests without
hitting a real resolver.
"""

import dns.resolver

CHALLENGE_PREFIX = "_openvoiss-challenge"


def challenge_host(domain: str) -> str:
    return f"{CHALLENGE_PREFIX}.{domain}"


def resolve_txt(name: str) -> list[str]:
    """Return the TXT record strings for ``name`` (empty list on any failure)."""
    try:
        answers = dns.resolver.resolve(name, "TXT")
    except Exception:
        return []
    values: list[str] = []
    for record in answers:
        # Each TXT record can be split into multiple quoted strings.
        values.append(b"".join(getattr(record, "strings", [])).decode("utf-8", "ignore"))
    return values


def txt_contains(domain: str, token: str) -> bool:
    return token in resolve_txt(challenge_host(domain))
