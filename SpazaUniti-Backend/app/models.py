import re
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, validator

USERNAME_PATTERN = r"^[a-zA-Z0-9][a-zA-Z0-9_]{1,22}[a-zA-Z0-9]$"

# -----------------------------------------------------------------------------
# Consumer Registration & Multi-Bucket UBU Wallet Models
# -----------------------------------------------------------------------------
class CustomerRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Consumer or Family Vault display name")
    username: str = Field(..., min_length=3, max_length=24, description="Handle e.g. @morake_ext_5 or @kagiso99")
    cell_number: str = Field("0720000000", min_length=10, max_length=15, description="Mobile number for notifications")
    pin: str = Field(..., min_length=4, max_length=4, description="4-digit counter security PIN")
    account_type: str = Field("INDIVIDUAL", description="Consumer class: INDIVIDUAL or FAMILY")

    @validator("username")
    def validate_username(cls, v: str) -> str:
        clean = v.strip().lstrip("@")
        if not re.match(USERNAME_PATTERN, clean):
            raise ValueError("Username must be 3-24 characters (letters, numbers, or underscores inside)")
        return clean.lower()

    @validator("pin")
    def validate_pin(cls, v: str) -> str:
        if not re.match(r"^\d{4}$", v.strip()):
            raise ValueError("Security PIN must be exactly 4 digits (e.g. 1234)")
        return v.strip()

    @validator("account_type")
    def validate_account_type(cls, v: str) -> str:
        clean = v.strip().upper()
        if clean not in ("INDIVIDUAL", "FAMILY"):
            raise ValueError("account_type must be INDIVIDUAL or FAMILY")
        return clean

class ConsumerAllocationSummary(BaseModel):
    link_id: str
    sponsor_username: str
    member_username: str
    member_full_name: Optional[str] = None
    sponsor_full_name: Optional[str] = None
    link_type: str
    relationship_label: str
    status: str
    allocation_limit_ubu: float
    period: str
    spent_in_period_ubu: float
    remaining_in_period_ubu: float
    sponsor_pool_balance_ubu: Optional[float] = None
    allowed_categories: str
    created_at: str

class CustomerResponse(BaseModel):
    customer_id: str
    username: str
    handle: str
    full_name: str
    cell_number: str
    open_payments_id: str
    wallet_address_url: str
    balance: float
    ubu_balance: float = 0.0
    account_type: str = "INDIVIDUAL"
    family_parent_username: Optional[str] = None
    asset_code: str = "ZAR"
    asset_scale: int = 2
    status: str
    created_at: str
    ubuntu_tokens: Dict[str, float] = {}
    total_ubuntu_tokens: float = 0.0
    cashout_eligible: bool = False
    min_cashout_threshold: float = 20.0
    family_members: List[ConsumerAllocationSummary] = []
    beneficiaries: List[ConsumerAllocationSummary] = []
    incoming_allocations: List[ConsumerAllocationSummary] = []
    pending_invitations_count: int = 0

class FundUbuRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in ZAR/UBU (1 UBU = 1 ZAR)")
    source: str = Field("OPEN_PAYMENTS", description="OPEN_PAYMENTS or WALLET_BALANCE or CASH_IN")
    note: Optional[str] = "Single Open Payments UBU Funding Inflow"

class FundUbuResponse(BaseModel):
    success: bool
    username: str
    amount_funded_ubu: float
    new_ubu_balance: float
    new_fiat_balance: float
    transaction_ref: str
    message: str

# -----------------------------------------------------------------------------
# Consumer Class: FAMILY Vault Member Management
# -----------------------------------------------------------------------------
class FamilyMemberCreateRequest(BaseModel):
    member_username: str = Field(..., min_length=3, max_length=24)
    full_name: Optional[str] = Field(None, description="Required if provisioning a new child/member handle")
    cell_number: Optional[str] = Field("0720000000", description="Optional contact number")
    pin: Optional[str] = Field("1234", min_length=4, max_length=4, description="4-digit Counter PIN if creating handle")
    relationship_label: str = Field("Child", description="e.g. Spouse, Child, Elder, Sibling")
    daily_limit_ubu: float = Field(10.0, ge=0, description="Daily UBU allowance drawn from family vault")
    period: str = Field("DAILY", description="DAILY, WEEKLY, or MONTHLY")
    allowed_categories: str = Field("All Spaza Goods", description="Category guardrail")

    @validator("member_username")
    def validate_member_username(cls, v: str) -> str:
        clean = v.strip().lstrip("@")
        if not re.match(USERNAME_PATTERN, clean):
            raise ValueError("Member username must be 3-24 characters (letters, numbers, or underscores inside)")
        return clean.lower()

class FamilyMemberUpdateRequest(BaseModel):
    allocation_limit_ubu: Optional[float] = Field(None, ge=0)
    status: Optional[str] = Field(None, description="ACCEPTED or FROZEN")
    allowed_categories: Optional[str] = None
    relationship_label: Optional[str] = None

# -----------------------------------------------------------------------------
# Consumer Class: INDIVIDUAL Beneficiary Search, Invite & Allocate
# -----------------------------------------------------------------------------
class BeneficiaryInviteRequest(BaseModel):
    beneficiary_username: str = Field(..., min_length=3, max_length=24)
    relationship_label: str = Field("Sibling", description="e.g. Girlfriend, Boyfriend, Sibling, Friend")
    allowance_limit_ubu: float = Field(50.0, ge=0, description="Optional recurring draw limit from your wallet")
    period: str = Field("WEEKLY", description="DAILY, WEEKLY, or MONTHLY")
    allowed_categories: str = Field("Groceries & Essentials")

    @validator("beneficiary_username")
    def validate_ben_username(cls, v: str) -> str:
        clean = v.strip().lstrip("@")
        if not re.match(USERNAME_PATTERN, clean):
            raise ValueError("Beneficiary username must be 3-24 valid handle characters")
        return clean.lower()

class InvitationRespondRequest(BaseModel):
    action: str = Field(..., description="ACCEPT or DECLINE")

class BeneficiaryAllocateRequest(BaseModel):
    amount_ubu: float = Field(..., ge=0, description="Amount to send or new allowance limit")
    mode: str = Field("TRANSFER", description="TRANSFER (instant UBU gift) or ALLOWANCE_CAP (set draw cap)")
    note: Optional[str] = "Beneficiary UBU allocation"

# -----------------------------------------------------------------------------
# Legacy Loyalty Cashout & Spend
# -----------------------------------------------------------------------------
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

# -----------------------------------------------------------------------------
# Open Payments Standard Discovery & Grant Flows
# -----------------------------------------------------------------------------
class WalletAddressResponse(BaseModel):
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
    account_type: Optional[str] = None
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
    merchant_id: Optional[str] = Field("unit-104", description="Merchant identifier")
    merchant_name: Optional[str] = Field("Khumalo Spaza Store", description="Store display name")
    merchant_wallet: Optional[str] = Field(None, description="Merchant Open Payments pointer")
    recipient_wallet: Optional[str] = Field(None, description="Alternative recipient wallet field")
    purpose: str = Field("Counter purchase", description="Purchase purpose")

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
# UbuOne RBAC, Counter Till, Offerings & Batched Settlement Models
# -----------------------------------------------------------------------------
class UbuOneLoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    passcode: str = Field(..., min_length=4, max_length=32)

class StaffResponse(BaseModel):
    id: str
    unit_id: Optional[str] = None
    username: str
    full_name: str
    role: str
    active: bool
    created_at: str

class StaffCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=24)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field("UNIT_CASHIER", description="UNIT_CASHIER or UNIT_OWNER")
    passcode: str = Field(..., min_length=4, max_length=12)

class CounterChargeRequest(BaseModel):
    customer_username: str = Field(..., min_length=3, max_length=24)
    pin: str = Field(..., min_length=4, max_length=4)
    amount_ubu: float = Field(..., gt=0, description="Purchase amount in UBU (1 UBU = R1.00)")
    items_description: str = Field("Counter item (e.g. R1 Lollipop)", min_length=1, max_length=200)
    source_mode: str = Field("AUTO", description="AUTO, PERSONAL_UBU, FAMILY_POOL, or BENEFICIARY_POOL")
    sponsor_username: Optional[str] = None

class ChangeInUbuRequest(BaseModel):
    customer_username: str = Field(..., min_length=3, max_length=24)
    cash_received: float = Field(..., gt=0)
    sale_total: float = Field(..., gt=0)
    note: Optional[str] = "Change returned in UBU (No loose coins needed)"

class UnitSettlementRequest(BaseModel):
    amount_ubu: float = Field(..., gt=0)
    settlement_type: str = Field("BATCHED_BANK_EFT", description="BATCHED_BANK_EFT or WHOLESALER_OPEN_PAYMENTS")
    destination_pointer: str = Field("$bank.capitec.co.za/khumalo", description="Bank account or Wholesaler ILP pointer")

class UnitLoyaltyCreateRequest(BaseModel):
    title: str
    program_type: str = "STAPLE_ACCUMULATOR"
    community_pact: str
    target_item: str = "Albany Superior White Bread"
    item_price_zar: float = 16.00
    reward_threshold_ubu: Optional[float] = None
    token_rate_per_event: Optional[float] = None
    stamps_or_count: int = 9
    active: bool = True

class UnitPromoCreateRequest(BaseModel):
    title: str
    category: str = "Bakery"
    original_price: float = 19.50
    promo_price: float = 16.00
    days_left: int = 3

# -----------------------------------------------------------------------------
# Unit Discovery & Storefront Federation Models
# -----------------------------------------------------------------------------
class UnitRegisterRequest(BaseModel):
    id: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    tagline: Optional[str] = "Fresh bakery, staples & cold drinks"
    owner_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    whatsapp: Optional[str] = None
    address: str = Field(...)
    township: str = Field(...)
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
    ubu_balance: float = 0.0
    updated_at: str
