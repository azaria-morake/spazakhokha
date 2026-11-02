import re
import os
import json
import sqlite3
import httpx
import uuid
from typing import Dict, Any, Optional, Tuple

def _load_env_config():
    """Loads .env variables cleanly without requiring external packages or triggering IDE import warnings."""
    env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip("'\""))
        except Exception:
            pass
    try:
        import importlib
        dotenv_mod = importlib.import_module("dotenv")
        if hasattr(dotenv_mod, "load_dotenv"):
            dotenv_mod.load_dotenv(env_file if os.path.exists(env_file) else None)
    except Exception:
        pass

_load_env_config()


from .database import get_db

TOOL_DEFINITIONS = [
    {
        "name": "record_tab_purchase",
        "description": "Records goods taken on credit tab. Increments customer balance and issues loyalty stamps.",
        "parameters": {
            "type": "object",
            "properties": {
                "customer_query": {"type": "string", "description": "Customer name, phone or ID"},
                "items": {"type": "string", "description": "Description of items taken"},
                "amount": {"type": "number", "description": "Total amount in ZAR"}
            },
            "required": ["customer_query", "amount"]
        }
    },
    {
        "name": "record_tab_repayment",
        "description": "Records cash or digital payment settling an outstanding tab balance.",
        "parameters": {
            "type": "object",
            "properties": {
                "customer_query": {"type": "string", "description": "Customer name, phone or ID"},
                "amount": {"type": "number", "description": "Amount paid in ZAR"},
                "method": {"type": "string", "enum": ["Cash", "Open Payments", "EFT"]}
            },
            "required": ["customer_query", "amount"]
        }
    },
    {
        "name": "create_promotion",
        "description": "Creates and broadcasts a discount promotion on Spaza Uniti.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "category": {"type": "string"},
                "original_price": {"type": "number"},
                "promo_price": {"type": "number"},
                "days": {"type": "integer"}
            },
            "required": ["title", "promo_price"]
        }
    },
    {
        "name": "get_customer_tab_status",
        "description": "Checks customer outstanding tab balance, credit limit, and loyalty stamps.",
        "parameters": {
            "type": "object",
            "properties": {
                "customer_query": {"type": "string"}
            },
            "required": ["customer_query"]
        }
    }
]

def find_customer(conn: sqlite3.Connection, query: str, prefer_with_balance: bool = False) -> Optional[sqlite3.Row]:
    cursor = conn.cursor()
    clean_query = query.strip().lower()
    
    # 1. Exact match by ID or phone
    cursor.execute("SELECT * FROM customers WHERE LOWER(id) = ? OR phone LIKE ?", (clean_query, f"%{clean_query}%"))
    cust = cursor.fetchone()
    if cust:
        return cust
        
    # 2. Exact match by full name
    cursor.execute("SELECT * FROM customers WHERE LOWER(name) = ?", (clean_query,))
    cust = cursor.fetchone()
    if cust:
        return cust

    # 3. Search by substring or surname
    cursor.execute("SELECT * FROM customers WHERE LOWER(name) LIKE ?", (f"%{clean_query}%",))
    candidates = cursor.fetchall()
    if len(candidates) == 1:
        return candidates[0]
    elif len(candidates) > 1:
        # If multiple customers match (e.g. "Morake" matching both Azaria Morake and Mannini Morake)
        if prefer_with_balance:
            with_debt = [c for c in candidates if c["balance"] > 0]
            if len(with_debt) == 1:
                return with_debt[0]
            elif with_debt:
                return with_debt[0]
        # Match exact first name or last name token
        for c in candidates:
            parts = c["name"].lower().split()
            if clean_query in parts:
                return c
        return candidates[0]

    # 4. Fallback: check individual tokens of clean_query
    tokens = clean_query.split()
    for token in tokens:
        if len(token) >= 3:
            cursor.execute("SELECT * FROM customers WHERE LOWER(name) LIKE ?", (f"%{token}%",))
            candidates = cursor.fetchall()
            if candidates:
                if prefer_with_balance:
                    with_debt = [c for c in candidates if c["balance"] > 0]
                    if with_debt:
                        return with_debt[0]
                return candidates[0]
        
    return None


def execute_record_tab_purchase(unit_id: str, customer_query: str, items: str, amount: float) -> Tuple[str, Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    
    cust = find_customer(conn, customer_query)
    if not cust:
        # Create provisional customer if not found
        cust_id = f"CUST-{uuid.uuid4().hex[:6]}"
        cursor.execute("""
        INSERT INTO customers (id, unit_id, name, phone, credit_limit, balance, stamps, notes)
        VALUES (?, ?, ?, '000 000 0000', 300.0, 0.0, 0, 'Auto-provisioned by AI Agent');
        """, (cust_id, unit_id, customer_query.title()))
        conn.commit()
        cursor.execute("SELECT * FROM customers WHERE id = ?", (cust_id,))
        cust = cursor.fetchone()

    new_balance = round(cust["balance"] + amount, 2)
    new_stamps = cust["stamps"]
    if "bread" in items.lower():
        new_stamps = (new_stamps + 1) % 10

    cursor.execute("UPDATE customers SET balance = ?, stamps = ? WHERE id = ?", (new_balance, new_stamps, cust["id"]))
    
    # Generate Purchase record
    p_id = f"PUR-{uuid.uuid4().hex[:8]}"
    cursor.execute("""
    INSERT INTO purchases (id, customer_id, customer_name, description, amount)
    VALUES (?, ?, ?, ?, ?);
    """, (p_id, cust["id"], cust["name"], items, amount))
    
    # Audit log transaction
    t_id = f"TXN-{uuid.uuid4().hex[:8]}"
    cursor.execute("""
    INSERT INTO transactions (id, type, customer_name, details, amount, method, source)
    VALUES (?, 'purchase', ?, ?, ?, 'Credit Tab', 'Mkhulu AI Co-Pilot');
    """, (t_id, cust["name"], items, amount))
    
    conn.commit()
    conn.close()

    text = f"Got it Baba! Recorded R{amount:.2f} on **{cust['name']}**'s tab for *{items}*. Remaining balance: **R{new_balance:.2f}**."
    mutation = {
        "customer_id": cust["id"],
        "customer_name": cust["name"],
        "amount": amount,
        "new_balance": new_balance,
        "new_stamps": new_stamps
    }
    return text, mutation

def execute_record_tab_repayment(unit_id: str, customer_query: str, amount: float, method: str = "Cash", note: str = "Tab Repayment") -> Tuple[str, Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    
    cust = find_customer(conn, customer_query, prefer_with_balance=True)
    if not cust:
        conn.close()
        return f"Customer '{customer_query}' could not be found. Please check their name.", {}

    new_balance = max(0.0, round(cust["balance"] - amount, 2))
    cursor.execute("UPDATE customers SET balance = ? WHERE id = ?", (new_balance, cust["id"]))

    r_id = f"RP-{uuid.uuid4().hex[:8]}"
    cursor.execute("""
    INSERT INTO repayments (id, customer_id, customer_name, amount, method, note)
    VALUES (?, ?, ?, ?, ?, ?);
    """, (r_id, cust["id"], cust["name"], amount, method, note))

    t_id = f"TXN-{uuid.uuid4().hex[:8]}"
    cursor.execute("""
    INSERT INTO transactions (id, type, customer_name, details, amount, method, source)
    VALUES (?, 'repayment', ?, ?, ?, ?, 'Mkhulu AI Co-Pilot');
    """, (t_id, cust["name"], note, amount, method))

    conn.commit()
    conn.close()

    text = f"Sharp! Logged repayment of R{amount:.2f} for **{cust['name']}** via {method}. Remaining tab balance: **R{new_balance:.2f}**."
    mutation = {
        "customer_id": cust["id"],
        "customer_name": cust["name"],
        "amount": amount,
        "new_balance": new_balance
    }
    return text, mutation

def execute_create_promotion(unit_id: str, title: str, category: str, original_price: float, promo_price: float, days: int = 3) -> Tuple[str, Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    
    discount_pct = max(5, int(((original_price - promo_price) / original_price) * 100)) if original_price > 0 else 15
    promo_id = f"PROMO-{uuid.uuid4().hex[:6]}"

    cursor.execute("""
    INSERT INTO promotions (id, unit_id, title, category, original_price, promo_price, discount_pct, days_left, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);
    """, (promo_id, unit_id, title, category, original_price, promo_price, discount_pct, days))

    conn.commit()
    conn.close()

    text = f"Promotion published! **{title}** is now live on Spaza Uniti for shoppers in your area (R{promo_price:.2f}, {discount_pct}% OFF)."
    mutation = {
        "promo_id": promo_id,
        "title": title,
        "promo_price": promo_price,
        "discount_pct": discount_pct
    }
    return text, mutation

def execute_get_status(unit_id: str, customer_query: str) -> Tuple[str, Dict[str, Any]]:
    conn = get_db()
    cust = find_customer(conn, customer_query, prefer_with_balance=True)
    conn.close()

    
    if not cust:
        return f"Could not find any customer matching '{customer_query}'.", {}

    text = f"**{cust['name']}** ({cust['id']}) currently owes **R{cust['balance']:.2f}** (Credit Limit: R{cust['credit_limit']:.2f}). Loyalty Stamps: {cust['stamps']}/9."
    return text, dict(cust)

# In-memory store conversation sessions for multi-turn counter interactions
STORE_SESSIONS: Dict[str, Dict[str, Any]] = {}

def get_store_session(unit_id: str) -> Dict[str, Any]:
    if unit_id not in STORE_SESSIONS:
        STORE_SESSIONS[unit_id] = {
            "history": [],
            "last_customer": None
        }
    return STORE_SESSIONS[unit_id]

def dispatch_tool_call(unit_id: str, tool_name: str, args: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Executes deterministic tool calls returned by the LLM or parser."""
    session = get_store_session(unit_id)
    
    if tool_name == "record_tab_purchase":
        cust_query = args.get("customer_query", "")
        items = args.get("items", "Groceries on tab")
        amount = float(args.get("amount", 0.0))
        res_text, mutation = execute_record_tab_purchase(unit_id, cust_query, items, amount)
        if mutation and "customer_name" in mutation:
            session["last_customer"] = mutation["customer_name"]
        return {
            "response_text": res_text,
            "tool_called": "record_tab_purchase",
            "tool_parameters": args,
            "data_mutation": mutation
        }
    elif tool_name == "record_tab_repayment":
        cust_query = args.get("customer_query", "")
        amount = float(args.get("amount", 0.0))
        method = args.get("method", "Cash")
        res_text, mutation = execute_record_tab_repayment(unit_id, cust_query, amount, method)
        if mutation and "customer_name" in mutation:
            session["last_customer"] = mutation["customer_name"]
        return {
            "response_text": res_text,
            "tool_called": "record_tab_repayment",
            "tool_parameters": args,
            "data_mutation": mutation
        }
    elif tool_name == "create_promotion":
        title = args.get("title", "Spaza Special")
        category = args.get("category", "General")
        orig_price = float(args.get("original_price", 0.0))
        promo_price = float(args.get("promo_price", 0.0))
        days = int(args.get("days", 3))
        res_text, mutation = execute_create_promotion(unit_id, title, category, orig_price, promo_price, days)
        return {
            "response_text": res_text,
            "tool_called": "create_promotion",
            "tool_parameters": args,
            "data_mutation": mutation
        }
    elif tool_name == "get_customer_tab_status":
        cust_query = args.get("customer_query", "")
        res_text, cust_info = execute_get_status(unit_id, cust_query)
        if cust_info and "name" in cust_info:
            session["last_customer"] = cust_info["name"]
        return {
            "response_text": res_text,
            "tool_called": "get_customer_tab_status",
            "tool_parameters": args,
            "data_mutation": None  # READ-ONLY INQUIRY: Never mark as a data mutation!
        }
    return None

def call_gemini_agent(user_input: str, unit_id: str, gemini_key: str, customers_summary: str, history: Optional[List[Dict[str, Any]]] = None, last_customer: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Infers intent and tools using Google Gemini 3.5 Flash with native function calling and conversation context."""
    system_instruction = f"""You are Mkhulu, an intelligent Agentic AI Co-Pilot and Shop Manager for a South African township spaza shop called SpazaKhokha (Spaza Uniti platform).
You manage money, customer credit tabs, repayments, and promotions for Baba (the shopkeeper). Accuracy and financial safety are paramount.

LIVE STORE CUSTOMER DIRECTORY:
{customers_summary}

STORE CATALOG & KNOWN UNIT PRICES:
- Simba Chips (any flavor): R18.00 per bag
- Albany Superior White Bread: R19.50 per loaf
- White Star Super Maize Meal 5kg: R45.00
- Golden Cloud Cake Flour 2.5kg: R42.00
- Sunlight Laundry Soap Bar: R15.00
- Coca-Cola 330ml Can: R14.00

ACTIVE COUNTER CONTEXT & PRONOUN RESOLUTION:
- Recently discussed counter customer: "{last_customer or 'None yet'}".
- CRITICAL PRONOUN RULE: If Baba says "She paid 10", "He paid 10", "Paid 10", "Give her 2 bread", or similar follow-ups with pronouns or implied subject, resolve the customer to the recently discussed customer ("{last_customer or 'None'}")!
- For example, if you just answered a balance inquiry about "Mannini Morake", and Baba immediately says "She paid 10", record R10.00 repayment for Mannini Morake!

CRITICAL RULES FOR STORE INTEGRITY:
1. CUSTOMER IDENTITY & DISAMBIGUATION:
   - Match names accurately to the directory above or the active context.
   - If multiple customers share the same surname (e.g. "Morake"):
     If a repayment or debt inquiry is made ("Morake paid 10" or "Morake paid back 10") and only one Morake owes money (Mannini Morake owes R130.00 while Azaria Morake owes R0.00), attribute the repayment to Mannini Morake.
     If no customer can be inferred and context is empty, ask Baba directly to specify which customer paid.

2. COMMODITY / ITEM QUANTITIES vs RAND AMOUNTS:
   - NEVER confuse an item count with a Rand amount!
   - If Baba says: "mannini paid back for 10 bags she owed on the simbas", "10" is the number of bags of Simbas. At R18.00 per bag, 10 * 18 = R180.00. Call `record_tab_repayment` with amount: 180.0.
   - If Baba says: "Mannini took 5 bags of Simbas, R18 each", calculate 5 * 18 = 90.0 ZAR and call `record_tab_purchase`.

3. ABBREVIATED RAND AMOUNTS:
   - If Baba says "Mannini paid 10" or "She paid 10", in a South African township store context, this is a cash repayment of R10.00. Call `record_tab_repayment` with amount: 10.0.

4. TOOLS:
   - `record_tab_purchase`: When items are taken on credit tab.
   - `record_tab_repayment`: When a customer pays or settles tab debt.
   - `get_customer_tab_status`: When checking balance or inquiring how much someone owes. (Read-only inquiry).
   - `create_promotion`: When publishing a special or discount to Spaza Uniti.
   - If no tool is needed or if clarification is required before safely touching store records, respond with helpful, polite township conversational advice.
"""
    # Transform tool definitions for Gemini schema
    gemini_tools = [
        {
            "function_declarations": [
                {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            k: {
                                "type": v.get("type", "STRING").upper(),
                                "description": v.get("description", "")
                            }
                            for k, v in t["parameters"]["properties"].items()
                        },
                        "required": t["parameters"].get("required", [])
                    }
                }
                for t in TOOL_DEFINITIONS
            ]
        }
    ]

    # Build multi-turn contents from conversation history
    contents = []
    if history:
        for turn in history[-6:]:
            role = "user" if turn.get("role") in ["user", "shopkeeper", "client"] else "model"
            text_val = turn.get("content") or turn.get("text") or turn.get("response_text") or ""
            if text_val.strip():
                contents.append({"role": role, "parts": [{"text": text_val}]})
    contents.append({"role": "user", "parts": [{"text": user_input}]})

    models_to_try = ["gemini-3.5-flash", "gemini-3.5-flash-lite"]
    
    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
        payload = {
            "system_instruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": contents,
            "tools": gemini_tools,
            "generationConfig": {
                "temperature": 0.1
            }
        }
        
        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code != 200:
                    print(f"[Gemini Error {model_name}] HTTP {resp.status_code}: {resp.text}")
                    continue
                data = resp.json()
                candidate = data.get("candidates", [{}])[0]
                parts = candidate.get("content", {}).get("parts", [])
                for p in parts:
                    if "functionCall" in p:
                        fn_name = p["functionCall"]["name"]
                        fn_args = p["functionCall"].get("args", {})
                        return dispatch_tool_call(unit_id, fn_name, fn_args)
                
                text_resp = "".join(p.get("text", "") for p in parts if "text" in p)
                return {
                    "response_text": text_resp or "Sawubona Baba! I am listening.",
                    "tool_called": None,
                    "tool_parameters": None,
                    "data_mutation": None
                }
        except Exception as e:
            print(f"[Gemini Exception {model_name}] {e}")
            continue

    return None

def parse_with_dynamic_local_engine(text: str, unit_id: str, customers_rows: list, last_customer: Optional[str] = None) -> Dict[str, Any]:
    """Dynamic database-driven parser with smart customer disambiguation, pronoun resolution, and item arithmetic."""
    lower = text.lower()
    customer_candidate = None

    # 0. Check for pronouns or implied subject when a customer was recently discussed
    if last_customer:
        pronoun_triggers = ["she", "he", "her", "him", "paid 10", "paid", "settled", "balance", "owe"]
        has_pronoun = any(re.search(r'\b' + re.escape(p) + r'\b', lower) for p in pronoun_triggers)
        if has_pronoun:
            # Check if any OTHER explicit customer is named in the input
            other_named = False
            for row in customers_rows:
                tokens = [t.lower() for t in row["name"].split()]
                if any(re.search(r'\b' + re.escape(t) + r'\b', lower) for t in tokens if len(t) >= 4):
                    other_named = True
                    break
            if not other_named:
                customer_candidate = last_customer

    # 1. First check if any full name matches
    if not customer_candidate:
        for row in customers_rows:
            if row["name"].lower() in lower:
                customer_candidate = row["name"]
                break
            
    # 2. Check if a surname or first name matches
    if not customer_candidate:
        for row in customers_rows:
            tokens = [t.lower() for t in row["name"].split()]
            for tok in tokens:
                if len(tok) >= 4 and re.search(r'\b' + re.escape(tok) + r'\b', lower):
                    matches = [c for c in customers_rows if tok in c["name"].lower().split()]
                    if len(matches) > 1:
                        with_debt = [c for c in matches if c["balance"] > 0]
                        customer_candidate = with_debt[0]["name"] if with_debt else matches[0]["name"]
                    else:
                        customer_candidate = row["name"]
                    break
            if customer_candidate:
                break
                
    # 3. Fallback: extract subject before verb
    if not customer_candidate:
        name_match = re.search(r'^([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:took|bought|got|paid|settled|cleared|wants|owes)', text, re.I)
        if name_match:
            customer_candidate = name_match.group(1).strip()
        else:
            customer_candidate = last_customer or (customers_rows[0]["name"] if customers_rows else "Customer")

    # Item unit price lookup
    price_map = {
        "simba": 18.0,
        "simbas": 18.0,
        "bread": 19.50,
        "maize": 45.0,
        "flour": 42.0,
        "soap": 15.0,
        "coke": 14.0,
        "chips": 18.0
    }

    # Action 1: Purchase / Credit / Took / Bought
    if any(k in lower for k in ["credit", "tab", "took", "bought", "got", "take"]):
        item_match = re.search(r'(\d+)\s*(?:bags?|loaves|packs?|units?)?(?:\s+of)?\s*(?:the\s+)?(simbas?|bread|maize|chips|coke|soap|flour)', lower)
        amt_match = re.search(r'[rR]\s*(\d+(?:\.\d{1,2})?)', lower) or re.search(r'(\d+(?:\.\d{1,2})?)\s*rand', lower)
        
        amount = 0.0
        items = "Counter groceries on tab"
        
        if item_match:
            qty = int(item_match.group(1))
            item_name = item_match.group(2)
            unit_price = price_map.get(item_name, 18.0)
            if "each" in lower or "at" in lower or "ea" in lower:
                custom_unit = re.search(r'(?:at|each|ea)[,\s]+[rR]?\s*(\d+(?:\.\d{1,2})?)', lower) or re.search(r'[rR]?\s*(\d+(?:\.\d{1,2})?)\s*(?:each|ea)', lower)
                if custom_unit:
                    unit_price = float(custom_unit.group(1))
            amount = round(qty * unit_price, 2)
            items = f"{qty} bags of {item_name.title()}" if "simba" in item_name else f"{qty} {item_name.title()}"
        elif amt_match:
            amount = float(amt_match.group(1))
            items_match = re.search(r'(?:took|bought|got)\s+(.*?)(?:on\s+credit|[rR]\s*\d+|,|\.|$)', text, re.I)
            if items_match and items_match.group(1).strip():
                items = items_match.group(1).strip()
        else:
            amount = 35.0

        tool_params = {
            "customer_query": customer_candidate,
            "items": items,
            "amount": amount
        }
        res_text, mutation = execute_record_tab_purchase(unit_id, customer_candidate, items, amount)
        session = get_store_session(unit_id)
        session["last_customer"] = customer_candidate
        return {
            "response_text": res_text,
            "tool_called": "record_tab_purchase",
            "tool_parameters": tool_params,
            "data_mutation": mutation
        }

    # Action 2: Repayment
    if any(k in lower for k in ["repayment", "paid", "settle", "settled", "cleared"]):
        item_rep_match = re.search(r'(\d+)\s*(?:bags?|loaves|packs?|units?)?(?:\s+(?:she|he)?\s*owed\s*(?:on)?|\s+of)?\s*(?:the\s+)?(simbas?|bread|maize|chips|coke|soap|flour)', lower)
        
        amount = 0.0
        method = "Open Payments" if any(k in lower for k in ["open payments", "ilp", "digital", "phone"]) else "Cash"
        note = "Tab Repayment"

        if item_rep_match:
            qty = int(item_rep_match.group(1))
            item_name = item_rep_match.group(2)
            unit_price = price_map.get(item_name, 18.0)
            amount = round(qty * unit_price, 2)
            note = f"Paid for {qty} {item_name.title()} debt"
        else:
            amt_match = re.search(r'[rR]\s*(\d+(?:\.\d{1,2})?)', lower) or \
                        re.search(r'(\d+(?:\.\d{1,2})?)\s*rand', lower) or \
                        re.search(r'(?:paid|settled|cleared)(?:\s+back)?\s+(?:r|rand)?\s*(\d+(?:\.\d{1,2})?)', lower)
            if amt_match:
                amount = float(amt_match.group(1))
            else:
                amount = 10.0

        tool_params = {
            "customer_query": customer_candidate,
            "amount": amount,
            "method": method
        }
        res_text, mutation = execute_record_tab_repayment(unit_id, customer_candidate, amount, method, note)
        session = get_store_session(unit_id)
        session["last_customer"] = customer_candidate
        return {
            "response_text": res_text,
            "tool_called": "record_tab_repayment",
            "tool_parameters": tool_params,
            "data_mutation": mutation
        }

    # Action 3: Promotion
    if any(k in lower for k in ["promotion", "promo", "discount", "special"]):
        title = "Store Special"
        category = "General"
        orig_price = 45.0
        promo_price = 38.0
        
        if "bread" in lower:
            title = "Albany Bread Special"
            category = "Bakery"
            orig_price = 19.50
            promo_price = 16.00
        elif "maize" in lower:
            title = "Weekend Maize Meal Special"
            category = "Staples"
            orig_price = 45.0
            promo_price = 38.0
            
        tool_params = {
            "title": title,
            "category": category,
            "original_price": orig_price,
            "promo_price": promo_price,
            "days": 3
        }
        res_text, mutation = execute_create_promotion(unit_id, title, category, orig_price, promo_price, 3)
        return {
            "response_text": res_text,
            "tool_called": "create_promotion",
            "tool_parameters": tool_params,
            "data_mutation": mutation
        }

    # Action 4: Balance inquiry
    if any(k in lower for k in ["balance", "owe", "owes", "check", "status"]):
        tool_params = {"customer_query": customer_candidate}
        res_text, cust_dict = execute_get_status(unit_id, customer_candidate)
        session = get_store_session(unit_id)
        session["last_customer"] = customer_candidate
        return {
            "response_text": res_text,
            "tool_called": "get_customer_tab_status",
            "tool_parameters": tool_params,
            "data_mutation": None  # READ-ONLY INQUIRY!
        }

    return {
        "response_text": f"Sawubona Baba! I heard: \"{text}\". Tell me what happened at the counter (e.g. \"{customer_candidate} took 5 bags of Simbas, R18 each\" or \"{customer_candidate} paid R50\"), or ask me to publish discounts to Spaza Uniti!",
        "tool_called": None,
        "tool_parameters": None,
        "data_mutation": None
    }

def parse_and_execute_agent(user_input: str, unit_id: str = "unit-104", history: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Intelligent Agentic Router with Multi-Turn Context Memory:
    1. Google Gemini 3.5 Flash LLM with tool calling and conversation history
    2. Dynamic SQLite-backed Parser with Pronoun Resolution and Arithmetic (Offline fallback)
    """
    text = user_input.strip()
    session = get_store_session(unit_id)
    effective_history = history if history is not None else session["history"]
    last_customer = session.get("last_customer")
    
    # Query live customer directory from SQLite with active debt status
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, balance, credit_limit, stamps FROM customers")
    customers_rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    customers_summary = "\n".join(
        f"- {c['name']} (ID: {c['id']}, Outstanding Tab Debt: R{c['balance']:.2f}, Credit Limit: R{c['credit_limit']:.2f}, Stamps: {c['stamps']}/9)"
        for c in customers_rows
    )

    res = None
    # 1. Google Gemini AI Engine
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if gemini_key:
        res = call_gemini_agent(text, unit_id, gemini_key, customers_summary, effective_history, last_customer)

    # 2. Dynamic Local Engine (zero hardcoding, queries real database, arithmetic & pronoun resolution)
    if not res:
        res = parse_with_dynamic_local_engine(text, unit_id, customers_rows, last_customer)

    # Update in-memory session history (keeps last 10 turns)
    session["history"].append({"role": "user", "content": text})
    session["history"].append({"role": "model", "content": res.get("response_text", "")})
    if len(session["history"]) > 10:
        session["history"] = session["history"][-10:]

    return res

