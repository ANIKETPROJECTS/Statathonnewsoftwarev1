# How AIRAVATA DEA Anonymizes Your Data

A plain-English, step-by-step guide with real examples.

---

## The Big Picture

When you anonymize a column, the tool takes each cell value (like `4532`) and scrambles it in a way that:

- Keeps the **same format** — a 4-digit number stays a 4-digit number
- Is **fully reversible** — if you have the key, you can always get the original back
- Looks **completely different** — `4532` becomes something like `5406`

The scrambling is driven entirely by a **key** — a long secret number. Without the key, the scrambled value is meaningless.

---

## What Is a "Seed" and What Is a "Key"?

Think of a **seed** as a simple number you choose — like `42`, `1337`, `2024`, `9`.

Think of a **key** as a much longer, complex number (64 characters of letters and digits) that is *generated from* your seed. You provide 4 seeds, and the tool generates 4 separate keys — one for each encryption round.

You can also provide a hex key directly instead of seeds — the tool will split it into 4 sub-keys automatically.

**Why 4 keys instead of 1?**
One round of scrambling could theoretically be reversed by guessing. Four independent rounds make that practically impossible.

---

## A Real Example: Encrypting `4532`

Using master key: `01afa91809dda44cfbc78de1d96b4a2ca6094b6f8812aeecc2a00d6fc3afd4c3`

---

### Step 1 — Split Your Master Key into 4 Round Keys

The system takes the first part of your key, mixes it with a mathematical constant, and generates 4 brand-new independent keys using a chain formula:

```
rolling₀ = (first 8 chars of your key) XOR 0xDEADBEEF

For each round i from 0 to 3:
  rolling  = (rolling × golden_ratio_constant) XOR (i × mixing_constant)
  rolling  = rolling XOR (rolling shifted right 16 bits)
  Key[i]   = generate_256_bit_key(rolling)
```

This produces:

| Round | Key (first 16 chars shown) |
|-------|---------------------------|
| Key 1 | `33d7b9eccb66a894…` |
| Key 2 | `0161e0dac1525cbb…` |
| Key 3 | `e5f766c29e19fe09…` |
| Key 4 | `975e698fbd4ba955…` |

> **Simple version:** Your one key is expanded into 4 secret keys using a chain of math operations. Changing any seed changes all 4 keys.

---

### Step 2 — Create a Column "Fingerprint" (IV)

To make sure the same value in *different columns* encrypts to *different results*, the tool creates a unique fingerprint for each column by hashing the column name together with each round key:

```
Column fingerprint = hash(Key[i] + "COL" + column_name)
```

So `4532` in a column called `"age"` will encrypt differently than `4532` in a column called `"income"` — even using the same keys.

> **Simple version:** Each column gets its own secret fingerprint so values can't be cross-matched between columns.

---

### Step 3 — Generate a Stream of Random Bytes

For each round, the tool creates a stream of random-looking bytes by running a fast random number generator (called xorshift128+) seeded with:

```
seed = Key[i][first 8 chars as number] XOR column_fingerprint
```

These bytes are what drive the actual shifting of each character:

| Round | First 4 random bytes generated |
|-------|-------------------------------|
| 1     | 4, 28, 37, 164                |
| 2     | 251, 106, 5, 136              |
| 3     | 191, 225, 235, 75             |
| 4     | 249, 151, 69, 121             |

> **Simple version:** Each round produces a different stream of "dice rolls" that decide how much each character gets shifted.

---

### Step 4 — Shift Each Character (4 Rounds)

This is the actual scrambling. Each character is shifted within its own alphabet (digits stay digits, letters stay letters) by at least 1 step, plus a random extra step from the keystream bytes.

**The shift formulas:**

```
For a regular digit character (0–9):
  new_digit = (old_digit + 1 + (keystream_byte mod 9)) mod 10

For the leading digit of a number (1–9, never produces 0):
  new_digit = ((old_digit - 1) + 1 + (keystream_byte mod 8)) mod 9 + 1

For uppercase letter (A–Z):
  new_letter = (old_letter + 1 + (keystream_byte mod 25)) mod 26

For lowercase letter (a–z):
  new_letter = (old_letter + 1 + (keystream_byte mod 25)) mod 26
```

The `+1` in every formula is the **minimum guaranteed shift** — the output can never accidentally equal the input.

---

**Round 1: `"4532"` → `"9755"`**

| Char | Old digit | Random byte (k) | Formula | New digit |
|------|-----------|-----------------|---------|-----------|
| `4`  | 4 (leading) | k=4, k%8=4 | `49 + ((3+1+4+81) % 9)` | **9** |
| `5`  | 5 | k=28, k%9=1 | `48 + ((5+1+1) % 10)` | **7** |
| `3`  | 3 | k=37, k%9=1 | `48 + ((3+1+1) % 10)` | **5** |
| `2`  | 2 | k=164, k%9=2 | `48 + ((2+1+2) % 10)` | **5** |

Result: `"4532"` → **`"9755"`**

---

**Round 2: `"9755"` → `"4517"`**

| Char | Old digit | Random byte (k) | Formula | New digit |
|------|-----------|-----------------|---------|-----------|
| `9`  | 9 (leading) | k=251, k%8=3 | `49 + ((8+1+3+81) % 9)` | **4** |
| `7`  | 7 | k=106, k%9=7 | `48 + ((7+1+7) % 10)` | **5** |
| `5`  | 5 | k=5, k%9=5 | `48 + ((5+1+5) % 10)` | **1** |
| `5`  | 5 | k=136, k%9=1 | `48 + ((5+1+1) % 10)` | **7** |

Result: `"9755"` → **`"4517"`**

---

**Round 3: `"4517"` → `"3631"`**

| Char | Old digit | Random byte (k) | Formula | New digit |
|------|-----------|-----------------|---------|-----------|
| `4`  | 4 (leading) | k=191, k%8=7 | `49 + ((3+1+7+81) % 9)` | **3** |
| `5`  | 5 | k=225, k%9=0 | `48 + ((5+1+0) % 10)` | **6** |
| `1`  | 1 | k=235, k%9=1 | `48 + ((1+1+1) % 10)` | **3** |
| `7`  | 7 | k=75, k%9=3 | `48 + ((7+1+3) % 10)` | **1** |

Result: `"4517"` → **`"3631"`**

---

**Round 4: `"3631"` → `"5406"`**

| Char | Old digit | Random byte (k) | Formula | New digit |
|------|-----------|-----------------|---------|-----------|
| `3`  | 3 (leading) | k=249, k%8=1 | `49 + ((2+1+1+81) % 9)` | **5** |
| `6`  | 6 | k=151, k%9=7 | `48 + ((6+1+7) % 10)` | **4** |
| `3`  | 3 | k=69, k%9=6 | `48 + ((3+1+6) % 10)` | **0** |
| `1`  | 1 | k=121, k%9=4 | `48 + ((1+1+4) % 10)` | **6** |

Result: `"3631"` → **`"5406"`**

---

### Step 5 — Tiebreaker Check

After all 4 rounds, the tool checks: does the output accidentally equal the original input?

```
If encrypted == original:
  Apply a 5th extra round using a blended key
  (all 4 keystreams XOR-ed together)
Else:
  Done — output is guaranteed different from input
```

In our example: `5406 ≠ 4532` ✅ — no tiebreaker needed.

---

### Final Result

```
Original:  4532
           ↓ Round 1 (Key 1)
           9755
           ↓ Round 2 (Key 2)
           4517
           ↓ Round 3 (Key 3)
           3631
           ↓ Round 4 (Key 4)
Encrypted: 5406
```

---

## How Decryption Works

Decryption is the exact reverse — run rounds 4, 3, 2, 1 in reverse order, subtracting instead of adding:

```
For a digit:
  old_digit = (new_digit - 1 - (keystream_byte mod 9) + 100) mod 10
```

The `+100` ensures the result never goes negative before the mod operation.

As long as you have the same key and column name, `5406` always decrypts back to `4532`.

---

## Why This Is Safe

| Property | How it's achieved |
|----------|------------------|
| **Format preserved** | Only shifts within the same alphabet (digit→digit, letter→letter) |
| **Always different** | +1 minimum shift in every character, every round |
| **4× harder to reverse** | 4 independent keys, each from a different step in the chain |
| **Column-safe** | Same value encrypts differently in different columns (column IV) |
| **Fully reversible** | Every operation has an exact mathematical inverse |
| **Seed-order matters** | Swapping seed 1 and seed 2 changes all 4 keys completely |

---

## Key Modes Summary

| Mode | What you provide | How 4 keys are made |
|------|-----------------|---------------------|
| **Seed mode** | 4 numbers (e.g. 42, 137, 2024, 7) | Rolling Horner-fold: each seed folds into a running accumulator |
| **Passphrase mode** | A text phrase | Each round appends a unique tag (`\x00R0`, `\x00R1`…) before hashing |
| **Hex key mode** | 64-char hex string | First 8 chars seed a chain that generates 4 independent sub-keys |

In all three modes, **the order matters** — changing the sequence of seeds produces completely different encryption.
