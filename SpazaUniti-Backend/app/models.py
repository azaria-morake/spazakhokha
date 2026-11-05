import re
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, validator

class CustomerRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Customer full legal/display name")
    username: str = Field(..., min_length=3, max_length=20, description="Strictly alphanumeric username handle")
    cell_number: str = Field(..., min_length=10, max_length=15, description="Mobile number for notifications")
    pin: str = Field(..., min_length=4, max_length=4, description="4-digit counter security PIN")

    @validator("username")
    def validate_username(cls, v: str) -> str:
        clean = v.strip().lstrip("@")
        if not re.match(r"^[a-zA-Z0-9]{3,20}$", clean):
            raise ValueError("Username must be strictly alphanumeric (3-20 characters, no symbols or spaces)")
        return clean.lower()

    @validator("pin")
    def validate_pin(cls, v: str) -> str:
        if not re.match(r"^\d{4}$", v.strip()):
            raise ValueError("Security PIN must be exactly 4 digits (e.g. 1234)")
        return v.strip()

class CustomerResponse(BaseModel):
    customer_id: str
    username: str
    handle: str
    full_name: str
    cell_number: str
    open_payments_id: str
    wallet_address_url: str
    balance: float
    asset_code: str = "ZAR"
    asset_scale: int = 2
    status: str
    created_at: str
    ubuntu_tokens: Dict[str, float] = {}
    total_ubuntu_tokens: float = 0.0
    cashout_eligible: bool = False
    min_cashout_threshold: float = 20.0

class CashoutRequest(BaseModel):
    unit_id: str = "unit-104"
    amount: float = 20.00
    purpose: str = "Taxi / Transportation Allowance"

class CashoutResponse(BaseModel):
    success: bool
    amount_cashed_out: float
    remaining_tokens: float
    unit_id: str
    new_zar_balance: float
    transaction_ref: str
    receipt_message: str

class SpendTokensRequest(BaseModel):
    unit_id: str = "unit-104"
    amount: float = 16.00
    purpose: str = "Redeem at Store Counter"

class SpendTokensResponse(BaseModel):
    success: bool
    amount_spent: float
    remaining_tokens: float
    unit_id: str
    discount_zar_value: float
    message: str

class WalletAddressResponse(BaseModel):
    """Standard Open Payments Wallet Address Resource specification."""
    id: str
    publicName: str
    assetCode: str = "ZAR"
    assetScale: int = 2
    authServer: str
    resourceServer: str

class CustomerResolveResponse(BaseModel):
    found: bool
    username: str
    handle: str
    full_name: Optional[str] = None
    wallet_address_url: Optional[str] = None
    open_payments_id: Optional[str] = None
    asset_code: str = "ZAR"
    status: Optional[str] = None

class IncomingPaymentCreateRequest(BaseModel):
    amount: Optional[float] = Field(None, gt=0, description="Optional specified amount in ZAR")
    description: Optional[str] = Field("Spaza Uniti Settlement", description="Payment reference note")
    payer_ref: Optional[str] = None

class IncomingPaymentResponse(BaseModel):
    id: str
    wallet_address: str
    amount: Optional[float] = None
    asset_code: str = "ZAR"
    asset_scale: int = 2
    completed: bool = False
    description: str
    created_at: str
    new_balance: Optional[float] = None


class OutgoingPaymentRequestCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Amount to deduct in ZAR")
    merchant_id: Optional[str] = Field("unit-104", description="Merchant identifier (e.g. unit-104)")
    merchant_name: Optional[str] = Field("Mama Zola Spaza", description="Store display name")
    merchant_wallet: Optional[str] = Field(None, description="Merchant Open Payments wallet pointer")
    recipient_wallet: Optional[str] = Field(None, description="Alternative recipient wallet field")
    purpose: str = Field("Counter purchase", description="Goods or tab repayment purpose")


class GrantResponse(BaseModel):
    grant_id: str
    username: str
    handle: str
    amount: float
    currency: str = "ZAR"
    merchant_id: str
    merchant_name: str
    purpose: str
    status: str
    consent_method: Optional[str] = None
    interactive_consent_url: str
    fallback_available: str = "COUNTER_PIN"
    created_at: str
    expires_at: str

class PinVerificationRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=4, description="4-digit customer PIN")

class GrantApprovalResponse(BaseModel):
    grant_id: str
    status: str
    transaction_id: str
    amount: float
    currency: str = "ZAR"
    new_wallet_balance: float
    new_balance: Optional[float] = None
    merchant_name: str
    message: str


class TransactionResponse(BaseModel):
    id: str
    type: str
    counterparty: str
    amount: float
    currency: str = "ZAR"
    purpose: str
    status: str
    ilp_packet_ref: str
    created_at: str

# -----------------------------------------------------------------------------
# Unit Discovery & Storefront Federation Models
# -----------------------------------------------------------------------------
class UnitRegisterRequest(BaseModel):
    id: str = Field(..., min_length=3, max_length=50, description="Unit unique ID (e.g. unit-104)")
    name: str = Field(..., min_length=2, max_length=100, description="Store display name")
    tagline: Optional[str] = "Fresh bakery, staples & cold drinks"
    owner_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    whatsapp: Optional[str] = None
    address: str = Field(..., description="Physical street/section address")
    township: str = Field(..., description="Township or suburb (e.g. Soweto)")
    landmark: Optional[str] = None
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    operating_hours: Optional[str] = "06:00 - 21:00"
    broadcast_enabled: bool = True

class UnitBroadcastPayload(BaseModel):
    broadcast_enabled: bool = True
    status: Optional[str] = "OPEN"
    promotions: Optional[List[Dict[str, Any]]] = []
    loyalty_program: Optional[Dict[str, Any]] = None
    loyalty_programs: Optional[List[Dict[str, Any]]] = []
    jobs: Optional[List[Dict[str, Any]]] = []

class UnitSummaryResponse(BaseModel):
    id: str
    name: str
    tagline: Optional[str] = None
    address: str
    township: str
    landmark: Optional[str] = None
    latitude: float
    longitude: float
    distance_km: Optional[float] = None
    distance_meters: Optional[int] = None
    open_payments_id: str
    wallet_address_url: str
    status: str
    operating_hours: str
    broadcast_enabled: bool
    promotions_count: int
    has_loyalty: bool
    jobs_count: int
    top_promotion: Optional[str] = None
    loyalty_summary: Optional[str] = None

class UnitDetailResponse(BaseModel):
    id: str
    name: str
    tagline: Optional[str] = None
    owner_name: str
    phone: str
    whatsapp: Optional[str] = None
    address: str
    township: str
    landmark: Optional[str] = None
    latitude: float
    longitude: float
    distance_km: Optional[float] = None
    open_payments_id: str
    wallet_address_url: str
    status: str
    operating_hours: str
    broadcast_enabled: bool
    promotions: List[Dict[str, Any]] = []
    loyalty_program: Optional[Dict[str, Any]] = None
    loyalty_programs: List[Dict[str, Any]] = []
    jobs: List[Dict[str, Any]] = []
    updated_at: str

