import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Colors
    BG_DARK = RGBColor(11, 16, 29)       # #0B101D
    BG_CARD = RGBColor(18, 26, 44)       # #121A2C
    BG_CARD_LIGHT = RGBColor(24, 35, 58) # #18233A
    CYAN = RGBColor(0, 162, 232)         # #00A2E8
    MINT = RGBColor(16, 185, 129)        # #10B981
    GOLD = RGBColor(245, 158, 11)        # #F59E0B
    PURPLE = RGBColor(139, 92, 246)      # #8B5CF6
    WHITE = RGBColor(255, 255, 255)
    MUTED = RGBColor(154, 167, 196)      # #9AA7C4
    RED = RGBColor(239, 68, 68)          # #EF4444

    base_dir = os.path.dirname(os.path.abspath(__file__))
    img_hero = os.path.join(base_dir, "SpazaUniti-Frontend/public/hero_spaza.jpg")
    img_ubu_logo = os.path.join(base_dir, "services/ubu-one/UbuOne-Frontend/public/brand/ubu-one-logo.jpeg")
    img_ubu_ui = os.path.join(base_dir, "services/ubu-one/UbuOne-Frontend/public/brand/ubu-one-ui.jpeg")
    img_ubu_wall1 = os.path.join(base_dir, "services/ubu-one/UbuOne-Frontend/public/brand/ubu-one-wallpaper1.jpeg")
    img_uniti_dash = os.path.join(base_dir, "SpazaUniti-Frontend/UI/Spaza Uniti Marketplace Dashboard.png")
    img_gift = os.path.join(base_dir, "SpazaUniti-Frontend/public/gift_box.jpg")

    def set_slide_background(slide, color=BG_DARK):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = color
        bg.line.fill.background()
        return bg

    def add_card(slide, left, top, width, height, bg_color=BG_CARD, border_color=None):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        if border_color:
            card.line.color.rgb = border_color
            card.line.width = Pt(1.5)
        else:
            card.line.fill.background()
        return card

    def add_header(slide, title_text, category_text="SPAZA UNITI & UBUONE • HACKATHON ENTRY"):
        # Category Tracker
        tb_cat = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.4))
        tf_cat = tb_cat.text_frame
        tf_cat.word_wrap = True
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = CYAN
        p_cat.font.name = "Calibri"

        # Main Slide Title
        tb_title = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.7), Inches(0.8))
        tf_title = tb_title.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(26)
        p_title.font.bold = True
        p_title.font.color.rgb = WHITE
        p_title.font.name = "Calibri"

    # =========================================================================
    # SLIDE 1: Title Slide (Cover)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1, BG_DARK)
    if os.path.exists(img_hero):
        s1.shapes.add_picture(img_hero, Inches(0), Inches(0), width=Inches(13.333), height=Inches(7.5))
        # Dark overlay
        overlay = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        overlay.fill.solid()
        overlay.fill.fore_color.rgb = RGBColor(7, 10, 19)
        overlay.fill.transparency = 0.25
        overlay.line.fill.background()

    # Main Center Card
    c1 = add_card(s1, Inches(1.2), Inches(1.0), Inches(10.9), Inches(5.5), RGBColor(12, 17, 30), CYAN)

    if os.path.exists(img_ubu_logo):
        s1.shapes.add_picture(img_ubu_logo, Inches(1.8), Inches(1.5), width=Inches(1.2))

    tb = s1.shapes.add_textbox(Inches(3.2), Inches(1.4), Inches(8.2), Inches(1.4))
    tf = tb.text_frame
    p = tf.paragraphs[0]
    p.text = "Spaza Uniti & UbuOne"
    p.font.size = Pt(40)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.font.name = "Calibri"

    p2 = tf.add_paragraph()
    p2.text = "Connected Township Commerce & Zero-Fee Micro-Payments via Open Payments"
    p2.font.size = Pt(17)
    p2.font.color.rgb = CYAN
    p2.font.name = "Calibri"

    # Badges Row
    badges = [
        ("Interledger Testnet", "Rafiki Live", MINT),
        ("Dual-Rail UBU Engine", "1 UBU = R1.00", CYAN),
        ("RFC 9421 Signatures", "Ed25519 Verified", GOLD),
        ("Multi-Tenant RBAC", "Merchant & Family", PURPLE),
    ]
    for i, (b_title, b_sub, b_col) in enumerate(badges):
        bx = Inches(1.8 + i * 2.45)
        by = Inches(3.2)
        add_card(s1, bx, by, Inches(2.25), Inches(1.3), BG_CARD_LIGHT, b_col)
        tb_b = s1.shapes.add_textbox(bx + Inches(0.1), by + Inches(0.15), Inches(2.05), Inches(1.0))
        tf_b = tb_b.text_frame
        p_bt = tf_b.paragraphs[0]
        p_bt.text = b_title
        p_bt.font.size = Pt(13)
        p_bt.font.bold = True
        p_bt.font.color.rgb = WHITE
        p_bs = tf_b.add_paragraph()
        p_bs.text = b_sub
        p_bs.font.size = Pt(11)
        p_bs.font.color.rgb = b_col

    # Bottom links
    tb_foot = s1.shapes.add_textbox(Inches(1.8), Inches(4.9), Inches(9.7), Inches(1.2))
    tf_foot = tb_foot.text_frame
    pf1 = tf_foot.paragraphs[0]
    pf1.text = "Live Deployments:  https://spaza-uniti.vercel.app  •  https://ubu-one-seven.vercel.app"
    pf1.font.size = Pt(13)
    pf1.font.bold = True
    pf1.font.color.rgb = WHITE
    pf2 = tf_foot.add_paragraph()
    pf2.text = "Testnet Payment Pointer: $ilp.interledger-test.dev/2f0b6b2c  •  Key ID: d644f013-289b-4c24-9cbe-c3e174cb5a0e"
    pf2.font.size = Pt(11)
    pf2.font.color.rgb = MUTED

    s1.notes_slide.notes_text_frame.text = (
        "Welcome judges and fellow builders. Today, we are proud to introduce Spaza Uniti and UbuOne. "
        "We have built a production-grade, dual-rail financial and commerce operating system designed specifically "
        "for the South African township economy. By combining the global standard of Interledger and Open Payments "
        "with our localized zero-fee micro-payment pool called Ubu, we eliminate predatory swipe fees, eradicate cash "
        "robbery risks, and connect township merchants into a federated digital marketplace."
    )

    # =========================================================================
    # SLIDE 2: Problem Statement & Township Market Opportunity
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2)
    add_header(s2, "The Informal Economy Reality & Pain Points")

    # Big stat callout
    add_card(s2, Inches(0.8), Inches(1.6), Inches(11.7), Inches(1.1), BG_CARD_LIGHT, CYAN)
    tb_stat = s2.shapes.add_textbox(Inches(1.0), Inches(1.7), Inches(11.3), Inches(0.9))
    tf_stat = tb_stat.text_frame
    p_st = tf_stat.paragraphs[0]
    p_st.text = "R180 BILLION ($10B+ USD) IN ANNUAL INFORMAL CASH TRADE"
    p_st.font.size = Pt(16)
    p_st.font.bold = True
    p_st.font.color.rgb = CYAN
    p_st2 = tf_stat.add_paragraph()
    p_st2.text = "Across 150,000+ township spaza shops and 10 Million+ daily shoppers, yet trapped in physical cash friction."
    p_st2.font.size = Pt(13)
    p_st2.font.color.rgb = WHITE

    # 3 Pain Point Columns
    col_w = Inches(3.7)
    gap = Inches(0.3)
    top_y = Inches(3.0)
    card_h = Inches(3.9)

    # Col 1: Cash Friction
    add_card(s2, Inches(0.8), top_y, col_w, card_h, BG_CARD, RED)
    tb_c1 = s2.shapes.add_textbox(Inches(1.0), top_y + Inches(0.2), col_w - Inches(0.4), card_h - Inches(0.4))
    tf_c1 = tb_c1.text_frame
    tf_c1.word_wrap = True
    p = tf_c1.paragraphs[0]
    p.text = "1. Cash Friction & Robbery"
    p.font.size = Pt(17)
    p.font.bold = True
    p.font.color.rgb = RED

    items_c1 = [
        "High armed robbery risk for spaza owners holding physical daily cash floats.",
        "R15 - R35 ATM cash-out fees per withdrawal from commercial banks.",
        "Township families lose 8% to 15% of monthly disposable income just moving cash.",
        "Cash shortages lead to 'sweet change' disputes at the counter."
    ]
    for it in items_c1:
        p = tf_c1.add_paragraph()
        p.text = "• " + it
        p.font.size = Pt(12)
        p.font.color.rgb = WHITE

    # Col 2: The Micro-Payment Wall
    add_card(s2, Inches(0.8) + col_w + gap, top_y, col_w, card_h, BG_CARD, GOLD)
    tb_c2 = s2.shapes.add_textbox(Inches(1.0) + col_w + gap, top_y + Inches(0.2), col_w - Inches(0.4), card_h - Inches(0.4))
    tf_c2 = tb_c2.text_frame
    tf_c2.word_wrap = True
    p = tf_c2.paragraphs[0]
    p.text = "2. Micro-Payment Wall"
    p.font.size = Pt(17)
    p.font.bold = True
    p.font.color.rgb = GOLD

    items_c2 = [
        "Traditional card interchange has a minimum swipe fee of R1.50 - R2.50.",
        "A R5.00 loaf slice, R3.00 snack, or R10.00 soup packet loses 30% to 50% in fees.",
        "Card terminals reject or penalize small sub-rand purchases.",
        "Township merchants refuse card machines for essential daily staples."
    ]
    for it in items_c2:
        p = tf_c2.add_paragraph()
        p.text = "• " + it
        p.font.size = Pt(12)
        p.font.color.rgb = WHITE

    # Col 3: Paper Credit Tabs
    add_card(s2, Inches(0.8) + (col_w + gap) * 2, top_y, col_w, card_h, BG_CARD, PURPLE)
    tb_c3 = s2.shapes.add_textbox(Inches(1.0) + (col_w + gap) * 2, top_y + Inches(0.2), col_w - Inches(0.4), card_h - Inches(0.4))
    tf_c3 = tb_c3.text_frame
    tf_c3.word_wrap = True
    p = tf_c3.paragraphs[0]
    p.text = "3. Informal Credit Tabs"
    p.font.size = Pt(17)
    p.font.bold = True
    p.font.color.rgb = PURPLE

    items_c3 = [
        "Neighborhood credit ('makhaya tabs') is recorded in worn paper notebooks.",
        "Zero audit trail, frequent customer disputes, and 25%+ default rates.",
        "No structured mechanism for family heads to authorize student or child credit.",
        "Merchants absorb bad debts, threatening shop solvency."
    ]
    for it in items_c3:
        p = tf_c3.add_paragraph()
        p.text = "• " + it
        p.font.size = Pt(12)
        p.font.color.rgb = WHITE

    s2.notes_slide.notes_text_frame.text = (
        "To understand why digital payments have failed South African townships, look at unit economics. "
        "When a shopper buys R8.00 bread or a R3.00 cold drink, card networks charge R1.50+ interchange. "
        "That obliterates merchant profit. Meanwhile, shoppers pay high ATM fees just to withdraw wages in cash, "
        "only to carry that cash into townships where robbery risk is constant. Spaza Uniti and UbuOne eliminate this friction."
    )

    # =========================================================================
    # SLIDE 3: Research & Key Field Insights
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3)
    add_header(s3, "Field Research: 4 Truths of Township Commerce")

    insights = [
        ("1. Fractional Purchasing", 
         "Customers buy in small, frequent increments throughout the day rather than one large supermarket trip.",
         "System must support unlimited sub-rand micro-transactions at R0.00 per-transaction network fees.",
         CYAN),
        ("2. One Inflow, Many Spends",
         "Wages or SASSA social grants arrive once monthly; cash-out happens immediately to escape bank charges.",
         "Dual-rail architecture: 1 periodic Open Payments inflow on-ramp funds a spendable UBU pool (1 UBU = R1.00).",
         MINT),
        ("3. Communal Family Budgets",
         "Household heads budget daily allowances for school children, grandparents, and student relatives.",
         "Multi-tenant Family & Beneficiary RBAC with daily spending limits, category rules, and PIN authorization.",
         GOLD),
        ("4. Low Digital Literacy & Trust",
         "Shopkeepers and older shoppers reject complex fintech apps and slow multi-factor flows.",
         "High-contrast mobile UI with instant 4-digit counter security PINs and WhatsApp push confirmation links.",
         PURPLE),
    ]

    for i, (title, obs, sol, col) in enumerate(insights):
        row = i // 2
        c_idx = i % 2
        bx = Inches(0.8 + c_idx * 5.95)
        by = Inches(1.7 + row * 2.7)
        bw = Inches(5.65)
        bh = Inches(2.45)

        add_card(s3, bx, by, bw, bh, BG_CARD, col)
        tb_in = s3.shapes.add_textbox(bx + Inches(0.25), by + Inches(0.2), bw - Inches(0.5), bh - Inches(0.4))
        tf_in = tb_in.text_frame
        tf_in.word_wrap = True

        p = tf_in.paragraphs[0]
        p.text = title
        p.font.size = Pt(17)
        p.font.bold = True
        p.font.color.rgb = col

        p_obs = tf_in.add_paragraph()
        p_obs.text = "Field Observation: " + obs
        p_obs.font.size = Pt(12)
        p_obs.font.color.rgb = WHITE

        p_sol = tf_in.add_paragraph()
        p_sol.text = "Our Architecture: " + sol
        p_sol.font.size = Pt(12)
        p_sol.font.bold = True
        p_sol.font.color.rgb = col

    s3.notes_slide.notes_text_frame.text = (
        "Our field research in Soweto, Tembisa, and Alexandra revealed four core behaviors. "
        "Township commerce is fractional, communal, and trust-dependent. A mother receives her salary once, "
        "but her children buy bread and snacks throughout the day. By building a single Open Payments deposit "
        "on-ramp combined with a zero-fee spendable UBU pool, we match township reality precisely."
    )

    # =========================================================================
    # SLIDE 4: User Stories & Persona Journeys
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4)
    add_header(s4, "User Stories & Persona Journeys")

    personas = [
        ("Mama Khumalo", "Spaza Shopkeeper (Unit 104)",
         "Goal: Accept digital payments without card fees, eliminate coin shortage disputes, and broadcast daily specials.",
         "Journey: Opens till on UbuOne -> Types amount & customer handle -> Katlego enters 4-digit PIN -> Till chimes success in 200ms -> End-of-day bank cash-out via Open Payments.",
         MINT),
        ("Mannini", "Household Head & Family Admin",
         "Goal: Budget family grocery money safely and earn cashback that covers daily transport costs.",
         "Journey: Loads R500 from Capitec via Open Payments testnet -> Allocates R50 daily allowance to son Katlego -> Shops on Spaza Uniti marketplace -> Earns 10% cashback towards R20 Taxi Fare.",
         CYAN),
        ("Katlego", "High School Student & Dependent",
         "Goal: Buy after-school lunch and bread for home without carrying cash that could get stolen.",
         "Journey: Walks to Unit 104 -> Orders Magwinya special -> Enters 4-digit PIN at till -> Till debits mother's family vault within his daily limit -> Zero cash touched.",
         PURPLE),
    ]

    for i, (name, role, goal, journey, col) in enumerate(personas):
        bx = Inches(0.8 + i * 4.0)
        by = Inches(1.8)
        bw = Inches(3.7)
        bh = Inches(5.1)

        add_card(s4, bx, by, bw, bh, BG_CARD, col)
        tb_p = s4.shapes.add_textbox(bx + Inches(0.2), by + Inches(0.2), bw - Inches(0.4), bh - Inches(0.4))
        tf_p = tb_p.text_frame
        tf_p.word_wrap = True

        p = tf_p.paragraphs[0]
        p.text = name
        p.font.size = Pt(20)
        p.font.bold = True
        p.font.color.rgb = WHITE

        p_r = tf_p.add_paragraph()
        p_r.text = role
        p_r.font.size = Pt(13)
        p_r.font.bold = True
        p_r.font.color.rgb = col

        p_g = tf_p.add_paragraph()
        p_g.text = "\n" + goal
        p_g.font.size = Pt(12)
        p_g.font.color.rgb = WHITE

        p_j = tf_p.add_paragraph()
        p_j.text = "\nExperience:"
        p_j.font.size = Pt(12)
        p_j.font.bold = True
        p_j.font.color.rgb = col

        p_jd = tf_p.add_paragraph()
        p_jd.text = journey
        p_jd.font.size = Pt(11)
        p_jd.font.color.rgb = MUTED

    s4.notes_slide.notes_text_frame.text = (
        "Here are our three core users. Mama Khumalo runs Unit 104. She uses UbuOne to eliminate coin shortages and "
        "accept zero-fee payments. Mannini is a working mother who tops up her family pool once via Open Payments, sets a "
        "daily cap for her son Katlego, and earns loyalty cashback. Katlego enters his 4-digit PIN at the counter and walks "
        "away with lunch in seconds, without ever needing cash."
    )

    # =========================================================================
    # SLIDE 5: The Dual-Rail Economic Engine
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5)
    add_header(s5, "The Dual-Rail Economic Architecture")

    # Rail 1 Box (Global Open Payments)
    add_card(s5, Inches(0.8), Inches(1.8), Inches(11.7), Inches(2.3), BG_CARD, CYAN)
    tb_r1 = s5.shapes.add_textbox(Inches(1.1), Inches(1.95), Inches(11.1), Inches(2.0))
    tf_r1 = tb_r1.text_frame
    tf_r1.word_wrap = True
    p = tf_r1.paragraphs[0]
    p.text = "RAIL 1: GLOBAL OPEN PAYMENTS (INTERLEDGER PROTOCOL)"
    p.font.size = Pt(17)
    p.font.bold = True
    p.font.color.rgb = CYAN

    r1_points = [
        "Standardized, interoperable payment pointer: $ilp.interledger-test.dev/2f0b6b2c",
        "High-trust macro transactions: monthly salary deposit on-ramp, merchant end-of-day commercial bank cash-out.",
        "Interactive GNAP consent grants on auth.interledger-test.dev with Ed25519 cryptographic signatures (RFC 9421).",
        "Off-Ramp: Automated cash-out of loyalty cashback into R20 taxi fare streaming via live ILP packets."
    ]
    for pt in r1_points:
        p = tf_r1.add_paragraph()
        p.text = "• " + pt
        p.font.size = Pt(12)
        p.font.color.rgb = WHITE

    # Connector banner
    add_card(s5, Inches(3.6), Inches(4.25), Inches(6.1), Inches(0.55), BG_CARD_LIGHT, GOLD)
    tb_mid = s5.shapes.add_textbox(Inches(3.7), Inches(4.3), Inches(5.9), Inches(0.45))
    p_m = tb_mid.text_frame.paragraphs[0]
    p_m.text = "1 Inflow On-Ramp  ->  Unlocks 100s of Zero-Fee Micro-Spends"
    p_m.font.size = Pt(12)
    p_m.font.bold = True
    p_m.font.color.rgb = GOLD
    p_m.alignment = PP_ALIGN.CENTER

    # Rail 2 Box (Spendable UBU Engine)
    add_card(s5, Inches(0.8), Inches(4.95), Inches(11.7), Inches(2.1), BG_CARD, MINT)
    tb_r2 = s5.shapes.add_textbox(Inches(1.1), Inches(5.1), Inches(11.1), Inches(1.8))
    tf_r2 = tb_r2.text_frame
    tf_r2.word_wrap = True
    p = tf_r2.paragraphs[0]
    p.text = "RAIL 2: SPENDABLE UBU MICRO-PAYMENT ENGINE (1 UBU = R1.00 ZAR)"
    p.font.size = Pt(17)
    p.font.bold = True
    p.font.color.rgb = MINT

    r2_points = [
        "Uniti-wide local liquidity pool: 1 UBU is pegged strictly 1:1 to R1.00 South African Rand.",
        "R0.00 per-transaction fee: Economic viability for R1.50 sweets, R5.00 bread slices, R10.00 cold drinks.",
        "Family Vaults: Parents provision children and dependents with automated daily/weekly spending caps.",
        "Instant Merchant Counter Till Settlement: Immediate ledger balance update and audit confirmation."
    ]
    for pt in r2_points:
        p = tf_r2.add_paragraph()
        p.text = "• " + pt
        p.font.size = Pt(12)
        p.font.color.rgb = WHITE

    s5.notes_slide.notes_text_frame.text = (
        "Our key breakthrough is the Dual-Rail Architecture. Rail 1 is the global Interledger standard for macro events: "
        "depositing salaries, cashing out merchant revenue, or streaming transit allowances. Rail 2 is our Spendable UBU "
        "micro-payment engine. By isolating network interchange to a single monthly on-ramp, hundreds of internal township "
        "micro-transactions circulate with zero fees."
    )

    # =========================================================================
    # SLIDE 6: System Architecture & Ecosystem Topology
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6)
    add_header(s6, "Full-Stack System Architecture & Protocol Topology")

    # 3 Horizontal Architecture Tiers
    tiers = [
        ("1. Global Interledger Tier",
         "Interledger Testnet (Rafiki)  •  GNAP Authorization Server  •  Resource Server (:incoming-payments)\n"
         "Payment Pointer: $ilp.interledger-test.dev/2f0b6b2c  •  RFC 9421 HTTP Message Signatures (Ed25519)",
         CYAN, Inches(1.8), Inches(1.5)),
        ("2. Core Backend & Ledger Tier (FastAPI :8001)",
         "Deterministic ACID Ledger (ubuone_ledger & transactions)  •  Two-Tier Payment Consent Engine\n"
         "Family & Beneficiary RBAC  •  Open Payments Live Connector  •  Zero-Fee Micro-Payment Gateway",
         MINT, Inches(3.5), Inches(1.6)),
        ("3. Client Experience Tier (Vercel Live)",
         "Spaza Uniti Marketplace PWA (https://spaza-uniti.vercel.app): Geo-discovery, storefronts, cart checkout\n"
         "UbuOne Portal (https://ubu-one-seven.vercel.app): Counter till, change-in-UBU, family vaults & RBAC",
         PURPLE, Inches(5.3), Inches(1.6)),
    ]

    for title, desc, col, top_pos, h in tiers:
        add_card(s6, Inches(0.8), top_pos, Inches(11.7), h, BG_CARD, col)
        tb_t = s6.shapes.add_textbox(Inches(1.1), top_pos + Inches(0.15), Inches(11.1), h - Inches(0.3))
        tf_t = tb_t.text_frame
        tf_t.word_wrap = True
        p = tf_t.paragraphs[0]
        p.text = title
        p.font.size = Pt(17)
        p.font.bold = True
        p.font.color.rgb = col
        p_d = tf_t.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(12)
        p_d.font.color.rgb = WHITE

    s6.notes_slide.notes_text_frame.text = (
        "Here is our system topology. At the top is the Interledger testnet running Rafiki with GNAP authorization and "
        "RFC 9421 HTTP message signatures. In the center is our FastAPI core service orchestrating the deterministic ACID "
        "ledger and RBAC engine. At the bottom are our two deployed frontends: Spaza Uniti for consumers and UbuOne for "
        "merchants and family budgeting."
    )

    # =========================================================================
    # SLIDE 7: Platform Showcase: Spaza Uniti Marketplace
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7)
    add_header(s7, "Spaza Uniti: Customer Marketplace & Discovery PWA")

    # Left Image Card
    add_card(s7, Inches(0.8), Inches(1.7), Inches(6.5), Inches(5.2), BG_CARD, CYAN)
    if os.path.exists(img_uniti_dash):
        s7.shapes.add_picture(img_uniti_dash, Inches(0.95), Inches(1.85), width=Inches(6.2), height=Inches(4.9))

    # Right Content Column
    add_card(s7, Inches(7.5), Inches(1.7), Inches(5.0), Inches(5.2), BG_CARD, CYAN)
    tb_sc = s7.shapes.add_textbox(Inches(7.7), Inches(1.85), Inches(4.6), Inches(4.9))
    tf_sc = tb_sc.text_frame
    tf_sc.word_wrap = True

    p = tf_sc.paragraphs[0]
    p.text = "Township Marketplace PWA"
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = WHITE

    features_sc = [
        ("Geo-Proximity Discovery", "Finds nearby registered Spaza Units across Soweto, Khayelitsha, and Tembisa."),
        ("Storefront Federation", "Live broadcast of daily specials, discounts, and operating hours."),
        ("Dual-Action Cart Checkout", "Pay with Spendable UBU (R0 fee) or Bank / Open Payments Reserve."),
        ("Live Interledger Console", "Displays connected payment pointer, Key ID, and live ILP stream packets."),
        ("10% Loyalty Cashback", "Accumulates reward tokens toward a R20 local taxi fare."),
    ]
    for f_title, f_desc in features_sc:
        p = tf_sc.add_paragraph()
        p.text = "\n" + f_title
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = CYAN
        p_d = tf_sc.add_paragraph()
        p_d.text = f_desc
        p_d.font.size = Pt(11)
        p_d.font.color.rgb = WHITE

    s7.notes_slide.notes_text_frame.text = (
        "Spaza Uniti is a Progressive Web App giving township shoppers a modern, delightful discovery and checkout "
        "experience. Customers can find nearby stores, see real-time lunch specials, pay with spendable UBU at zero fee, "
        "and track their loyalty cashback toward free taxi rides."
    )

    # =========================================================================
    # SLIDE 8: Platform Showcase: UbuOne Till & Family Portal
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8)
    add_header(s8, "UbuOne: Merchant POS Till & Family Budgeting")

    # Left Content Column
    add_card(s8, Inches(0.8), Inches(1.7), Inches(5.2), Inches(5.2), BG_CARD, MINT)
    tb_u1 = s8.shapes.add_textbox(Inches(1.0), Inches(1.85), Inches(4.8), Inches(4.9))
    tf_u1 = tb_u1.text_frame
    tf_u1.word_wrap = True

    p = tf_u1.paragraphs[0]
    p.text = "Merchant Till & Family RBAC"
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = WHITE

    features_u1 = [
        ("Rapid Counter POS Till", "Cashier charges customer by handle (@katlego) and triggers instant 4-digit PIN verification."),
        ("Change-in-UBU Dispenser", "Eliminates unwanted bubblegum change disputes by sending exact digital change to customer's wallet."),
        ("Family Admin Vaults", "Pooled UBU budgeting with daily/weekly limits and child provisioning."),
        ("Adult Beneficiaries", "Direct peer-to-peer allowance streaming for elderly relatives and student siblings."),
        ("End-of-Day Settlement", "1-click batch payout to commercial bank accounts via Open Payments."),
    ]
    for f_title, f_desc in features_u1:
        p = tf_u1.add_paragraph()
        p.text = "\n" + f_title
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = MINT
        p_d = tf_u1.add_paragraph()
        p_d.text = f_desc
        p_d.font.size = Pt(11)
        p_d.font.color.rgb = WHITE

    # Right Image Card
    add_card(s8, Inches(6.3), Inches(1.7), Inches(6.2), Inches(5.2), BG_CARD, MINT)
    if os.path.exists(img_ubu_ui):
        s8.shapes.add_picture(img_ubu_ui, Inches(6.45), Inches(1.85), width=Inches(5.9), height=Inches(4.9))

    s8.notes_slide.notes_text_frame.text = (
        "UbuOne transforms any tablet or mobile phone into a township merchant till. It solves the famous coin shortage "
        "problem through our Change-in-UBU feature. On the consumer side, it provides Family Vaults where parents allocate "
        "allowances with strict spending limits."
    )

    # =========================================================================
    # SLIDE 9: Cryptography & Open Payments Standards
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    set_slide_background(s9)
    add_header(s9, "RFC 9421 Message Signatures & GNAP Protocol")

    # Left Column: RFC 9421
    add_card(s9, Inches(0.8), Inches(1.8), Inches(5.7), Inches(5.1), BG_CARD, GOLD)
    tb_s1 = s9.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(5.3), Inches(4.7))
    tf_s1 = tb_s1.text_frame
    tf_s1.word_wrap = True

    p = tf_s1.paragraphs[0]
    p.text = "RFC 9421 HTTP Signatures"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = GOLD

    specs_s1 = [
        "Cryptographic Authentication: Every outgoing request to Rafiki is signed using an Ed25519 private key.",
        "Covered Components: @method, @target-uri, content-digest (SHA-512 base64), authorization header.",
        "Zero Node Dependencies: Custom pure-Python cryptographic signing engine using cryptographyhazmat.",
        "Key Verification: Key ID d644f013... verified live against testnet JWKS document."
    ]
    for sp in specs_s1:
        p = tf_s1.add_paragraph()
        p.text = "\n• " + sp
        p.font.size = Pt(12)
        p.font.color.rgb = WHITE

    # Right Column: GNAP Protocol
    add_card(s9, Inches(6.8), Inches(1.8), Inches(5.7), Inches(5.1), BG_CARD, CYAN)
    tb_s2 = s9.shapes.add_textbox(Inches(7.0), Inches(2.0), Inches(5.3), Inches(4.7))
    tf_s2 = tb_s2.text_frame
    tf_s2.word_wrap = True

    p = tf_s2.paragraphs[0]
    p.text = "GNAP Grant Authorization"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = CYAN

    specs_s2 = [
        "Interactive Consent: Direct redirect to auth.interledger-test.dev/interact for user approval.",
        "Non-Interactive Grants: Pre-authorized token exchange for merchant incoming payments.",
        "Access Types: incoming-payment (create/read/list) and outgoing-payment with exact debit limits.",
        "ILP Streaming: Live receipt generation with verified packet addresses (local.test.net...)."
    ]
    for sp in specs_s2:
        p = tf_s2.add_paragraph()
        p.text = "\n• " + sp
        p.font.size = Pt(12)
        p.font.color.rgb = WHITE

    s9.notes_slide.notes_text_frame.text = (
        "We implemented full cryptographic compliance with Open Payments standards. Our backend generates genuine "
        "RFC 9421 HTTP message signatures in pure Python using Ed25519 keys, matching the exact format required by Rafiki. "
        "We support GNAP for both interactive user consent and non-interactive server grants."
    )

    # =========================================================================
    # SLIDE 10: Technical Challenges & Engineering Breakthroughs
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    set_slide_background(s10)
    add_header(s10, "Challenges Encountered & Technical Breakthroughs")

    challenges = [
        ("Cloudflare 403 WAF Blocks on Testnet",
         "The Interledger testnet rejects default Python urllib User-Agents with HTTP 403 Forbidden.",
         "Implemented RFC-compliant custom client headers (SpazaUniti-OpenPayments/1.0) across all outgoing requests.",
         CYAN),
        ("RFC 9421 Signature Coverage Nuances",
         "Rafiki requires specific covered components for auth server vs resource server (adding 'authorization').",
         "Engineered dynamic signature base generator handling SHA-512 content-digests and Ed25519 base64 encoding.",
         GOLD),
        ("Micro-Payment Economic Destruction",
         "Traditional swipe fees make R3 snack purchases unprofitable for township merchants.",
         "Created the 1:1 UBU liquidity pool where 1 Open Payments inflow enables hundreds of zero-fee micro-transactions.",
         MINT),
        ("Real-Time Cross-App Ledger Consistency",
         "Customer purchases on Spaza Uniti must immediately reflect in UbuOne merchant cashiers' tills.",
         "Built a unified SQLite transactional engine with row-level locking and synchronized ledger events.",
         PURPLE),
    ]

    for i, (c_title, c_prob, c_sol, col) in enumerate(challenges):
        row = i // 2
        col_idx = i % 2
        bx = Inches(0.8 + col_idx * 5.95)
        by = Inches(1.7 + row * 2.7)
        bw = Inches(5.65)
        bh = Inches(2.45)

        add_card(s10, bx, by, bw, bh, BG_CARD, col)
        tb_ch = s10.shapes.add_textbox(bx + Inches(0.2), by + Inches(0.15), bw - Inches(0.4), bh - Inches(0.3))
        tf_ch = tb_ch.text_frame
        tf_ch.word_wrap = True

        p = tf_ch.paragraphs[0]
        p.text = c_title
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = col

        p_pr = tf_ch.add_paragraph()
        p_pr.text = "Challenge: " + c_prob
        p_pr.font.size = Pt(11)
        p_pr.font.color.rgb = WHITE

        p_so = tf_ch.add_paragraph()
        p_so.text = "Resolution: " + c_sol
        p_so.font.size = Pt(11)
        p_so.font.bold = True
        p_so.font.color.rgb = col

    s10.notes_slide.notes_text_frame.text = (
        "Building on bleeding-edge protocols brings real hurdles. We overcame Cloudflare WAF blocks on the testnet, "
        "solved exact RFC 9421 signature coverage requirements for Rafiki, engineered the 1:1 UBU buffer to defeat "
        "interchange fees, and unified the transactional ledger so purchases instantly reflect across all cashiers."
    )

    # =========================================================================
    # SLIDE 11: Expected Impact & Economic Scalability
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    set_slide_background(s11)
    add_header(s11, "Quantifiable Socio-Economic Impact & Scalability")

    # Left: Household Impact
    add_card(s11, Inches(0.8), Inches(1.8), Inches(5.7), Inches(5.1), BG_CARD, CYAN)
    tb_h1 = s11.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(5.3), Inches(4.7))
    tf_h1 = tb_h1.text_frame
    tf_h1.word_wrap = True
    p = tf_h1.paragraphs[0]
    p.text = "Township Household Impact"
    p.font.size = Pt(19)
    p.font.bold = True
    p.font.color.rgb = CYAN

    h_items = [
        "Saves R180 - R320 Monthly: Eradicates predatory commercial bank ATM withdrawal charges.",
        "Prevents Lost / Stolen Cash: Zero physical cash required for daily school snacks and bread.",
        "Communal Budgeting: Family heads set daily allowance caps that prevent overspending.",
        "Transit Cashback: 10% loyalty reward accumulates into free R20 taxi rides."
    ]
    for it in h_items:
        p = tf_h1.add_paragraph()
        p.text = "\n• " + it
        p.font.size = Pt(12)
        p.font.color.rgb = WHITE

    # Right: Merchant Impact
    add_card(s11, Inches(6.8), Inches(1.8), Inches(5.7), Inches(5.1), BG_CARD, MINT)
    tb_h2 = s11.shapes.add_textbox(Inches(7.0), Inches(2.0), Inches(5.3), Inches(4.7))
    tf_h2 = tb_h2.text_frame
    tf_h2.word_wrap = True
    p = tf_h2.paragraphs[0]
    p.text = "Spaza Merchant Impact"
    p.font.size = Pt(19)
    p.font.bold = True
    p.font.color.rgb = MINT

    m_items = [
        "Eradicates Cash Robbery Risk: Eliminates large physical cash floats in informal stores.",
        "Zero Interchange Drag: Saves 2.5% to 4% merchant swipe fees on small items.",
        "Zero Coin Shortage Disputes: Change-in-UBU dispenses exact digital change to phones.",
        "Federated Commerce: Real-time broadcast brings 25%+ more foot traffic from neighbors."
    ]
    for it in m_items:
        p = tf_h2.add_paragraph()
        p.text = "\n• " + it
        p.font.size = Pt(12)
        p.font.color.rgb = WHITE

    s11.notes_slide.notes_text_frame.text = (
        "The socio-economic impact is immediate. For a household earning R4,000 monthly, saving R250 in ATM fees "
        "and earning free taxi trips represents an 8% boost in disposable income. For spaza merchants, eliminating cash "
        "protects lives against armed robbery and ends coin shortages."
    )

    # =========================================================================
    # SLIDE 12: Future Roadmap & Next Horizon
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    set_slide_background(s12)
    add_header(s12, "Strategic Product Roadmap")

    phases = [
        ("Phase 1: 2026 Q4 (Delivered)",
         "Live Open Payments Testnet ($ilp.interledger-test.dev)\n"
         "Spaza Uniti Marketplace PWA & Discovery (Vercel)\n"
         "UbuOne Merchant Till, Change Dispenser & Family RBAC",
         MINT),
        ("Phase 2: 2027 Q1 (Resilience)",
         "WhatsApp Voice Bot Hook for conversational ordering\n"
         "Native Android PWA with offline caching\n"
         "BLE Mesh Offline Verification during loadshedding power cuts",
         CYAN),
        ("Phase 3: 2027 Q2 (B2B Wholesale)",
         "FMCG Wholesale B2B purchasing rails (Tiger Brands / Pioneer)\n"
         "Bulk Buying Syndicates: 10+ Spaza Units pool UBU for discounts\n"
         "PayShap National Rail Bridge directly to Open Payments",
         GOLD),
        ("Phase 4: 2027 Q3+ (Macro Scale)",
         "SASSA Government Social Grants direct deposit into vaults\n"
         "Micro-Working Capital automated credit scoring\n"
         "SADC Cross-Border Remittance Corridors over Interledger",
         PURPLE),
    ]

    for i, (ph_title, ph_desc, col) in enumerate(phases):
        bx = Inches(0.8 + i * 2.95)
        by = Inches(1.8)
        bw = Inches(2.75)
        bh = Inches(5.1)

        add_card(s12, bx, by, bw, bh, BG_CARD, col)
        tb_ph = s12.shapes.add_textbox(bx + Inches(0.15), by + Inches(0.2), bw - Inches(0.3), bh - Inches(0.4))
        tf_ph = tb_ph.text_frame
        tf_ph.word_wrap = True

        p = tf_ph.paragraphs[0]
        p.text = ph_title
        p.font.size = Pt(15)
        p.font.bold = True
        p.font.color.rgb = col

        p_d = tf_ph.add_paragraph()
        p_d.text = "\n" + ph_desc
        p_d.font.size = Pt(11)
        p_d.font.color.rgb = WHITE

    s12.notes_slide.notes_text_frame.text = (
        "Looking ahead, our roadmap extends from retail checkout to B2B wholesale syndicates where neighboring spazas "
        "pool purchasing power to buy bulk maize and oil directly from manufacturers over Interledger. In subsequent phases, "
        "we integrate PayShap and SASSA social grants directly into family vaults."
    )

    # =========================================================================
    # SLIDE 13: Conclusion & Live Demonstration Links
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    set_slide_background(s13)
    if os.path.exists(img_ubu_wall1):
        s13.shapes.add_picture(img_ubu_wall1, Inches(0), Inches(0), width=Inches(13.333), height=Inches(7.5))
        overlay = s13.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        overlay.fill.solid()
        overlay.fill.fore_color.rgb = RGBColor(9, 14, 26)
        overlay.fill.transparency = 0.25
        overlay.line.fill.background()

    c_end = add_card(s13, Inches(1.5), Inches(1.0), Inches(10.3), Inches(5.5), RGBColor(12, 17, 30), CYAN)

    tb_e = s13.shapes.add_textbox(Inches(1.8), Inches(1.3), Inches(9.7), Inches(1.4))
    tf_e = tb_e.text_frame
    p = tf_e.paragraphs[0]
    p.text = "Empowering Township Prosperity"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p2 = tf_e.add_paragraph()
    p2.text = "Open Protocols • Local Sovereignty • Zero Friction"
    p2.font.size = Pt(16)
    p2.font.color.rgb = CYAN

    # Links Box
    add_card(s13, Inches(1.8), Inches(2.9), Inches(9.7), Inches(2.2), BG_CARD_LIGHT, MINT)
    tb_links = s13.shapes.add_textbox(Inches(2.0), Inches(3.0), Inches(9.3), Inches(2.0))
    tf_links = tb_links.text_frame
    tf_links.word_wrap = True

    p = tf_links.paragraphs[0]
    p.text = "LIVE PRODUCTION DEPLOYMENTS & DEMO LINKS"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = MINT

    demo_links = [
        "Spaza Uniti Customer Marketplace PWA:  https://spaza-uniti.vercel.app",
        "UbuOne Merchant Till & Family Portal:   https://ubu-one-seven.vercel.app",
        "Interledger Testnet Payment Pointer:    $ilp.interledger-test.dev/2f0b6b2c",
        "Ed25519 Public Key ID:                 d644f013-289b-4c24-9cbe-c3e174cb5a0e"
    ]
    for dl in demo_links:
        p = tf_links.add_paragraph()
        p.text = "• " + dl
        p.font.size = Pt(12)
        p.font.color.rgb = WHITE

    tb_ty = s13.shapes.add_textbox(Inches(1.8), Inches(5.3), Inches(9.7), Inches(0.8))
    p_ty = tb_ty.text_frame.paragraphs[0]
    p_ty.text = "Thank you! We welcome your questions."
    p_ty.font.size = Pt(20)
    p_ty.font.bold = True
    p_ty.font.color.rgb = GOLD
    p_ty.alignment = PP_ALIGN.CENTER

    s13.notes_slide.notes_text_frame.text = (
        "To conclude: Spaza Uniti and UbuOne prove that the township economy does not need second-class solutions. "
        "By utilizing open standards like Interledger and Open Payments, we give local merchants the power to compete "
        "and give township families the dignity of zero-fee digital commerce. Both applications are running live on "
        "Vercel and verified against the Interledger testnet. Thank you, and we welcome your questions."
    )

    out_path = os.path.join(base_dir, "presentation.pptx")
    prs.save(out_path)
    print(f"Presentation saved successfully to: {out_path}")

if __name__ == "__main__":
    create_deck()
