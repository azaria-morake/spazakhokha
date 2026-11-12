"""
offline_models.py
Data schemas for SpazaKhokha offline allowance pre-allocation,
local sequence tracking, and payment notes exchanged via QR code.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class AllowanceStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXHAUSTED = "EXHAUSTED"
    EXPIRED = "EXPIRED"
    SETTLED = "SETTLED"


class AllowanceLimits(BaseModel):
    currency: str = Field(default="ZAR", description="ISO 4217 currency code")
    asset_scale: int = Field(default=2, description="Minor unit scale (2 means cents)")
    max_amount_cents: int = Field(..., gt=0, description="Total pre-allocated allowance cap in cents")
    max_amount_formatted: Optional[str] = Field(default=None, description="Human-readable amount e.g. R50.00")
    spent_amount_cents: int = Field(default=0, ge=0, description="Cumulative amount spent so far")
    remaining_amount_cents: Optional[int] = Field(default=None, ge=0, description="Remaining spendable balance")

    @model_validator(mode="after")
    def compute_defaults_and_validate(self):
        if not self.max_amount_formatted:
            self.max_amount_formatted = f"R{self.max_amount_cents / (10 ** self.asset_scale):.2f}"

        computed_remaining = self.max_amount_cents - self.spent_amount_cents
        if self.remaining_amount_cents is None:
            self.remaining_amount_cents = max(0, computed_remaining)

        if self.spent_amount_cents > self.max_amount_cents:
            raise ValueError(
                f"spent_amount_cents ({self.spent_amount_cents}) cannot exceed "
                f"max_amount_cents ({self.max_amount_cents})"
            )
        return self


class CustomerIdentity(BaseModel):
    wallet_address: str = Field(..., description="Open Payments customer wallet address")
    public_key_hex: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="32-byte Ed25519 public key in hexadecimal format (64 hex characters)"
    )


class SequenceCounters(BaseModel):
    current_sequence: int = Field(default=0, ge=0, description="Last used monotonic note counter")
    max_sequence_allowed: int = Field(default=20, gt=0, description="Safety bound on notes per session")


class GnapGrantMetadata(BaseModel):
    access_token: str = Field(..., description="Open Payments GNAP access token value")
    token_manage_uri: Optional[str] = Field(default=None, description="URI to rotate or inspect the token")
    continue_uri: Optional[str] = Field(default=None, description="GNAP interaction continuation endpoint")
    continue_token: Optional[str] = Field(default=None, description="Bearer token for GNAP continue endpoint")


class CustomerAllowance(BaseModel):
    """
    Stored locally on customer's device inside customer_allowance.json.
    Tracks pre-allocated funds, active GNAP credentials, and offline signing keys.
    """
    allowance_id: str = Field(..., description="Unique URN UUID identifying this offline session")
    version: int = Field(default=1, description="Schema revision number")
    status: AllowanceStatus = Field(default=AllowanceStatus.ACTIVE, description="Lifecycle status")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(..., description="Expiry timestamp after which notes are invalid")
    limits: AllowanceLimits
    customer: CustomerIdentity
    counters: SequenceCounters = Field(default_factory=SequenceCounters)
    gnap_grant: GnapGrantMetadata

    def is_expired(self) -> bool:
        now = datetime.now(timezone.utc)
        target_expiry = self.expires_at if self.expires_at.tzinfo else self.expires_at.replace(tzinfo=timezone.utc)
        return now > target_expiry

    def can_spend(self, amount_cents: int) -> bool:
        if self.status != AllowanceStatus.ACTIVE:
            return False
        if self.is_expired():
            return False
        if self.counters.current_sequence >= self.counters.max_sequence_allowed:
            return False
        if (self.limits.spent_amount_cents + amount_cents) > self.limits.max_amount_cents:
            return False
        return True


class PaymentNote(BaseModel):
    """
    The compact payload transmitted from Customer to Merchant via QR code.
    Contains no secrets/tokens, only cryptographic proof and spending parameters.
    """
    allowance_id: str = Field(..., description="UUID matching the parent CustomerAllowance")
    customer_wallet: str = Field(..., description="Open Payments wallet address of payer")
    customer_public_key: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="32-byte Ed25519 public key in hexadecimal format"
    )
    sequence_number: int = Field(..., ge=1, description="Strictly incrementing counter (1, 2, 3...)")
    amount_cents: int = Field(..., gt=0, description="Purchase amount in cents")
    currency: str = Field(default="ZAR")
    max_allowance_cents: int = Field(..., gt=0, description="Total allowance cap verified by merchant")
    merchant_wallet: str = Field(..., description="Target Open Payments merchant wallet address")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(..., description="Grant expiry timestamp matching allowance")
    signature_hex: Optional[str] = Field(default=None, description="64-byte Ed25519 signature in hex (128 chars)")

    def canonical_bytes(self) -> bytes:
        ts_str = self.timestamp.isoformat()
        exp_str = self.expires_at.isoformat()

        raw_str = (
            f"allowance_id={self.allowance_id}&"
            f"amount_cents={self.amount_cents}&"
            f"currency={self.currency}&"
            f"customer_public_key={self.customer_public_key}&"
            f"customer_wallet={self.customer_wallet}&"
            f"expires_at={exp_str}&"
            f"max_allowance_cents={self.max_allowance_cents}&"
            f"merchant_wallet={self.merchant_wallet}&"
            f"sequence_number={self.sequence_number}&"
            f"timestamp={ts_str}"
        )
        return raw_str.encode("utf-8")


if __name__ == "__main__":
    sample_json = {
        "allowance_id": "urn:uuid:8f1e29c3-9b22-4a7b-a2c1-d4e5f6789abc",
        "version": 1,
        "status": "ACTIVE",
        "created_at": "2026-11-02T08:00:00Z",
        "expires_at": "2026-11-02T20:00:00Z",
        "limits": {
            "currency": "ZAR",
            "asset_scale": 2,
            "max_amount_cents": 5000,
            "max_amount_formatted": "R50.00",
            "spent_amount_cents": 0,
            "remaining_amount_cents": 5000,
        },
        "customer": {
            "wallet_address": "https://ilp.interledger-test.dev/customer-wallet",
            "public_key_hex": "3d4f2bf07dc1be38b20cd6eab500a5ecd561e114f201e3fb863f5cd973499182",
        },
        "counters": {
            "current_sequence": 0,
            "max_sequence_allowed": 20,
        },
        "gnap_grant": {
            "access_token": "GNAP_OAUTH_ACCESS_TOKEN_VALUE",
            "token_manage_uri": "https://auth.interledger-test.dev/token/manage/abc123xyz",
            "continue_uri": "https://auth.interledger-test.dev/continue/def456uvw",
            "continue_token": "GNAP_CONTINUE_MANAGEMENT_TOKEN",
        },
    }

    # Validate parsing
    allowance = CustomerAllowance.model_validate(sample_json)
    print(f"[OK] Parsed Allowance ID: {allowance.allowance_id}")
    print(f"[OK] Remaining Spend: R{allowance.limits.remaining_amount_cents / 100:.2f}")
    print(f"[OK] Can spend R20.00: {allowance.can_spend(2000)}")
    print(f"[OK] Can spend R60.00 (exceeds cap): {allowance.can_spend(6000)}")