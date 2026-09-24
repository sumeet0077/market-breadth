import unittest
import os
import json
import tempfile
import duckdb

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "scripts"))

from ingest_daily import detect_and_register_corporate_actions
from etf_util import load_etf_symbols, is_etf_or_re

class TestCorporateActionEngine(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.ca_file = os.path.join(self.temp_dir.name, "corporate_actions.json")
        with open(self.ca_file, "w") as f:
            json.dump([], f)
        self.con = duckdb.connect(":memory:")

    def tearDown(self):
        self.con.close()
        self.temp_dir.cleanup()

    def _setup_daily_source(self, rows):
        """
        rows: list of tuples:
        (Symbol, Series, DateStr, PrevClose, Open, High, Low, Close, Volume)
        """
        self.con.execute("""
            CREATE OR REPLACE TEMP TABLE daily_source (
                Symbol VARCHAR,
                Series VARCHAR,
                DateStr VARCHAR,
                PrevClose DOUBLE,
                Open DOUBLE,
                High DOUBLE,
                Low DOUBLE,
                Close DOUBLE,
                Volume BIGINT
            )
        """)
        for r in rows:
            self.con.execute("INSERT INTO daily_source VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", r)

    def test_policybzr_crash_rejection(self):
        """Verify that POLICYBZR -36% market plunge is strictly rejected by the Triple Fingerprint."""
        # POLICYBZR on 2026-09-24:
        # PrevClose = 1886.25, Open = 1697.7, High = 1697.7, Low = 1207.2, Close = 1207.2
        # drop = 0.63998, open_ratio = 0.900, intra_vol = 0.2889, high_ratio = 0.900
        rows = [
            ('POLICYBZR', 'EQ', '24-Sep-2026', 1886.25, 1697.7, 1697.7, 1207.2, 1207.2, 27348784)
        ]
        self._setup_daily_source(rows)
        
        detect_and_register_corporate_actions(
            self.con, 
            ca_path=self.ca_file, 
            official_actions={}
        )

        with open(self.ca_file, "r") as f:
            actions = json.load(f)
        self.assertEqual(len(actions), 0, "POLICYBZR must not be auto-detected as a corporate action!")

    def test_genuine_1_to_2_bonus_triple_fingerprint(self):
        """Verify that a genuine 1:2 bonus issue passes the Triple Fingerprint."""
        # PrevClose = 1500, Open = 1000, High = 1020, Low = 990, Close = 1005
        # drop = 0.670, open_ratio = 0.6667, intra_vol = 0.005, high_ratio = 0.680
        rows = [
            ('GENUINEBONUS', 'EQ', '24-Sep-2026', 1500.0, 1000.0, 1020.0, 990.0, 1005.0, 500000)
        ]
        self._setup_daily_source(rows)

        detect_and_register_corporate_actions(
            self.con, 
            ca_path=self.ca_file, 
            official_actions={}
        )

        with open(self.ca_file, "r") as f:
            actions = json.load(f)
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]['symbol'], 'GENUINEBONUS')
        self.assertEqual(actions[0]['action'], 'BONUS')
        self.assertEqual(actions[0]['ratio'], 1.5)
        self.assertIn("auto-detected", actions[0]['description'])

    def test_official_circular_dividend_rejection(self):
        """Verify Gate 1 rejects candidates that have official dividend announcements."""
        # Stock drops 34%, but NSE official circular says "Dividend - Rs 20"
        rows = [
            ('DIVIDENDCO', 'EQ', '24-Sep-2026', 100.0, 66.0, 67.0, 65.0, 66.0, 100000)
        ]
        self._setup_daily_source(rows)

        official_actions = {
            ('DIVIDENDCO', '2026-09-24'): {
                'symbol': 'DIVIDENDCO',
                'ex_date': '2026-09-24',
                'subject': 'Special Dividend - Rs 34 Per Share'
            }
        }

        detect_and_register_corporate_actions(
            self.con, 
            ca_path=self.ca_file, 
            official_actions=official_actions
        )

        with open(self.ca_file, "r") as f:
            actions = json.load(f)
        self.assertEqual(len(actions), 0, "Stock with official Dividend circular must be rejected!")

    def test_official_circular_bonus_confirmation(self):
        """Verify Gate 1 accepts official Bonus circular with circular text preserved."""
        rows = [
            ('OFFICIALBONUS', 'EQ', '24-Sep-2026', 1000.0, 666.0, 710.0, 620.0, 640.0, 100000)
        ]
        self._setup_daily_source(rows)

        official_actions = {
            ('OFFICIALBONUS', '2026-09-24'): {
                'symbol': 'OFFICIALBONUS',
                'ex_date': '2026-09-24',
                'subject': 'Bonus Issue 1:2'
            }
        }

        detect_and_register_corporate_actions(
            self.con, 
            ca_path=self.ca_file, 
            official_actions=official_actions
        )

        with open(self.ca_file, "r") as f:
            actions = json.load(f)
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]['symbol'], 'OFFICIALBONUS')
        self.assertEqual(actions[0]['action'], 'BONUS')
        self.assertEqual(actions[0]['ratio'], 1.5)
        self.assertIn("NSE Circular: Bonus Issue 1:2", actions[0]['description'])

    def test_standard_split_triple_fingerprint(self):
        """Verify standard 5:1 split detection and crash rejection."""
        # 1. Valid 5:1 split (TAALTECH-like)
        # PrevClose = 5000, Open = 1000, High = 1050, Low = 980, Close = 1010
        # drop = 0.202, open_ratio = 0.200, intra = 0.010, high_ratio = 0.210
        rows = [
            ('VALIDSPLIT', 'EQ', '24-Sep-2026', 5000.0, 1000.0, 1050.0, 980.0, 1010.0, 500000),
            # Fake crash stock dropping 80% with huge open ratio (opened down 10%, crashed intraday)
            ('CRASHSTOCK', 'EQ', '24-Sep-2026', 5000.0, 4500.0, 4500.0, 1000.0, 1000.0, 500000)
        ]
        self._setup_daily_source(rows)

        detect_and_register_corporate_actions(
            self.con, 
            ca_path=self.ca_file, 
            official_actions={}
        )

        with open(self.ca_file, "r") as f:
            actions = json.load(f)
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]['symbol'], 'VALIDSPLIT')
        self.assertEqual(actions[0]['action'], 'SPLIT')
        self.assertEqual(actions[0]['ratio'], 5.0)

    def test_etf_cache_performance(self):
        """Verify that load_etf_symbols caches symbols in memory."""
        syms1 = load_etf_symbols()
        self.assertIsInstance(syms1, set)
        self.assertIn("NIFTYBEES", syms1)
        syms2 = load_etf_symbols()
        self.assertIs(syms1, syms2, "load_etf_symbols should return the identical cached set instance")

if __name__ == "__main__":
    unittest.main()
