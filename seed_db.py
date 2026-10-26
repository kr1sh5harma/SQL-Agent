"""
seed_db.py — Creates a sample SQLite database with realistic e-commerce data.
Run this once to have data to query against.

Usage: python seed_db.py

Creates: backend/data/default.db with tables:
  - products    (id, name, category, price, stock)
  - customers   (id, name, email, city)
  - orders      (id, customer_id, product_id, quantity, total, date)
"""

import sqlite3
import os
import random
from datetime import datetime, timedelta

DB_PATH = os.path.join("backend", "data", "default.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# ── Products ──────────────────────────────────────────────────────────────────
cur.execute("DROP TABLE IF EXISTS products")
cur.execute("""
CREATE TABLE products (
    id       INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL,
    price    REAL NOT NULL,
    stock    INTEGER NOT NULL
)
""")

products = [
    (1, "Laptop Pro 15",      "Electronics",   89999, 45),
    (2, "Wireless Earbuds",   "Electronics",    2999, 200),
    (3, "USB-C Hub",          "Electronics",    1499, 150),
    (4, "Mechanical Keyboard","Electronics",    5999, 80),
    (5, "Running Shoes",      "Sports",         3499, 120),
    (6, "Yoga Mat",           "Sports",          999, 300),
    (7, "Water Bottle",       "Sports",          599, 400),
    (8, "Python Cookbook",    "Books",           799, 250),
    (9, "Design Patterns",    "Books",           899, 180),
    (10,"Coffee Maker",       "Kitchen",        4999, 60),
    (11,"Air Fryer",          "Kitchen",        6499, 75),
    (12,"Desk Lamp LED",      "Electronics",    1299, 130),
    (13,"Gaming Mouse",       "Electronics",    2499, 95),
    (14,"Protein Powder",     "Sports",         2199, 180),
    (15,"Novel: The Loop",    "Books",           499, 350),
]
cur.executemany("INSERT INTO products VALUES (?,?,?,?,?)", products)

# ── Customers ─────────────────────────────────────────────────────────────────
cur.execute("DROP TABLE IF EXISTS customers")
cur.execute("""
CREATE TABLE customers (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    city  TEXT NOT NULL
)
""")

customers = [
    (1,  "Rahul Sharma",    "rahul@example.com",    "Mumbai"),
    (2,  "Priya Verma",     "priya@example.com",    "Delhi"),
    (3,  "Amit Patel",      "amit@example.com",     "Ahmedabad"),
    (4,  "Sneha Iyer",      "sneha@example.com",    "Chennai"),
    (5,  "Rohan Gupta",     "rohan@example.com",    "Kolkata"),
    (6,  "Ananya Singh",    "ananya@example.com",   "Bangalore"),
    (7,  "Kiran Mehta",     "kiran@example.com",    "Pune"),
    (8,  "Deepak Nair",     "deepak@example.com",   "Hyderabad"),
    (9,  "Pooja Reddy",     "pooja@example.com",    "Bangalore"),
    (10, "Vikas Yadav",     "vikas@example.com",    "Mumbai"),
]
cur.executemany("INSERT INTO customers VALUES (?,?,?,?)", customers)

# ── Orders ────────────────────────────────────────────────────────────────────
cur.execute("DROP TABLE IF EXISTS orders")
cur.execute("""
CREATE TABLE orders (
    id          INTEGER PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    product_id  INTEGER REFERENCES products(id),
    quantity    INTEGER NOT NULL,
    total       REAL NOT NULL,
    order_date  TEXT NOT NULL
)
""")

random.seed(42)
orders = []
base_date = datetime(2024, 1, 1)
for i in range(1, 201):
    cid  = random.randint(1, 10)
    pid  = random.randint(1, 15)
    qty  = random.randint(1, 4)
    price = products[pid - 1][3]
    total = round(price * qty * random.uniform(0.9, 1.0), 2)
    date  = (base_date + timedelta(days=random.randint(0, 364))).strftime("%Y-%m-%d")
    orders.append((i, cid, pid, qty, total, date))

cur.executemany("INSERT INTO orders VALUES (?,?,?,?,?,?)", orders)

conn.commit()
conn.close()

print(f"[OK] Sample database created at: {DB_PATH}")
print("   Tables: products (15 rows), customers (10 rows), orders (200 rows)")
print()
print("Try asking:")
print('  "What are the top 5 products by total revenue?"')
print('  "Which city has the most customers?"')
print('  "Show monthly order count for 2024"')
