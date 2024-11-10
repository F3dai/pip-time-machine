# Package version finder

`get_version.py` is a Python script to find package versions available on a specific date. It supports fetching a single package version or creating a new `requirements.txt` with versions as of a target date.

This helps address poor requirements.txt files leading to frustrating conflicts.

## Features

- **Single Package Version**: Retrieve the version of a package available as of a specific date.
- **Requirements File**: Generate a new `requirements.txt` with versions available on the specified date.

## Installation

Install dependencies with:

```bash
pip install -r requirements.txt
```

## Requirements:

- requests
- tqdm

## Usage
```bash
python get_version.py -h
```
### Get a Single Package Version
```bash
python get_version.py <package_name> <DD-MM-YYYY>
```
Example:

```bash
python get_version.py pandas 12-07-2023
```
### Generate a Requirements File
Provide a requirements.txt file path to create a versioned requirements file as of the specified date.
```bash
python get_version.py /path/to/requirements.txt <DD-MM-YYYY>
```
Example:
```bash
python get_version.py requirements.txt 12-07-2023
```
Output file will be named `requirements_<DD-MM-YYYY>.txt`.

## Disclaimer

This isn't a robust solution, and can be very slow for packages with a lot of releases. Please feel free to improve this project. Thanks :)