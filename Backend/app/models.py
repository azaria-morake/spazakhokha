from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class CustomerCreate(BaseModel):
    name: str
    phone: str
    credit_limit: float = 350.0
    notes: Optional[str] = None

class CustomerResponse(BaseModel):
    id: str
    unit_id: str
    name: str
    phone: str
    credit_limit: float
    balance: float
    stamps: int
    notes: Optional[str] = None
    created_at: Optional[str] = None

class PurchaseCreate(BaseModel):
    customer_id: str
    description: str
    amount: float

class PurchaseResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    description: str
    amount: float
    created_at: str

class RepaymentCreate(BaseModel):
    customer_id: str
    amount: float
    method: str = "Cash"
    note: Optional[str] = None

class RepaymentResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    amount: float
    method: str
    note: Optional[str] = None
    created_at: str

class TransactionResponse(BaseModel):
    id: str
    type: str
    customer_name: str
    details: str
    amount: float
    method: str
    source: str
    created_at: str

class PromotionCreate(BaseModel):
    title: str
    category: str
    original_price: float
    promo_price: float
    days_left: int = 3

class PromotionResponse(BaseModel):
    id: str
    unit_id: str
    title: str
    category: str
    original_price: float
    promo_price: float
    discount_pct: int
    days_left: int
    active: bool
    created_at: str

class LoyaltyProgramResponse(BaseModel):
    id: str
    unit_id: str
    title: str
    program_type: str
    stamps_required: int
    reward_description: str
    active: bool

class LoyaltyProgramUpdate(BaseModel):
    reward_description: str

class AgentChatRequest(BaseModel):
    user_input: str
    unit_id: str = "unit-104"
    history: Optional[List[Dict[str, Any]]] = None

class AgentChatResponse(BaseModel):
    response_text: str
    tool_called: Optional[str] = None
    tool_parameters: Optional[Dict[str, Any]] = None
    data_mutation: Optional[Dict[str, Any]] = None

class OpenPaymentsRequestCreate(BaseModel):
    customer_id: str
    amount: float
    purpose: str = "Tab Repayment"

class OpenPaymentsRequestResponse(BaseModel):
    payment_request_id: str
    wallet_address: str
    amount: float
    asset_code: str = "ZAR"
    asset_scale: int = 2
    customer_id: str
    customer_name: str
    payment_pointer_uri: str
    status: str = "pending"

class OpenPaymentsWebhookPayload(BaseModel):
    id: str
    type: str = "incoming_payment.completed"
    wallet_address: str
    amount: float
    customer_id: str
    payment_reference: str

class StoreSettingsModel(BaseModel):
    unit_id: str = "unit-104"
    store_name: str = "Mama Zola Spaza"
    broadcast_to_uniti: bool = True
    uniti_backend_url: str = "http://localhost:8001"
    status: str = "OPEN"
    operating_hours: str = "06:30 - 20:00 Daily"
    updated_at: Optional[str] = None

class StoreSettingsUpdate(BaseModel):
    broadcast_to_uniti: Optional[bool] = None
    store_name: Optional[str] = None
    status: Optional[str] = None
    operating_hours: Optional[str] = None
    uniti_backend_url: Optional[str] = None

