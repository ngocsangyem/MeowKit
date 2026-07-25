"""Test-only environment isolation for multimodal script tests."""

import env_utils


def disable_env_file_loading():
    """Prevent production modules imported by a test from reading local .env files."""
    env_utils.load_env_files = lambda: None
