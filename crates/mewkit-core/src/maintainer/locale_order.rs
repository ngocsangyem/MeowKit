//! An approximation of `String.prototype.localeCompare` for generated output.
//!
//! The committed manifest and reference indexes were ordered by ICU collation,
//! where punctuation sorts before digits, digits before letters, and letters
//! compare case-insensitively before case breaks a tie. Byte order disagrees
//! (`_` and `:` land among the letters), so reproducing the committed order
//! needs this. It covers the ASCII the artifact ids and hook purposes use;
//! anything else falls back to code point order after the letters.
use std::cmp::Ordering;

/// ICU root-collation order of the ASCII punctuation and symbols.
const PUNCTUATION: &str = "_-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$";

fn primary(c: char) -> (u8, u32) {
    if c == ' ' {
        return (0, 0);
    }
    if let Some(index) = PUNCTUATION.find(c) {
        return (1, index as u32);
    }
    if c.is_ascii_digit() {
        return (2, c as u32);
    }
    if c.is_alphabetic() {
        return (3, c.to_lowercase().next().map_or(c as u32, |l| l as u32));
    }
    (4, c as u32)
}

pub fn locale_compare(a: &str, b: &str) -> Ordering {
    let left: Vec<(u8, u32)> = a.chars().map(primary).collect();
    let right: Vec<(u8, u32)> = b.chars().map(primary).collect();
    left.cmp(&right).then_with(|| {
        // Equal at the primary level: lowercase sorts before uppercase.
        for (x, y) in a.chars().zip(b.chars()) {
            if x != y {
                return y.is_lowercase().cmp(&x.is_lowercase());
            }
        }
        Ordering::Equal
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn punctuation_sorts_before_digits_before_letters() {
        assert_eq!(locale_compare("mk:a-b", "mk:a2"), Ordering::Less);
        assert_eq!(locale_compare("a_b", "a-b"), Ordering::Less);
        assert_eq!(locale_compare("a1", "ab"), Ordering::Less);
    }

    #[test]
    fn case_only_breaks_a_tie() {
        assert_eq!(locale_compare("Pre", "pre"), Ordering::Greater);
        assert_eq!(locale_compare("Pre", "prf"), Ordering::Less);
        assert_eq!(locale_compare("ab", "abc"), Ordering::Less);
    }
}
