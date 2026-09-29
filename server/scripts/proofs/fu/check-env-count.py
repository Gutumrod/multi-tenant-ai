#!/usr/bin/env python3
"""H7-FU-RATELIMIT - the environment-variable count self-check.

WHY THIS EXISTS: the header of ``server/.env.example`` states, in words, how many
variables the server reads. That stated number has already been wrong twice
("ten", then "twelve") and nothing in the repository caught it, because nothing
ever compared the sentence with the file it describes. This script performs that
comparison mechanically, so the header cannot drift away from the file again.

WHAT IT DOES:

  (a) counts the REAL assignment lines in ``server/.env.example`` - lines matching
      ``^[A-Z][A-Z0-9_]*=``, which excludes every commented-out line (those start
      with '#') and every indented example;
  (b) reads the spelled-out number from that file's header line and converts the
      English word to an integer;
  (c) EXITS NON-ZERO, printing both numbers, when they disagree.

It exits 0 only when the header states the true count.

Usage:

    python3 server/scripts/proofs/fu/check-env-count.py

The filename and extension are fixed by the work unit that required this helper
(``server/scripts/proofs/fu/check-env-count.py``). It is written in Python to match
that name, and it needs only the standard library, so it runs on a clean checkout
with any Python 3 interpreter. The repository's other proof scripts are Node ESM
(``*.mjs``); this one is the exception the work unit asked for.

It reads exactly one file, opens no socket and touches nothing else.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# This file lives at server/scripts/proofs/fu/check-env-count.py, so the server
# directory is three levels up.
SERVER_DIR = Path(__file__).resolve().parents[3]
ENV_EXAMPLE_PATH = SERVER_DIR / ".env.example"

# A real assignment line: NAME= at column 0. Commented lines never match, because
# they begin with '#'; indented examples never match, because they begin with space.
ASSIGNMENT_RE = re.compile(r"^[A-Z][A-Z0-9_]*=")

# English number words the header may legitimately use, as integers.
NUMBER_WORDS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "twenty-one": 21,
    "twenty-two": 22,
    "twenty-three": 23,
    "twenty-four": 24,
    "twenty-five": 25,
    "twenty-six": 26,
    "twenty-seven": 27,
    "twenty-eight": 28,
    "twenty-nine": 29,
    "thirty": 30,
}

# A header line only counts as the completeness claim if it asserts completeness.
COMPLETENESS_RE = re.compile(
    r"\b(complete set|all the variables|in total|listed here|every variable)\b",
    re.IGNORECASE,
)

# Longest words first, so "twenty-one" is matched before "twenty".
WORD_RE = re.compile(
    r"\b(" + "|".join(sorted(NUMBER_WORDS, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)

CHECK_NAME = "env-count-header-states-the-real-count"


def fail(message: str) -> int:
    print(f"CHECK {CHECK_NAME} FAIL {message}")
    return 1


def main() -> int:
    try:
        text = ENV_EXAMPLE_PATH.read_text(encoding="utf-8")
    except OSError as error:
        return fail(f"could not read {ENV_EXAMPLE_PATH}: {error}")

    lines = text.splitlines()

    # --- (a) count the real assignment lines ---------------------------------
    assignments = [line for line in lines if ASSIGNMENT_RE.match(line)]
    actual_count = len(assignments)

    # --- (b) read the spelled-out number from the header ---------------------
    # Only the leading comment block is searched, so a number word appearing later
    # in a body comment cannot be mistaken for the header's claim.
    header_lines: list[str] = []
    for line in lines:
        if ASSIGNMENT_RE.match(line):
            break  # the first assignment ends the header
        header_lines.append(line)

    stated_word = None
    stated_count = None
    stated_line = None

    for line in header_lines:
        if not COMPLETENESS_RE.search(line):
            continue
        match = WORD_RE.search(line)
        if match:
            stated_word = match.group(1).lower()
            stated_count = NUMBER_WORDS[stated_word]
            stated_line = line.strip()
            break

    if stated_count is None:
        return fail(
            f"no spelled-out count found in the header of {ENV_EXAMPLE_PATH} "
            "(searched the leading comment block for a completeness sentence carrying "
            f"a number word); actual assignment lines = {actual_count}"
        )

    print(f"COUNT actual_assignment_lines={actual_count}")
    print(f'COUNT header_states_word="{stated_word}" header_states_number={stated_count}')
    print(f"COUNT header_line={stated_line!r}")

    if actual_count != stated_count:
        return fail(
            f'header says "{stated_word}" ({stated_count}) but the file has '
            f"{actual_count} assignment line(s); the header must state the real number"
        )

    print(
        f'CHECK {CHECK_NAME} PASS header="{stated_word}" ({stated_count}) '
        f"actual_assignment_lines={actual_count}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
