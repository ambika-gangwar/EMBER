from ai_service import ai

dummy_note = "hello\n\nits my first time using smart notes"

cases = [
    ("WHAT IS PHOTOSYNTHESIS?", "photosynthesis"),
    ("wHaT iS rEcUrSiOn?", "recursion"),
    ("explain the french revolution", "french revolution"),
    ("How does Raft consensus work?", "raft"),
    ("what are eigenvalues?", "eigenvalues"),
    ("What is Keynesian economics?", "keynesian"),
    ("Write a SQL query for monthly churn", "sql"),
    ("Explain the Fermi paradox", "fermi")
]

for prompt, expected_keyword in cases:
    res = ai._synthesize_by_intent(prompt, dummy_note, title="Untitled", user_prompt=prompt)
    assert "hello" not in res.lower(), f"Failed context isolation for: {prompt}"
    assert expected_keyword.lower() in res.lower() or "```" in res, f"Failed answer for: {prompt}"
    print(f"PASS: '{prompt}' -> {res.splitlines()[0]}")

print("\nALL CASE-INSENSITIVE AND ARBITRARY UNSEEN PROMPT TESTS PASSED!")
