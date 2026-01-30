#!/usr/bin/env python3
"""Pip Time Machine - Find package versions available on a specific date."""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import requests
from tqdm import tqdm

VERSION_CACHE = {}

DATE_FORMATS = [
    "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%d/%m/%Y",
    "%Y/%m/%d", "%b %d %Y", "%B %d %Y", "%d %b %Y", "%d %B %Y",
]


def parse_date(date_str):
    """Parse date string in various formats."""
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Could not parse date '{date_str}'. Use YYYY-MM-DD or similar.")


def parse_package_name(line):
    """Extract package name from requirement line."""
    match = re.match(r'^([a-zA-Z0-9_-]+)', line.strip())
    return match.group(1) if match else None


def is_requirement(line):
    """Check if line is a valid package requirement."""
    line = line.strip()
    return line and not line.startswith(('#', '-', 'git+'))


def get_version(package_name, target_date):
    """Fetch the version of a package available on a specific date from PyPI."""
    cache_key = f"{package_name}_{target_date.strftime('%Y-%m-%d')}"
    if cache_key in VERSION_CACHE:
        return VERSION_CACHE[cache_key]

    try:
        response = requests.get(
            f"https://pypi.org/pypi/{package_name}/json",
            timeout=10
        )

        if response.status_code == 404:
            return None
        if response.status_code != 200:
            return None

        data = response.json()
        latest_version = None
        latest_date = None

        for version, releases in data.get("releases", {}).items():
            for release in releases:
                try:
                    release_date = datetime.fromisoformat(
                        release["upload_time"].replace("Z", "+00:00")
                    )
                    if release_date <= target_date:
                        if not latest_date or release_date > latest_date:
                            latest_date = release_date
                            latest_version = version
                except (KeyError, ValueError):
                    continue

        VERSION_CACHE[cache_key] = latest_version
        return latest_version

    except (requests.RequestException, json.JSONDecodeError):
        return None


def process_file(input_path, target_date, output_path, specifier):
    """Process a requirements file."""
    lines = Path(input_path).read_text().splitlines()
    results = []

    for line in tqdm(lines, desc="Processing"):
        if not is_requirement(line):
            results.append(line)
            continue

        pkg = parse_package_name(line)
        if not pkg:
            results.append(line)
            continue

        version = get_version(pkg, target_date)
        if version:
            results.append(f"{pkg}{specifier}{version}")
        else:
            results.append(f"# {pkg} (not found)")

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text('\n'.join(results) + '\n')
    print(f"Saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Find package versions available on a specific date."
    )
    parser.add_argument("target", help="Package name or requirements.txt path")
    parser.add_argument("date", help="Target date (YYYY-MM-DD)")
    parser.add_argument(
        "-s", "--specifier",
        default="==",
        choices=["==", ">=", "~=", "<="],
        help="Version specifier (default: ==)"
    )
    parser.add_argument(
        "-o", "--output",
        help="Output file (default: requirements_DATE.txt)"
    )

    args = parser.parse_args()

    try:
        target_date = parse_date(args.date)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    target_path = Path(args.target)

    if target_path.is_file():
        output = args.output or f"requirements_{args.date}.txt"
        process_file(target_path, target_date, output, args.specifier)
    else:
        # Single package
        version = get_version(args.target, target_date)
        if version:
            print(f"{args.target}{args.specifier}{version}")
        else:
            print(f"No version found for {args.target} on {args.date}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
