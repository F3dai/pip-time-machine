"""Tests for pip-time-machine's version-resolution logic."""

from datetime import datetime

import pytest

import get_versions
from get_versions import (
    get_version,
    is_prerelease,
    is_requirement,
    parse_date,
    parse_package_name,
)


# --- date parsing ---------------------------------------------------------

def test_parse_date_iso():
    assert parse_date("2023-07-12") == datetime(2023, 7, 12)


def test_parse_date_month_name():
    assert parse_date("12 Jul 2023") == datetime(2023, 7, 12)


def test_parse_date_rejects_ambiguous_numeric():
    # 03/04/2023 could be Mar 4 or Apr 3, so it is intentionally unsupported.
    with pytest.raises(ValueError):
        parse_date("03/04/2023")


def test_parse_date_rejects_garbage():
    with pytest.raises(ValueError):
        parse_date("not a date")


# --- line parsing ---------------------------------------------------------

@pytest.mark.parametrize("line,expected", [
    ("requests==2.0", "requests"),
    ("Flask>=1.0,<2.0", "Flask"),
    ("my-pkg[extra]", "my-pkg"),
    ("# comment", None),  # leading '#' isn't part of a name
])
def test_parse_package_name(line, expected):
    assert parse_package_name(line) == expected


@pytest.mark.parametrize("line,expected", [
    ("requests==2.0", True),
    ("", False),
    ("# comment", False),
    ("-e .", False),
    ("git+https://example.com/x.git", False),
])
def test_is_requirement(line, expected):
    assert bool(is_requirement(line)) is expected


# --- pre-release detection ------------------------------------------------

@pytest.mark.parametrize("version,expected", [
    ("1.0.0", False),
    ("2.31.0", False),
    ("1.0.0rc1", True),
    ("1.0.0a1", True),
    ("1.0.0b2", True),
    ("1.0.0.dev3", True),
])
def test_is_prerelease(version, expected):
    assert is_prerelease(version) is expected


# --- get_version (mocked PyPI) -------------------------------------------

class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload


SAMPLE = {
    "releases": {
        "1.0.0": [{"upload_time": "2023-01-01T00:00:00", "yanked": False}],
        "1.1.0": [{"upload_time": "2023-06-01T00:00:00", "yanked": False}],
        "1.2.0rc1": [{"upload_time": "2023-06-15T00:00:00", "yanked": False}],
        "1.2.0": [{"upload_time": "2023-09-01T00:00:00", "yanked": False}],
        "1.1.5": [{"upload_time": "2023-05-01T00:00:00", "yanked": True}],
    }
}


@pytest.fixture(autouse=True)
def _clear_cache():
    get_versions.VERSION_CACHE.clear()
    yield
    get_versions.VERSION_CACHE.clear()


@pytest.fixture
def mock_pypi(monkeypatch):
    def _install(payload, status_code=200):
        monkeypatch.setattr(
            get_versions.requests,
            "get",
            lambda *a, **k: FakeResponse(payload, status_code),
        )
    return _install


def test_selects_latest_before_date(mock_pypi):
    mock_pypi(SAMPLE)
    assert get_version("pkg", datetime(2023, 7, 1)) == "1.1.0"


def test_excludes_prerelease_by_default(mock_pypi):
    mock_pypi(SAMPLE)
    # On 2023-08-01 the newest stable is 1.1.0; 1.2.0rc1 must not win.
    assert get_version("pkg", datetime(2023, 8, 1)) == "1.1.0"


def test_includes_prerelease_when_requested(mock_pypi):
    mock_pypi(SAMPLE)
    assert get_version("pkg", datetime(2023, 8, 1), include_pre=True) == "1.2.0rc1"


def test_skips_yanked_releases(mock_pypi):
    mock_pypi(SAMPLE)
    # 1.1.5 (yanked, 2023-05-01) must never be chosen even though it is newer
    # than 1.0.0 on 2023-05-15.
    assert get_version("pkg", datetime(2023, 5, 15)) == "1.0.0"


def test_returns_none_when_not_found(mock_pypi):
    mock_pypi({}, status_code=404)
    assert get_version("nope", datetime(2023, 1, 1)) is None
