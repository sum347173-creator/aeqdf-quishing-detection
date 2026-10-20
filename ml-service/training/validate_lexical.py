"""
AEQDF — validate the extractor's URL-text feature definitions against PhiUSIIL.

The dataset has BOTH the raw URL and the feature columns the authors computed
from it. This script recomputes our lexical features from the URL (using the
same logic as backend/src/services/featureExtractor.js) and compares them with
the dataset's own columns. Where they disagree, our definition is wrong.

It also checks whether URL *format* (e.g. a leading "www.") differs between
legitimate and phishing rows, which would explain why bare domains such as
https://github.com look suspicious to the model.

Run from ml-service/training with the venv active:
    python validate_lexical.py
"""
import re
import sys

import pandas as pd
from urllib.parse import urlparse

CSV = sys.argv[1] if len(sys.argv) > 1 else "PhiUSIIL_Phishing_URL_Dataset.csv"
N = 20000
RATIO_COLS = {"ObfuscationRatio", "LetterRatioInURL", "DegitRatioInURL", "SpacialCharRatioInURL"}


def ours(url: str) -> dict:
    p = urlparse(url)
    host = p.hostname or ""
    parts = host.split(".")
    tld = parts[-1] if len(parts) > 1 else ""
    pct = re.findall(r"%[0-9A-Fa-f]{2}", url)
    letters = len(re.findall(r"[A-Za-z]", url))
    digits = len(re.findall(r"[0-9]", url))
    n = max(len(url), 1)
    return {
        "URLLength": len(url),
        "DomainLength": len(host),
        "IsDomainIP": 1 if re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host) else 0,
        "TLDLength": len(tld),
        "NoOfSubDomain": max(0, len(parts) - 2) if host else 0,
        "HasObfuscation": 1 if pct else 0,
        "NoOfObfuscatedChar": len(pct),
        "ObfuscationRatio": len(pct) / n,
        "NoOfLettersInURL": letters,
        "LetterRatioInURL": letters / n,
        "NoOfDegitsInURL": digits,
        "DegitRatioInURL": digits / n,
        "NoOfEqualsInURL": url.count("="),
        "NoOfQMarkInURL": url.count("?"),
        "NoOfAmpersandInURL": url.count("&"),
        "NoOfOtherSpecialCharsInURL": len(re.findall(r"[^A-Za-z0-9\-._/:?&=]", url)),
        "SpacialCharRatioInURL": len(re.findall(r"[^A-Za-z0-9]", url)) / n,
        "IsHTTPS": 1 if url.startswith("https://") else 0,
    }


def main():
    df = pd.read_csv(CSV)
    df = df.sample(min(N, len(df)), random_state=42).reset_index(drop=True)
    print(f"Checking {len(df):,} random rows\n")

    mine = pd.DataFrame([ours(u) for u in df["URL"].astype(str)])

    print("=== 1. Does OUR definition match the dataset's own column? ===")
    print(f"{'feature':<28}{'match %':>9}   example mismatch (dataset vs ours)")
    bad = []
    for col in mine.columns:
        if col not in df.columns:
            print(f"{col:<28}{'n/a':>9}   (column not in dataset)")
            continue
        tol = 0.011 if col in RATIO_COLS else 0.0
        ok = (df[col] - mine[col]).abs() <= tol
        pct = ok.mean() * 100
        example = ""
        if pct < 100:
            i = ok[~ok].index[0]
            example = f"{df['URL'][i][:45]} -> {df[col][i]} vs {round(mine[col][i], 4)}"
            bad.append(col)
        print(f"{col:<28}{pct:>8.1f}%   {example}")
    print("\nFeatures needing a fix:", bad if bad else "none")

    print("\n=== 2. Is URL format different between legit and phishing rows? ===")
    names = {1: "legitimate", 0: "phishing"}
    www = df["URL"].str.contains(r"^https?://www\.", regex=True)
    for lab in (1, 0):
        m = df["label"] == lab
        print(f"{names[lab]:<11} rows={m.sum():>6,}  starts with www.: {www[m].mean()*100:5.1f}%"
              f"  | NoOfSubDomain==0: {(df['NoOfSubDomain'][m] == 0).mean()*100:5.1f}%"
              f"  | HTTPS: {df['IsHTTPS'][m].mean()*100:5.1f}%"
              f"  | mean URLLength: {df['URLLength'][m].mean():5.1f}")


if __name__ == "__main__":
    main()
