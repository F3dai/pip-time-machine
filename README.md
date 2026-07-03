# Pip Time Machine

Find Python package versions available on a specific date. Solve dependency conflicts by pinning your dependencies to versions that existed on a specific date. This is also useful when trying to get an unmaintained project working due to version conflicts.

Available as both a command-line tool and a web interface.

## Features

- **Single Package Version**: Retrieve the version of a package available as of a specific date.
- **Requirements File**: Generate a new `requirements.txt` with versions available on the specified date.
- **Web Interface**: Use the tool directly in your browser with no installation required.
- **Sensible defaults**: Yanked releases are skipped, and pre-releases are excluded unless you opt in with `--pre`.

## Web Interface

You can use the web interface directly at [https://f3dai.github.io/pip-time-machine](https://f3dai.github.io/pip-time-machine).

## Command Line Usage

For those who prefer using the command line, you can run the Python script directly.

### Installation

Install as a command (recommended):

```bash
pipx install git+https://github.com/f3dai/pip-time-machine.git
```

This provides a `pip-time-machine` command. Or clone and install dependencies to run the script directly:

```bash
git clone https://github.com/f3dai/pip-time-machine.git
cd pip-time-machine
pip install -r requirements.txt
```

Dependencies: `requests`, `tqdm`, `packaging`.

### CLI Commands

Dates use ISO format (`YYYY-MM-DD`). Month-name formats such as `12 Jul 2023`
are also accepted. Examples below use `python get_versions.py`; if you
installed with pipx, use `pip-time-machine` instead.

Get help:
```bash
python get_versions.py -h
```

Get a single package version:
```bash
python get_versions.py <package_name> <YYYY-MM-DD>
```

Example:
```bash
python get_versions.py pandas 2023-07-12
```

Generate a requirements file with pinned versions:
```bash
python get_versions.py /path/to/requirements.txt <YYYY-MM-DD> [--output output_path.txt]
```

Example:
```bash
python get_versions.py requirements.txt 2023-07-12
```

By default, the output file will be named `requirements_<YYYY-MM-DD>.txt`. Use the `--output` parameter to specify a different output path.

Additional options:

- `-s, --specifier` — version specifier to emit (`==`, `>=`, `~=`, `<=`; default `==`).
- `--pre` — include pre-release versions (excluded by default).

## How It Works

The tool queries the PyPI JSON API to find package release dates and selects the most recent version that was available before or on your target date. This approach helps recreate the exact package environment that existed at a point in time.

## Disclaimer

This isn't a robust solution and can be slow for packages with many releases. It's intended as a helpful utility rather than a production-grade dependency resolver.

## Development

Install with dev dependencies and run the test suite:

```bash
pip install -e ".[dev]"
pytest
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Released under the [MIT License](LICENSE).