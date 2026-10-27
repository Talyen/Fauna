# Full journey CI repair

The full-journey tests used the first offered recruit after filling the roster
and always replaced the last roster member. With the current catalog and seed
2, that strategy reached defeat in encounter 6. The tests' purpose is to
exercise a genuine journey through victory, roster growth and deterministic
replay; it does not require replacing a working roster with every later offer.

A bounded hosted comparison retained the established five-creature roster and
reached victory with the existing seed in 528 commands, using the same combat
actor and other decisions. The integration and browser tests now share that
recruitment strategy. They still exercise real commands and retain their
victory, roster, replay and save-round-trip assertions. Separate recruitment
coverage exercises replacement choices.

A separate diagnostic for seed 6 found a long battle with a solo Cadenza and
no remaining direct damage after other creatures fell; the apparent repeated
Memento card ID was a Cadenza card whose stable ID survived a swap. This is not
evidence of an invalid card choice or by itself proof of a gameplay defect.
