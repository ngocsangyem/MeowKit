"""API key rotation for rate-limited free tier.

Rotates through GEMINI_API_KEY, GEMINI_API_KEY_2, ..., GEMINI_API_KEY_4
on 429/RESOURCE_EXHAUSTED errors. Silent on success, logs on rotation.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from env_utils import _env


class KeyRotator:
    """Rotate API keys on rate limit errors.

    Instantiate ONCE in main(), pass to analyze_file() as param.
    Cap total attempts at len(keys) * max_retries.
    """

    def __init__(self, max_retries=3):
        self.keys = []
        self.current_index = 0
        self.total_attempts = 0
        self._load_keys()
        self.max_total_attempts = len(self.keys) * max_retries if self.keys else 0

    def _load_keys(self):
        primary = _env('GEMINI_API_KEY')
        if primary:
            self.keys.append(primary)
        for i in range(2, 5):
            key = _env(f'GEMINI_API_KEY_{i}')
            if key:
                self.keys.append(key)

    @property
    def current_key(self):
        if not self.keys:
            return None
        return self.keys[self.current_index]

    def rotate(self):
        """Rotate to next key. Returns new key or None if all attempts exhausted."""
        self.total_attempts += 1
        if self.total_attempts >= self.max_total_attempts:
            return None
        if len(self.keys) <= 1:
            return None
        self.current_index = (self.current_index + 1) % len(self.keys)
        return self.keys[self.current_index]

    @property
    def has_more_keys(self):
        return len(self.keys) > 1

    def __repr__(self):
        return f"KeyRotator(keys={len(self.keys)}, current={self.current_index})"
