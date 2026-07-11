from .models import ClaimState

TERMINAL = {
    ClaimState.COMPLETE,
    ClaimState.INSUFFICIENT_EVIDENCE,
    ClaimState.FAILED,
}
ALLOWED = {
    ClaimState.CAPTURING: {ClaimState.TRANSCRIBING, ClaimState.FAILED},
    ClaimState.TRANSCRIBING: {ClaimState.CLAIM_CANDIDATE, ClaimState.FAILED},
    ClaimState.CLAIM_CANDIDATE: {ClaimState.CHECKING, ClaimState.FAILED},
    ClaimState.CHECKING: {
        ClaimState.EVIDENCE_READY,
        ClaimState.INSUFFICIENT_EVIDENCE,
        ClaimState.FAILED,
    },
    ClaimState.EVIDENCE_READY: {
        ClaimState.SYNTHESIZING,
        ClaimState.INSUFFICIENT_EVIDENCE,
        ClaimState.FAILED,
    },
    ClaimState.SYNTHESIZING: {
        ClaimState.COMPLETE,
        ClaimState.INSUFFICIENT_EVIDENCE,
        ClaimState.FAILED,
    },
}


def transition(current: ClaimState, target: ClaimState) -> ClaimState:
    if current in TERMINAL or target not in ALLOWED.get(current, set()):
        raise ValueError(f"invalid transition: {current} -> {target}")
    return target
