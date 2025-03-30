# Pip Time Machine

Find Python package versions available on a specific date. Solve dependency conflicts by pinning your dependencies to versions that existed on a specific date. This is also useful when trying to get an unmaintained project working due to version conflicts.

Available as both a command-line tool and a web interface.

## Features

- **Single Package Version**: Retrieve the version of a package available as of a specific date.
- **Requirements File**: Generate a new `requirements.txt` with versions available on the specified date.
- **Web Interface**: Use the tool directly in your browser with no installation required.

## Web Interface

You can use the web interface directly at [https://f3dai.github.io/pip-time-machine](https://f3dai.github.io/pip-time-machine).

## Command Line Usage

For those who prefer using the command line, you can run the Python script directly.

### Installation

Clone this repository and install dependencies:

```bash
git clone https://github.com/f3dai/pip-time-machine.git
cd pip-time-machine
pip install -r requirements.txt
```

### Requirements:

- requests
- tqdm
- DateTime

### CLI Commands

Get help:
```bash
python get_versions.py -h
```

Get a single package version:
```bash
python get_versions.py <package_name> <DD-MM-YYYY>
```

Example:
```bash
python get_versions.py pandas 12-07-2023
```

Generate a requirements file with pinned versions:
```bash
python get_versions.py /path/to/requirements.txt <DD-MM-YYYY> [--output output_path.txt]
```

Example:
```bash
python get_versions.py requirements.txt 12-07-2023
```

By default, the output file will be named `requirements_<DD-MM-YYYY>.txt`. Use the `--output` parameter to specify a different output path.

## How It Works

The tool queries the PyPI JSON API to find package release dates and selects the most recent version that was available before or on your target date. This approach helps recreate the exact package environment that existed at a point in time.

## Disclaimer

This isn't a robust solution and can be slow for packages with many releases. It's intended as a helpful utility rather than a production-grade dependency resolver.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.