use super::sha1_hex;

/// The FIPS 180-4 / RFC 3174 published vectors, plus the two block-boundary
/// lengths a hand-written padding loop gets wrong.
#[test]
fn the_published_vectors_match() {
    assert_eq!(sha1_hex(b""), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
    assert_eq!(sha1_hex(b"abc"), "a9993e364706816aba3e25717850c26c9cd0d89d");
    assert_eq!(
        sha1_hex(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
        "84983e441c3bd26ebaae4aa1f95129e5e54670f1"
    );
    assert_eq!(
        sha1_hex(&b"a".repeat(1_000_000)),
        "34aa973cd4c4daa4f61eeb2bdbad27316534016f"
    );
}

#[test]
fn the_padding_survives_every_block_boundary() {
    // 55/56/57 bytes straddle the point where the length no longer fits in the
    // final block, which is where a padding loop that counts wrong shows up.
    assert_eq!(
        sha1_hex(&b"x".repeat(55)),
        "cef734ba81a024479e09eb5a75b6ddae62e6abf1"
    );
    assert_eq!(
        sha1_hex(&b"x".repeat(56)),
        "901305367c259952f4e7af8323f480d59f81335b"
    );
    assert_eq!(
        sha1_hex(&b"x".repeat(64)),
        "bb2fa3ee7afb9f54c6dfb5d021f14b1ffe40c163"
    );
}

#[test]
fn the_tag_is_eight_hex_characters_of_a_path() {
    // What the roster actually consumes: the first 8 characters of the digest
    // of a path, which must be stable byte-for-byte across both CLIs.
    assert_eq!(&sha1_hex(b"src/a.ts")[..8], "21ff24dd");
}
