/**
 * AEQDF — Phase 3, corrected.
 *
 * IMPORTANT CONTEXT: the model was trained on the PhiUSIIL dataset, whose
 * 46 usable columns (after dropping ID and label-leakage columns) are ALL
 * URL-lexical and webpage-content features — there is no WHOIS, SSL
 * certificate, or DNS column in that dataset. So, despite the paper's
 * narrative describing domain/SSL/DNS as feature groups, the trained
 * classifier's input schema does not include them. This extractor
 * produces exactly the 46 named features the model actually expects,
 * computed for real from the URL string and the fetched page content —
 * no npm packages beyond what's already installed (uses only Node's
 * built-in https/http modules).
 *
 * If you want WHOIS/SSL/DNS signals too, the honest place for them is as
 * EXTRA context shown in the UI alongside the verdict (e.g. "domain
 * registered 3 days ago"), not as inputs to this particular model, since
 * it was never trained on that data. That would be a separate, additive
 * feature — not a fix to this function.
 */

import https from "node:https";
import http from "node:http";

const FETCH_TIMEOUT_MS = 6000;
const MAX_BODY_BYTES = 2_000_000; // cap how much HTML we read, for speed/safety

// ---------- Fetch the page, following redirects, with a hard timeout ----------
function fetchPage(targetUrl, maxRedirects = 5) {
  return new Promise((resolve) => {
    let redirectCount = 0;
    let selfRedirectCount = 0;
    const originalHost = (() => {
      try { return new URL(targetUrl).hostname; } catch { return null; }
    })();

    function doFetch(currentUrl) {
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch {
        return resolve({ ok: false, html: "", redirectCount, selfRedirectCount });
      }
      const lib = parsed.protocol === "https:" ? https : http;

      const req = lib.get(
        currentUrl,
        { timeout: FETCH_TIMEOUT_MS, headers: { "User-Agent": "AEQDF-Scanner/1.0" } },
        (res) => {
          const { statusCode, headers } = res;

          if (statusCode >= 300 && statusCode < 400 && headers.location && redirectCount < maxRedirects) {
            redirectCount += 1;
            let nextUrl;
            try {
              nextUrl = new URL(headers.location, currentUrl).toString();
            } catch {
              res.resume();
              return resolve({ ok: false, html: "", redirectCount, selfRedirectCount });
            }
            if (originalHost && new URL(nextUrl).hostname === originalHost) {
              selfRedirectCount += 1;
            }
            res.resume();
            return doFetch(nextUrl);
          }

          let body = "";
          let bytes = 0;
          res.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes <= MAX_BODY_BYTES) body += chunk.toString("utf8");
            else res.destroy();
          });
          res.on("end", () => resolve({ ok: true, html: body, redirectCount, selfRedirectCount }));
          res.on("error", () => resolve({ ok: false, html: body, redirectCount, selfRedirectCount }));
        }
      );
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, html: "", redirectCount, selfRedirectCount });
      });
      req.on("error", () => resolve({ ok: false, html: "", redirectCount, selfRedirectCount }));
    }

    doFetch(targetUrl);
  });
}

// ---------- Lexical features: computed directly from the URL string ----------
function lexicalFeatures(urlStr) {
  let hostname = "";
  let tld = "";
  try {
    const u = new URL(urlStr);
    hostname = u.hostname;
    const parts = hostname.split(".");
    tld = parts.length > 1 ? parts[parts.length - 1] : "";
  } catch {
    hostname = "";
  }

  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  const subdomainCount = hostname ? Math.max(0, hostname.split(".").length - 2) : 0;

  const obfuscatedMatches = urlStr.match(/%[0-9A-Fa-f]{2}/g) || [];
  const letters = (urlStr.match(/[a-zA-Z]/g) || []).length;
  const digits = (urlStr.match(/[0-9]/g) || []).length;
  const equals = (urlStr.match(/=/g) || []).length;
  const qmarks = (urlStr.match(/\?/g) || []).length;
  const ampersands = (urlStr.match(/&/g) || []).length;
  // "Other" special chars = anything not alnum and not one of the common URL chars
  const otherSpecial = (urlStr.match(/[^a-zA-Z0-9\-._/:?&=]/g) || []).length;
  const totalSpecial = (urlStr.match(/[^a-zA-Z0-9]/g) || []).length;

  const len = urlStr.length || 1;

  return {
    URLLength: urlStr.length,
    DomainLength: hostname.length,
    IsDomainIP: isIp ? 1 : 0,
    TLDLength: tld.length,
    NoOfSubDomain: subdomainCount,
    HasObfuscation: obfuscatedMatches.length > 0 ? 1 : 0,
    NoOfObfuscatedChar: obfuscatedMatches.length,
    ObfuscationRatio: Number((obfuscatedMatches.length / len).toFixed(4)),
    NoOfLettersInURL: letters,
    LetterRatioInURL: Number((letters / len).toFixed(4)),
    NoOfDegitsInURL: digits,
    DegitRatioInURL: Number((digits / len).toFixed(4)),
    NoOfEqualsInURL: equals,
    NoOfQMarkInURL: qmarks,
    NoOfAmpersandInURL: ampersands,
    NoOfOtherSpecialCharsInURL: otherSpecial,
    SpacialCharRatioInURL: Number((totalSpecial / len).toFixed(4)),
    IsHTTPS: urlStr.startsWith("https://") ? 1 : 0,
    // NOTE: URLSimilarityIndex is intentionally NOT produced here. It is a
    // dataset-derived score that cannot be computed from a raw URL, so the
    // model was retrained without it (45 features).
  };
}

// ---------- Content features: computed from the fetched page HTML ----------
function contentFeatures(html, urlStr, redirectCount, selfRedirectCount) {
  let hostname = "";
  try { hostname = new URL(urlStr).hostname; } catch { /* noop */ }

  const lines = html ? html.split("\n") : [];
  const largestLine = lines.reduce((m, l) => Math.max(m, l.length), 0);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1].trim() : "";
  const hasTitle = titleText.length > 0 ? 1 : 0;

  const domainCore = hostname.split(".").slice(-2, -1)[0] || hostname;
  const domainTitleMatch = domainCore && titleText.toLowerCase().includes(domainCore.toLowerCase()) ? 1 : 0;

  const hasFavicon = /<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html) ? 1 : 0;
  const hasRobotsMeta = /<meta[^>]+name=["']robots["']/i.test(html) ? 1 : 0;
  const isResponsive = /<meta[^>]+name=["']viewport["']/i.test(html) ? 1 : 0;
  const hasDescription = /<meta[^>]+name=["']description["']/i.test(html) ? 1 : 0;

  const popupCount = (html.match(/window\.open\s*\(/gi) || []).length;
  const iframeCount = (html.match(/<iframe\b/gi) || []).length;

  const forms = html.match(/<form\b[^>]*>/gi) || [];
  let hasExternalFormSubmit = 0;
  for (const f of forms) {
    const actionMatch = f.match(/action=["']([^"']+)["']/i);
    if (actionMatch) {
      try {
        const actionHost = new URL(actionMatch[1], urlStr).hostname;
        if (actionHost && actionHost !== hostname) { hasExternalFormSubmit = 1; break; }
      } catch { /* relative/invalid action, ignore */ }
    }
  }

  const socialDomains = ["facebook.com", "twitter.com", "x.com", "instagram.com", "linkedin.com", "youtube.com"];
  const hasSocialNet = socialDomains.some((d) => html.toLowerCase().includes(d)) ? 1 : 0;

  const hasSubmitButton = /<(?:input|button)[^>]+type=["']submit["']/i.test(html) ? 1 : 0;
  const hasHiddenFields = /<input[^>]+type=["']hidden["']/i.test(html) ? 1 : 0;
  const hasPasswordField = /<input[^>]+type=["']password["']/i.test(html) ? 1 : 0;

  const lowerHtml = html.toLowerCase();
  const bank = lowerHtml.includes("bank") ? 1 : 0;
  const pay = lowerHtml.includes("pay") ? 1 : 0;
  const crypto = /crypto|bitcoin|ethereum/.test(lowerHtml) ? 1 : 0;
  const hasCopyrightInfo = /©|copyright/i.test(html) ? 1 : 0;

  const imageCount = (html.match(/<img\b/gi) || []).length;
  const cssCount = (html.match(/<link[^>]+rel=["']stylesheet["']/gi) || []).length
    + (html.match(/<style\b/gi) || []).length;
  const jsCount = (html.match(/<script\b/gi) || []).length;

  const anchors = html.match(/<a\b[^>]*href=["']([^"']*)["']/gi) || [];
  let selfRef = 0, emptyRef = 0, externalRef = 0;
  for (const a of anchors) {
    const hrefMatch = a.match(/href=["']([^"']*)["']/i);
    const href = hrefMatch ? hrefMatch[1].trim() : "";
    if (!href || href === "#") { emptyRef += 1; continue; }
    try {
      const linkHost = new URL(href, urlStr).hostname;
      if (linkHost === hostname) selfRef += 1;
      else externalRef += 1;
    } catch {
      emptyRef += 1;
    }
  }

  return {
    LineOfCode: lines.length,
    LargestLineLength: largestLine,
    HasTitle: hasTitle,
    DomainTitleMatchScore: domainTitleMatch,
    HasFavicon: hasFavicon,
    Robots: hasRobotsMeta,
    IsResponsive: isResponsive,
    NoOfURLRedirect: redirectCount,
    NoOfSelfRedirect: selfRedirectCount,
    HasDescription: hasDescription,
    NoOfPopup: popupCount,
    NoOfiFrame: iframeCount,
    HasExternalFormSubmit: hasExternalFormSubmit,
    HasSocialNet: hasSocialNet,
    HasSubmitButton: hasSubmitButton,
    HasHiddenFields: hasHiddenFields,
    HasPasswordField: hasPasswordField,
    Bank: bank,
    Pay: pay,
    Crypto: crypto,
    HasCopyrightInfo: hasCopyrightInfo,
    NoOfImage: imageCount,
    NoOfCSS: cssCount,
    NoOfJS: jsCount,
    NoOfSelfRef: selfRef,
    NoOfEmptyRef: emptyRef,
    NoOfExternalRef: externalRef,
  };
}

// Fallback content features if the page can't be fetched at all (timeout,
// DNS failure, connection refused). Zeros here are not a neutral guess —
// the paper's own finding (Section 5.5) is that phishing clones
// systematically lack content richness, so an unreachable/empty page
// leans the same direction a real phishing page would.
function emptyContentFeatures() {
  return {
    LineOfCode: 0, LargestLineLength: 0, HasTitle: 0, DomainTitleMatchScore: 0,
    HasFavicon: 0, Robots: 0, IsResponsive: 0, NoOfURLRedirect: 0, NoOfSelfRedirect: 0,
    HasDescription: 0, NoOfPopup: 0, NoOfiFrame: 0, HasExternalFormSubmit: 0,
    HasSocialNet: 0, HasSubmitButton: 0, HasHiddenFields: 0, HasPasswordField: 0,
    Bank: 0, Pay: 0, Crypto: 0, HasCopyrightInfo: 0, NoOfImage: 0, NoOfCSS: 0,
    NoOfJS: 0, NoOfSelfRef: 0, NoOfEmptyRef: 0, NoOfExternalRef: 0,
  };
}

export async function extractFeatures(url) {
  const lexical = lexicalFeatures(url);
  const page = await fetchPage(url);
  const content = page.ok
    ? contentFeatures(page.html, url, page.redirectCount, page.selfRedirectCount)
    : emptyContentFeatures();

  return { ...lexical, ...content };
}