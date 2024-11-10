import requests
import argparse
from datetime import datetime
from tqdm import tqdm
import os

def get_package_version_as_of_date(package_name, target_date):
    """Fetch the version of a package available on a specific date from PyPI."""
    url = f"https://pypi.org/pypi/{package_name}/json"
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Failed to fetch info for {package_name}. Skipping...")
        return None
    
    data = response.json()
    releases = data.get("releases", {})
    
    # Convert the target date to a datetime object
    target_date = datetime.strptime(target_date, "%Y-%m-%d")
    
    # Find the latest release on or before the target date
    latest_version = None
    latest_release_date = None
    
    for version, release_info in releases.items():
        for release in release_info:
            release_date = datetime.fromisoformat(release["upload_time"].replace("Z", "+00:00"))
            if release_date <= target_date:
                if not latest_release_date or release_date > latest_release_date:
                    latest_release_date = release_date
                    latest_version = version
    
    return latest_version

def process_single_package(package_name, date):
    version = get_package_version_as_of_date(package_name, date)
    if version:
        return f"{package_name}=={version}"
    else:
        print(f"No version found for {package_name} on {date}.")
        return None

def process_requirements_file(input_file, date, output_file):
    with open(input_file, "r") as f:
        lines = f.readlines()
    
    updated_requirements = []
    for line in tqdm(lines, desc="Processing packages"):
        package_name = line.split("==")[0].strip()  # Strip version if present
        versioned_package = process_single_package(package_name, date)
        if versioned_package:
            updated_requirements.append(versioned_package)
    
    # Write to output file
    with open(output_file, "w") as f:
        f.write("\n".join(updated_requirements))
    print(f"Updated requirements file saved to: {output_file}")

def main():
    parser = argparse.ArgumentParser(description="Get package versions as of a specific date.")
    parser.add_argument("target", help="Package name with DD-MM-YYYY or path to requirements.txt")
    parser.add_argument("date", help="Date in DD-MM-YYYY format")

    args = parser.parse_args()
    date = datetime.strptime(args.date, "%d-%m-%Y").strftime("%Y-%m-%d")
    
    if os.path.isfile(args.target):
        # Process a requirements file
        output_file = f"requirements_{args.date}.txt"
        process_requirements_file(args.target, date, output_file)
    else:
        # Process a single package
        versioned_package = process_single_package(args.target, date)
        if versioned_package:
            print(f"Version of {args.target} on {args.date}: {versioned_package}")

if __name__ == "__main__":
    main()
