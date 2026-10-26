"""
database.py — Database manager.

Responsibilities:
  • Connect to a SQLite database file
  • Load a CSV file into a table (CREATE TABLE + INSERT from pandas)
  • List all tables
  • Describe a table's schema (columns + types)
  • Execute a SQL query and return rows as list[dict]
  • Enforce read-only mode for SELECT to protect production data
"""

import sqlite3
import os
import csv
from typing import Any
from app.config import DATA_DIR


class DatabaseManager:
    def __init__(self, db_path: str):
        os.makedirs(DATA_DIR, exist_ok=True)
        self.db_path = db_path
        # check_same_thread=False is safe here because FastAPI uses async
        # and we serialize DB access through our own methods.
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row  # rows behave like dicts

    # ── Schema tools (used by agent) ──────────────────────────────────────────

    def list_tables(self) -> list[str]:
        """Return all user-created table names."""
        cur = self._conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
        )
        return [row[0] for row in cur.fetchall()]

    def describe_table(self, table: str) -> list[dict]:
        """
        Return column info for a table:
          [{"cid": 0, "name": "id", "type": "INTEGER", "notnull": 1, ...}, ...]
        """
        # Validate table name to prevent SQL injection (sqlite3 can't parameterize PRAGMA)
        if table not in self.list_tables():
            raise ValueError(f"Table '{table}' does not exist.")
        cur = self._conn.execute(f"PRAGMA table_info('{table}');")
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    def sample_rows(self, table: str, n: int = 3) -> list[dict]:
        """Return n sample rows so the agent can understand data shape."""
        if table not in self.list_tables():
            raise ValueError(f"Table '{table}' does not exist.")
        cur = self._conn.execute(f"SELECT * FROM '{table}' LIMIT {n};")
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    # ── Query execution ───────────────────────────────────────────────────────

    def execute_query(self, sql: str) -> list[dict]:
        """
        Run any SQL and return rows as list[dict].
        For non-SELECT statements (INSERT/UPDATE/DELETE/CREATE), commits and
        returns a status dict instead of rows.
        """
        cleaned = sql.strip().rstrip(";")
        is_select = cleaned.upper().startswith("SELECT") or cleaned.upper().startswith("WITH")

        try:
            cur = self._conn.execute(cleaned)
            if is_select:
                cols = [desc[0] for desc in cur.description]
                return [dict(zip(cols, row)) for row in cur.fetchall()]
            else:
                self._conn.commit()
                return [{"status": "ok", "rowcount": cur.rowcount}]
        except sqlite3.Error as e:
            raise RuntimeError(f"SQL Error: {e}") from e

    # ── CSV loader ────────────────────────────────────────────────────────────

    def load_csv(self, csv_path: str, table_name: str) -> str:
        """
        Read a CSV file and INSERT all rows into a new SQLite table.
        Columns are inferred from the CSV header.
        Returns a status message.
        """
        try:
            import pandas as pd
            import re

            df = None
            encodings = ["utf-8", "utf-8-sig", "latin1", "cp1252", "iso-8859-1"]
            for encoding in encodings:
                try:
                    df = pd.read_csv(csv_path, encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue

            if df is None:
                df = pd.read_csv(csv_path)

            # SQLite-safe column names: alphanumeric and underscores only
            clean_cols = []
            for i, col in enumerate(df.columns):
                c = re.sub(r"[^a-zA-Z0-9_]", "_", str(col).strip().lower())
                c = re.sub(r"_+", "_", c).strip("_")
                if not c or c[0].isdigit():
                    c = f"col_{c}" if c else f"col_{i+1}"
                clean_cols.append(c)

            seen = {}
            unique_cols = []
            for c in clean_cols:
                if c in seen:
                    seen[c] += 1
                    unique_cols.append(f"{c}_{seen[c]}")
                else:
                    seen[c] = 0
                    unique_cols.append(c)
            df.columns = unique_cols

            df.to_sql(table_name, self._conn, if_exists="replace", index=False)
            self._conn.commit()
            return f"Loaded {len(df)} rows into table '{table_name}'."
        except Exception as e:
            raise RuntimeError(f"CSV load error: {e}") from e

    # ── Table management (Create, Delete, Summary, Reset) ────────────────────

    def delete_table(self, table: str) -> str:
        """Drop a table from SQLite database."""
        if table not in self.list_tables():
            raise ValueError(f"Table '{table}' does not exist.")
        self._conn.execute(f'DROP TABLE "{table}";')
        self._conn.commit()
        return f"Table '{table}' deleted successfully."

    def create_table(self, table_name: str, columns: list[dict]) -> str:
        """
        Create a table with specified columns:
        columns = [{"name": "id", "type": "INTEGER PRIMARY KEY"}, {"name": "title", "type": "TEXT"}]
        """
        import re
        safe_table = re.sub(r"[^a-zA-Z0-9_]", "_", table_name.strip().lower()).strip("_")
        if not safe_table:
            raise ValueError("Table name must contain alphanumeric characters.")
        if safe_table in self.list_tables():
            raise ValueError(f"Table '{safe_table}' already exists.")

        col_defs = []
        for col in columns:
            name = re.sub(r"[^a-zA-Z0-9_]", "_", col.get("name", "").strip().lower()).strip("_")
            if not name:
                continue
            col_type = col.get("type", "TEXT").strip() or "TEXT"
            col_defs.append(f'"{name}" {col_type}')

        if not col_defs:
            raise ValueError("At least one valid column definition is required.")

        ddl = f'CREATE TABLE "{safe_table}" ({", ".join(col_defs)});'
        self._conn.execute(ddl)
        self._conn.commit()
        return f"Table '{safe_table}' created successfully."

    def get_tables_summary(self) -> list[dict]:
        """Return list of tables with row count, column count, and column names."""
        tables = self.list_tables()
        summary = []
        for t in tables:
            try:
                cur = self._conn.execute(f'SELECT COUNT(*) FROM "{t}";')
                count = cur.fetchone()[0]
                cols = self.describe_table(t)
                summary.append({
                    "name": t,
                    "row_count": count,
                    "column_count": len(cols),
                    "columns": [c["name"] for c in cols],
                })
            except Exception:
                summary.append({
                    "name": t,
                    "row_count": 0,
                    "column_count": 0,
                    "columns": [],
                })
        return summary

    def reset_demo(self) -> str:
        """Reset and re-seed the standard demo tables (products, customers, orders)."""
        import random
        from datetime import datetime, timedelta

        cur = self._conn.cursor()

        # Products
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

        # Customers
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

        # Orders
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
            days = random.randint(0, 300)
            odate = (base_date + timedelta(days=days)).strftime("%Y-%m-%d")
            orders.append((i, cid, pid, qty, qty * price, odate))
        cur.executemany("INSERT INTO orders VALUES (?,?,?,?,?,?)", orders)

        self._conn.commit()
        return "Demo tables (products, customers, orders) re-seeded successfully."

    def close(self):
        self._conn.close()
