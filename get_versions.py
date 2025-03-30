import requests
import argparse
from datetime import datetime
from tqdm import tqdm
import os
import re
import sys
import json
from pathlib import Path

# Cache for package version information
VERSION_CACHE = {}

def parse_date(date_str):
    """Parse a date string in various formats."""
    formats = [
        "%d-%m-%Y",  # DD-MM-YYYY
        "%Y-%m-%d",  # YYYY-MM-DD
        "%m/%d/%Y",  # MM/DD/YYYY
        "%d/%m/%Y",  # DD/MM/YYYY
        "%Y/%m/%d",  # YYYY/MM/DD
        "%b %d %Y",  # Jan 01 2023
        "%B %d %Y",  # January 01 2023
        "%d %b %Y",  # 01 Jan 2023
        "%d %B %Y",  # 01 January 2023
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    
    raise ValueError(f"Could not parse date '{date_str}'. Supported formats include: DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY, etc.")

def get_package_version_as_of_date(package_name, target_date):
    """Fetch the version of a package available on a specific date from PyPI."""
    # Check cache first
    cache_key = f"{package_name}_{target_date.strftime('%Y-%m-%d')}"
    if cache_key in VERSION_CACHE:
        return VERSION_CACHE[cache_key]
    
    try:
        url = f"https://pypi.org/pypi/{package_name}/json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 404:
            print(f"Package '{package_name}' not found on PyPI. Check the package name and try again.")
            return None
        
        if response.status_code != 200:
            print(f"Failed to fetch info for '{package_name}'. Error code: {response.status_code}")
            return None
        
        data = response.json()
        releases = data.get("releases", {})
        
        # Find the latest release on or before the target date
        latest_version = None
        latest_release_date = None
        
        for version, release_info in releases.items():
            if not release_info:  # Skip empty release info
                continue
                
            for release in release_info:
                try:
                    release_date = datetime.fromisoformat(release["upload_time"].replace("Z", "+00:00"))
                    if release_date <= target_date:
                        if not latest_release_date or release_date > latest_release_date:
                            latest_release_date = release_date
                            latest_version = version
                except (KeyError, ValueError) as e:
                    print(f"Warning: Could not parse release date for {package_name} {version}. Skipping...")
                    continue
        
        # Save result in cache
        VERSION_CACHE[cache_key] = latest_version
        return latest_version
    
    except requests.exceptions.RequestException as e:
        print(f"Network error fetching info for '{package_name}': {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error parsing PyPI response for '{package_name}'. Invalid JSON.")
        return None
    except Exception as e:
        print(f"Unexpected error processing '{package_name}': {e}")
        return None

def process_single_package(package_name, date):
    version = get_package_version_as_of_date(package_name, date)
    if version:
        return f"{package_name}=={version}"
    else:
        print(f"No version found for {package_name} on {date.strftime('%Y-%m-%d')}.")
        return None

def is_requirement_line(line):
    """Check if a line in requirements.txt is a package requirement."""
    line = line.strip()
    # Skip empty lines, comments, and special directives
    if not line or line.startswith('#') or line.startswith('-') or line.startswith('git+'):
        return False
    return True

def parse_package_name(line):
    """Extract package name from a requirement line."""
    # Handle different requirement formats
    if '==' in line:
        return line.split('==')[0].strip()
    elif '>=' in line:
        return line.split('>=')[0].strip()
    elif '<=' in line:
        return line.split('<=')[0].strip()
    elif '~=' in line:
        return line.split('~=')[0].strip()
    elif '>' in line:
        return line.split('>')[0].strip()
    elif '<' in line:
        return line.split('<')[0].strip()
    elif '@' in line:  # Handle URL installations with @ marker
        return line.split('@')[0].strip()
    else:
        return line.strip()

def process_requirements_file(input_file, date, output_file):
    try:
        with open(input_file, "r") as f:
            lines = f.readlines()
        
        updated_requirements = []
        
        for line in tqdm(lines, desc="Processing packages"):
            line = line.strip()
            if not is_requirement_line(line):
                # Keep comments and special lines unchanged
                updated_requirements.append(line)
                continue
                
            package_name = parse_package_name(line)
            if not package_name:
                # If we couldn't parse a package name, keep the line as is
                updated_requirements.append(line)
                continue
                
            versioned_package = process_single_package(package_name, date)
            if versioned_package:
                updated_requirements.append(versioned_package)
        
        # Create output directory if it doesn't exist
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write to output file
        with open(output_file, "w") as f:
            f.write("\n".join(updated_requirements))
        print(f"Updated requirements file saved to: {output_file}")
    
    except FileNotFoundError:
        print(f"Error: Could not find requirements file '{input_file}'")
        sys.exit(1)
    except PermissionError:
        print(f"Error: Permission denied when writing to '{output_file}'")
        sys.exit(1)
    except Exception as e:
        print(f"Error processing requirements file: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Get package versions as of a specific date.")
    parser.add_argument("target", help="Package name or path to requirements.txt")
    parser.add_argument("date", help="Date in various formats (e.g., DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY)")
    parser.add_argument("--output", "-o", help="Custom output file path for requirements (default: requirements_<DATE>.txt)")
    
    args = parser.parse_args()
    
    try:
        # Parse the target date
        target_date = parse_date(args.date)
        formatted_date = target_date.strftime("%Y-%m-%d")
        
        if os.path.isfile(args.target):
            # Process a requirements file
            if args.output:
                output_file = args.output
            else:
                output_file = f"requirements_{args.date}.txt"
            process_requirements_file(args.target, target_date, output_file)
        else:
            # Process a single package
            versioned_package = process_single_package(args.target, target_date)
            if versioned_package:
                print(f"Version of {args.target} on {args.date}: {versioned_package.split('==')[1]}")
    
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(1)

if __name__ == "__main__":
    main()
