#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

BASE = "https://rannta.com"
SITEMAP = f"{BASE}/sitemap.xml"
USER_AGENT = "RANNTA-SEO-Audit/1.0"

FORBIDDEN_PUBLIC_IDENTITY_TERMS = (
    "Ghafari",
    "MohammadAli",
    "Mohammad Ali",
)

KEY_URLS = (
    f"{BASE}/",
    f"{BASE}/ilia144000.html",
    f"{BASE}/authoritative.html",
    f"{BASE}/entity.html",
    f"{BASE}/ai-index.html",
    f"{BASE}/ai.txt",
    f"{BASE}/.well-known/ai.txt",
    f"{BASE}/llms.txt",
)


def fetch(url: str, retries: int = 4) -> tuple[int, str, str]:
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                },
            )
            with urllib.request.urlopen(req, timeout=20) as response:
                body = response.read().decode("utf-8", errors="replace")
                return response.status, response.geturl(), body
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(5 * attempt)
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def canonical_from_html(html: str) -> str | None:
    patterns = (
        r'<link\s+[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']',
        r'<link\s+[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\']canonical["\']',
    )
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.I)
        if match:
            return match.group(1).strip()
    return None


def robots_from_html(html: str) -> str:
    match = re.search(
        r'<meta\s+[^>]*name=["\']robots["\'][^>]*content=["\']([^"\']+)["\']',
        html,
        flags=re.I,
    )
    return match.group(1).strip().lower() if match else ""


def sitemap_urls(xml_text: str) -> list[str]:
    root = ET.fromstring(xml_text)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [
        node.text.strip()
        for node in root.findall("sm:url/sm:loc", ns)
        if node.text and node.text.strip()
    ]


def main() -> int:
    failures: list[str] = []
    warnings: list[str] = []

    status, _, sitemap_text = fetch(SITEMAP)
    if status != 200:
        failures.append(f"Sitemap returned HTTP {status}: {SITEMAP}")
    urls = sitemap_urls(sitemap_text)

    if not urls:
        failures.append("Sitemap contains no URLs.")

    for url in urls:
        try:
            status, final_url, body = fetch(url)
        except Exception as exc:
            failures.append(str(exc))
            continue

        if status != 200:
            failures.append(f"HTTP {status}: {url}")
            continue

        if final_url.rstrip("/") != url.rstrip("/"):
            warnings.append(f"Redirected: {url} -> {final_url}")

        if url.endswith(".html") or url == f"{BASE}/" or url.endswith("/"):
            canonical = canonical_from_html(body)
            if not canonical:
                failures.append(f"Missing canonical: {url}")
            elif canonical.rstrip("/") != url.rstrip("/"):
                failures.append(f"Canonical mismatch: {url} -> {canonical}")

            robots = robots_from_html(body)
            if "noindex" in robots:
                failures.append(f"Sitemap URL is noindex: {url}")

        if len(re.sub(r"<[^>]+>", " ", body).strip()) < 250:
            warnings.append(f"Very thin page candidate: {url}")

    for url in KEY_URLS:
        try:
            status, _, body = fetch(url)
        except Exception as exc:
            failures.append(str(exc))
            continue

        if status != 200:
            failures.append(f"Key URL HTTP {status}: {url}")

        for forbidden in FORBIDDEN_PUBLIC_IDENTITY_TERMS:
            if forbidden.lower() in body.lower():
                failures.append(f"Forbidden public identity term {forbidden!r} found at {url}")

    try:
        _, _, founder = fetch(f"{BASE}/ilia144000.html")
        if "ilia144000" not in founder:
            failures.append("Canonical founder page does not contain ilia144000.")
    except Exception as exc:
        failures.append(str(exc))

    try:
        _, _, llms = fetch(f"{BASE}/llms.txt")
        required = (
            "Public name: ilia144000",
            "RANNTA X-Chain",
            "Chain ID: 13113",
            "RANNTA Presale V2 is closed",
        )
        for item in required:
            if item not in llms:
                failures.append(f"llms.txt missing required canonical statement: {item}")
    except Exception as exc:
        failures.append(str(exc))

    for warning in warnings:
        print(f"WARNING: {warning}")

    if failures:
        print("\nSEO AUDIT FAILED")
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1

    print(f"SEO AUDIT PASS: {len(urls)} sitemap URLs checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
