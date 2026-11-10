"""Browser regression against a running local Sentinel (Playwright Python)."""
import os

from playwright.sync_api import expect, sync_playwright

ROOT = os.getenv("SENTINEL_TEST_URL", "http://127.0.0.1:8794")
EVM = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
INJECTION = '<img src=x onerror="window.sentinelInjected=1">'
API = "**/api/sentinel/scan"


def check_layout(page, width):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
    for selector in ("#sentinel-network", "#sentinel-address", "#sentinel-form button"):
        box = page.locator(selector).bounding_box()
        assert box and box["x"] >= 0 and box["x"] + box["width"] <= width + 1, selector
        assert box["height"] >= 44, selector


with sync_playwright() as playwright:
    executable = os.getenv("SENTINEL_BROWSER")
    browser = playwright.chromium.launch(executable_path=executable) if executable else playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    assert page.goto(ROOT + "/sentinel", wait_until="domcontentloaded").status == 200
    expect(page.get_by_role("heading", name="On-Chain Risk Intelligence")).to_be_visible()
    expect(page.get_by_role("navigation", name="Main navigation").get_by_role("link", name="Sentinel")).to_have_attribute("href", "/sentinel")
    expect(page.locator("link[rel=canonical]")).to_have_attribute("href", "https://rannta.com/sentinel")
    for width in (1440, 768, 390, 375, 320):
        page.set_viewport_size({"width": width, "height": 900})
        check_layout(page, width)
    expect(page.get_by_role("button", name="Scan address")).to_be_in_viewport()
    page.get_by_label("Contract address").fill("javascript:alert(1)")
    page.get_by_role("button", name="Scan address").click()
    expect(page.get_by_label("Contract address")).to_have_attribute("aria-invalid", "true")

    page.get_by_label("Contract address").fill(EVM)
    page.get_by_role("button", name="Scan address").click()
    expect(page.get_by_role("heading", name="Evidence")).to_be_visible(timeout=25000)
    expect(page.locator(".sentinel-asset")).to_contain_text("Ethereum")
    for width in (1440, 768, 390, 375, 320):
        page.set_viewport_size({"width": width, "height": 900})
        check_layout(page, width)
    page.get_by_role("button", name="Scan address").click()
    expect(page.get_by_role("status")).to_have_text("Showing a recent scan.", timeout=25000)

    real = page.request.post(ROOT + "/api/sentinel/scan", data={"network": "ethereum", "address": EVM}).json()
    real["asset"]["name"] = INJECTION
    page.route(API, lambda route: route.fulfill(json=real))
    page.get_by_role("button", name="Scan address").click()
    expect(page.locator(".sentinel-asset h2")).to_contain_text(INJECTION)
    assert page.locator("#sentinel-report img").count() == 0
    assert page.evaluate("window.sentinelInjected === undefined")
    page.emulate_media(media="print")
    expect(page.locator(".sentinel-hero")).to_be_hidden()
    expect(page.locator(".sentinel-print-detail").first).to_be_visible()
    page.emulate_media(media="screen")
    page.unroute(API)

    page.route(API, lambda route: route.fulfill(status=502, json={"error": "Scanner temporarily unavailable."}))
    page.get_by_role("button", name="Scan address").click()
    expect(page.get_by_role("status")).to_have_text("Scanner temporarily unavailable.")
    expect(page.get_by_role("button", name="Scan address")).to_be_enabled()
    page.unroute(API)

    assert page.goto(ROOT + "/sentinel?network=solana", wait_until="domcontentloaded").status == 200
    expect(page.get_by_label("Network")).to_have_value("solana")
    page.get_by_label("Mint address").fill("0000")
    page.get_by_role("button", name="Scan address").click()
    expect(page.get_by_label("Mint address")).to_have_attribute("aria-invalid", "true")
    page.get_by_label("Mint address").fill(MINT)
    page.get_by_role("button", name="Scan address").click()
    expect(page.get_by_role("heading", name="Evidence")).to_be_visible(timeout=25000)
    expect(page.locator(".sentinel-asset")).to_contain_text("Solana")
    assert not errors, errors

    for path, label in (("/security", "Scan a Token"), ("/tools", "Open Sentinel")):
        assert page.goto(ROOT + path, wait_until="domcontentloaded").status == 200
        expect(page.get_by_role("link", name=label)).to_have_attribute("href", "/sentinel")
    for path in ("/", "/rannta-network.html", "/network/post-quantum.html", "/sitemap.xml"):
        assert page.request.get(ROOT + path).status == 200
    assert page.request.get(ROOT + "/sentinel-server/worker.mjs").status == 404
    browser.close()
    print("Sentinel browser checks passed at 320, 375, 390, 768, and 1440 pixels.")
