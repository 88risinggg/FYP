import csv
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(42)

OUTPUT_PATH = Path("c:/FYP/FYP/invoice_fraud_test_data.csv")

company_name = "Vaniday Pte. Ltd."
customer_names = [
    "Alicia Tan", "Marcus Lee", "Priya Nair", "Daniel Lim", "Siti Rahman", "Jason Ong",
    "Nurul Hassan", "Lina Koh", "Ethan Chan", "Jasmine Ng", "Wei Ming Teo", "Megan Lim",
    "Ravi Kumar", "Claire Wong", "Adrian Goh", "Hafiz Ismail", "Shirley Yeo", "Kevin Ho",
    "Farah Ali", "Darren Seah", "Phyllis Low", "Bryan Chia", "Nadia Rahim", "Calvin Tan",
    "Kavitha Ravi", "Michael Sim", "Tina Yap", "Harish Menon", "Yvonne Chua", "Samuel Yii"
]
customer_domains = ["gmail.com", "yahoo.com", "outlook.com", "live.com", "vanidaytest.com", "mail.com"]
payment_methods = ["PayNow", "Bank Transfer", "Credit Card", "Visa", "Apple Pay", "Google Pay", "Card"]
created_by = ["jane.ng", "rachel.lim", "michael.tan", "sarah.chen", "ops@vaniday.com", "finance@vaniday.com"]
notes_pool = [
    "Standard monthly invoice",
    "Retention contract billed in advance",
    "Customer requested split payment",
    "Duplicate amount pattern observed",
    "Applied discretionary discount",
    "Urgent follow-up requested",
    "Round-number invoice for bulk settlement",
    "High-value consultancy engagement",
    "Payment received promptly",
    "Past due reminder issued",
    "Suspicious repeated invoice pattern",
    "Customer has multiple overdue balances",
    "Manual review required",
    "Payment posted after invoice creation",
    "No customer contact details provided"
]

# Risk distribution targets
low_risk_target = 364
medium_risk_target = 140
high_risk_target = 56

rows = []
base_date = date(2025, 1, 1)

# Generate reference invoice numbers and IDs
invoice_counter = 1

# Helper functions

def make_invoice_number(idx):
    return f"INV-2026-{idx:06d}"


def make_issue_date(offset_days):
    return (date(2025, 1, 1) + timedelta(days=offset_days)).isoformat()


def make_due_date(issue, days):
    return (issue + timedelta(days=days)).isoformat()


def calculate_tax(amount):
    return round(amount * 0.09, 2)


def calculate_total(amount, discount, tax):
    return round(amount - discount + tax, 2)


def random_date_between(start_year, end_year):
    start = date(start_year, 1, 1)
    end = date(end_year, 12, 31)
    delta = end - start
    day = start + timedelta(days=random.randint(0, delta.days))
    return day


# Low risk invoices
for _ in range(low_risk_target):
    amount = round(random.uniform(150, 9500), 2)
    discount = round(random.uniform(0, 150), 2)
    tax_amount = round(amount * 0.09, 2)
    total_amount = round(amount - discount + tax_amount, 2)
    issue_date = random_date_between(2025, 2026)
    due_date = issue_date + timedelta(days=random.choice([14, 21, 30, 45]))
    payment_date = None
    status = random.choice(["Draft", "Sent", "Viewed", "Paid"])
    if status == "Paid":
        payment_date = (issue_date + timedelta(days=random.randint(0, 7))).isoformat()
    elif status == "Draft":
        issue_date = random_date_between(2026, 2026)
        due_date = issue_date + timedelta(days=random.choice([14, 30]))
    elif status == "Scheduled":
        issue_date = random_date_between(2026, 2026)
        due_date = issue_date + timedelta(days=random.choice([14, 30]))
    elif status == "Viewed":
        issue_date = random_date_between(2025, 2026)
    customer_name = random.choice(customer_names)
    email = f"{customer_name.lower().replace(' ', '.')}@{random.choice(customer_domains)}"
    payment_date_value = payment_date.isoformat() if isinstance(payment_date, date) else (payment_date if payment_date else "")
    rows.append({
        "invoice_id": f"INV-{invoice_counter:06d}",
        "invoice_number": make_invoice_number(invoice_counter),
        "customer_name": customer_name,
        "company_name": company_name,
        "customer_email": email,
        "issue_date": issue_date.isoformat(),
        "due_date": due_date.isoformat(),
        "amount": f"{amount:.2f}",
        "currency": "SGD",
        "tax_amount": f"{tax_amount:.2f}",
        "discount": f"{discount:.2f}",
        "total_amount": f"{total_amount:.2f}",
        "payment_method": random.choice(payment_methods),
        "payment_date": payment_date_value,
        "invoice_status": status,
        "created_by": random.choice(created_by),
        "notes": random.choice(notes_pool),
    })
    invoice_counter += 1

# Medium risk invoices
for _ in range(medium_risk_target):
    amount = round(random.choice([1500.0, 2200.0, 5000.0, 7200.0, 9000.0]), 2)
    discount = round(random.uniform(300, 1500), 2)
    tax_amount = round(amount * 0.09, 2)
    total_amount = round(amount - discount + tax_amount, 2)
    issue_date = random_date_between(2025, 2026)
    due_date = issue_date + timedelta(days=random.choice([5, 10, 12, 15]))
    payment_date = None
    invoice_status = random.choice(["Paid", "Sent", "Viewed", "Overdue"])
    if invoice_status == "Paid":
        payment_date = (issue_date + timedelta(days=random.randint(0, 2))).isoformat()
    if invoice_status == "Overdue":
        due_date = date.today() - timedelta(days=random.randint(5, 45))
    customer_name = random.choice(customer_names)
    email = f"{customer_name.lower().replace(' ', '.')}@{random.choice(customer_domains)}"
    # Duplicate amount and repeated customer pattern
    if random.random() < 0.4:
        amount = 2200.0
    if random.random() < 0.35:
        customer_name = random.choice(customer_names)
    payment_date_value = payment_date.isoformat() if isinstance(payment_date, date) else (payment_date if payment_date else "")
    rows.append({
        "invoice_id": f"INV-{invoice_counter:06d}",
        "invoice_number": make_invoice_number(invoice_counter),
        "customer_name": customer_name,
        "company_name": company_name,
        "customer_email": email,
        "issue_date": issue_date.isoformat(),
        "due_date": due_date.isoformat(),
        "amount": f"{amount:.2f}",
        "currency": "SGD",
        "tax_amount": f"{tax_amount:.2f}",
        "discount": f"{discount:.2f}",
        "total_amount": f"{total_amount:.2f}",
        "payment_method": random.choice(payment_methods),
        "payment_date": payment_date_value,
        "invoice_status": invoice_status,
        "created_by": random.choice(created_by),
        "notes": "Medium-risk duplicate pattern with unusual discount",
    })
    invoice_counter += 1

# High risk invoices
for i in range(high_risk_target):
    amount = round(random.choice([10000.0, 15000.0, 25000.0, 50000.0, 75000.0, 100000.0]), 2)
    if i % 6 == 0:
        amount = -5000.0
    if i % 5 == 0:
        amount = round(random.choice([10000.0, 50000.0]), 2)
    discount = round(random.uniform(9000, 10000), 2) if i % 4 == 0 else round(random.uniform(0, 100), 2)
    tax_amount = round(amount * 0.09, 2)
    total_amount = round(amount - discount + tax_amount, 2)
    issue_date = random_date_between(2025, 2026)
    due_date = issue_date + timedelta(days=random.choice([-10, -5, 0, 2]))
    payment_date = ""
    status = random.choice(["Draft", "Scheduled", "Sent", "Overdue", "Paid"])
    if status == "Paid":
        payment_date = (issue_date + timedelta(days=random.randint(0, 3))).isoformat()
    if status == "Scheduled":
        issue_date = date(2026, 12, 1) + timedelta(days=i)
    if status == "Overdue":
        due_date = date.today() - timedelta(days=random.randint(10, 90))
    customer_name = random.choice(customer_names)
    if i % 7 == 0:
        customer_name = ""
    if i % 10 == 0:
        customer_email = "not-an-email"
    elif i % 8 == 0:
        customer_email = "duplicate.user@example.com"
    else:
        customer_email = f"{customer_name.lower().replace(' ', '.')}@{random.choice(customer_domains)}" if customer_name else ""
    payment_date_value = payment_date.isoformat() if isinstance(payment_date, date) else (payment_date if payment_date else "")
    rows.append({
        "invoice_id": f"INV-{invoice_counter:06d}",
        "invoice_number": make_invoice_number(1 + (i % 5)),  # duplicate invoice numbers on purpose
        "customer_name": customer_name,
        "company_name": company_name,
        "customer_email": customer_email,
        "issue_date": issue_date.isoformat(),
        "due_date": due_date.isoformat(),
        "amount": f"{amount:.2f}",
        "currency": "SGD",
        "tax_amount": f"{tax_amount:.2f}",
        "discount": f"{discount:.2f}",
        "total_amount": f"{total_amount:.2f}",
        "payment_method": random.choice(payment_methods),
        "payment_date": payment_date_value,
        "invoice_status": status,
        "created_by": random.choice(created_by),
        "notes": "High-risk anomaly with duplicate number and extreme values",
    })
    invoice_counter += 1

# Add repeated rows for identical customer, amount, dates, and invoice numbers to create suspicious patterns
for _ in range(25):
    base = rows[0]
    rows.append({
        "invoice_id": f"INV-{invoice_counter:06d}",
        "invoice_number": base["invoice_number"],
        "customer_name": base["customer_name"],
        "company_name": company_name,
        "customer_email": base["customer_email"],
        "issue_date": base["issue_date"],
        "due_date": base["due_date"],
        "amount": base["amount"],
        "currency": "SGD",
        "tax_amount": base["tax_amount"],
        "discount": base["discount"],
        "total_amount": base["total_amount"],
        "payment_method": base["payment_method"],
        "payment_date": base["payment_date"],
        "invoice_status": "Overdue",
        "created_by": random.choice(created_by),
        "notes": "Repeated invoice copy with identical customer and amount",
    })
    invoice_counter += 1

# Shuffle rows to mix risks and ensure realistic ordering
random.shuffle(rows)

fieldnames = [
    "invoice_id", "invoice_number", "customer_name", "company_name", "customer_email",
    "issue_date", "due_date", "amount", "currency", "tax_amount", "discount", "total_amount",
    "payment_method", "payment_date", "invoice_status", "created_by", "notes"
]

with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as fh:
    writer = csv.DictWriter(fh, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)

print(f"Wrote {len(rows)} rows to {OUTPUT_PATH}")
