import pytest
from pydantic import ValidationError
from app.domain.models import ClaimState, Verdict
from app.domain.state import transition

def test_state_machine_happy_path_and_terminal_guard():
    state = ClaimState.CAPTURING
    for target in list(ClaimState)[1:7]:
        state = transition(state, target)
    assert state is ClaimState.COMPLETE
    with pytest.raises(ValueError): transition(state, ClaimState.CAPTURING)

def test_state_machine_rejects_skips():
    with pytest.raises(ValueError): transition(ClaimState.CAPTURING, ClaimState.CHECKING)
    with pytest.raises(ValueError): transition(ClaimState.CAPTURING, ClaimState.COMPLETE)

def test_confidence_validation():
    with pytest.raises(ValidationError):
        Verdict(label="Supported", confidence=2, explanation="x", uncertainty="x", counterevidence_summary="x", citation_ids=["a", "b"])
